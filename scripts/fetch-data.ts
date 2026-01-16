import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../src/data');
const CURATED_PATH = join(DATA_DIR, 'curated-repos.json');
const OUTPUT_PATH = join(DATA_DIR, 'repos.json');

const GITHUB_API = 'https://api.github.com';
const NPM_REGISTRY = 'https://registry.npmjs.org';
const NPM_DOWNLOADS = 'https://api.npmjs.org/downloads/point/last-week';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DATA_VERSION = 1;

interface CuratedRepo {
  owner: string;
  name: string;
  npmPackage?: string;
  category: string;
  featured?: boolean;
}

interface RepoInfo {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  hasTypescript: boolean;
  license: string | null;
  topics: string[];
}

interface ReleaseInfo {
  tagName: string;
  name: string;
  publishedAt: string;
  isPrerelease: boolean;
}

interface NpmPackageInfo {
  name: string;
  version: string;
  description: string;
  weeklyDownloads: number;
  hasTypes: 'bundled' | 'definitelyTyped' | 'none';
  repository: string | null;
}

const LLM_CONFIGS = [
  { id: 'gpt-5.2-codex', knowledgeCutoff: '2025-08-31' },
  { id: 'gpt-5.2', knowledgeCutoff: '2025-08-31' },
  { id: 'claude-4.5-opus', knowledgeCutoff: '2025-05-01' },
  { id: 'claude-4.5-sonnet', knowledgeCutoff: '2025-01-01' },
  { id: 'gemini-3-pro', knowledgeCutoff: '2025-01-01' },
];

const WEIGHTS = {
  timeliness: 0.35,
  popularity: 0.30,
  aiFriendliness: 0.20,
  community: 0.15,
};

function getHeaders() {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { headers });
      if (response.status === 403) {
        const resetTime = response.headers.get('x-ratelimit-reset');
        if (resetTime) {
          const waitMs = (parseInt(resetTime) * 1000) - Date.now() + 1000;
          if (waitMs > 0 && waitMs < 60000) {
            console.log(`Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s...`);
            await sleep(waitMs);
            continue;
          }
        }
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(1000 * (i + 1));
    }
  }
  throw new Error('Max retries exceeded');
}

async function fetchRepoInfo(owner: string, name: string): Promise<RepoInfo> {
  const response = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${name}`, getHeaders());
  if (!response.ok) {
    throw new Error(`Failed to fetch repo ${owner}/${name}: ${response.status}`);
  }
  const data = await response.json();
  return {
    owner: data.owner.login,
    name: data.name,
    fullName: data.full_name,
    description: data.description || '',
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    language: data.language || 'Unknown',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    pushedAt: data.pushed_at,
    hasTypescript: data.language === 'TypeScript',
    license: data.license?.spdx_id || null,
    topics: data.topics || [],
  };
}

async function fetchReleases(owner: string, name: string): Promise<ReleaseInfo[]> {
  const response = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${name}/releases?per_page=10`, getHeaders());
  if (!response.ok) return [];
  const data = await response.json();
  return data.map((release: Record<string, unknown>) => ({
    tagName: release.tag_name as string,
    name: (release.name as string) || (release.tag_name as string),
    publishedAt: release.published_at as string,
    isPrerelease: release.prerelease as boolean,
  }));
}

async function checkLlmsTxt(owner: string, name: string): Promise<boolean> {
  const paths = ['llms.txt', 'llms-full.txt', '.llms/llms.txt'];
  for (const path of paths) {
    const response = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${name}/contents/${path}`, getHeaders());
    if (response.ok) return true;
  }
  return false;
}

async function fetchNpmPackage(packageName: string): Promise<NpmPackageInfo | null> {
  try {
    const [packageRes, downloadsRes] = await Promise.all([
      fetch(`${NPM_REGISTRY}/${encodeURIComponent(packageName)}`),
      fetch(`${NPM_DOWNLOADS}/${encodeURIComponent(packageName)}`),
    ]);
    if (!packageRes.ok) return null;
    
    const packageData = await packageRes.json();
    const latestVersion = packageData['dist-tags']?.latest;
    const versionData = packageData.versions?.[latestVersion] || {};
    
    let weeklyDownloads = 0;
    if (downloadsRes.ok) {
      const downloadsData = await downloadsRes.json();
      weeklyDownloads = downloadsData.downloads || 0;
    }
    
    const hasTypes = versionData.types || versionData.typings ? 'bundled' : 'none';
    const repoUrl = extractRepoUrl(packageData.repository);
    
    return {
      name: packageData.name,
      version: latestVersion,
      description: packageData.description || '',
      weeklyDownloads,
      hasTypes,
      repository: repoUrl,
    };
  } catch {
    return null;
  }
}

function extractRepoUrl(repository: unknown): string | null {
  if (!repository) return null;
  if (typeof repository === 'string') return repository;
  if (typeof repository === 'object' && repository !== null) {
    const repo = repository as Record<string, unknown>;
    if (typeof repo.url === 'string') {
      return repo.url
        .replace(/^git\+/, '')
        .replace(/\.git$/, '')
        .replace(/^git:\/\//, 'https://');
    }
  }
  return null;
}

function calculateScores(
  repo: RepoInfo,
  releases: ReleaseInfo[],
  npmInfo: NpmPackageInfo | null,
  hasLlmsTxt: boolean
): Record<string, unknown> {
  const scores: Record<string, unknown> = {};
  
  for (const llm of LLM_CONFIGS) {
    const cutoff = new Date(llm.knowledgeCutoff);
    const latestRelease = releases.find(r => !r.isPrerelease);
    const latestReleaseDate = latestRelease ? new Date(latestRelease.publishedAt) : null;
    const lastPush = new Date(repo.pushedAt);
    const createdAt = new Date(repo.createdAt);
    
    let releaseScore = 100;
    if (latestReleaseDate) {
      if (latestReleaseDate <= cutoff) {
        releaseScore = 100;
      } else {
        const daysBeyond = Math.floor((latestReleaseDate.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24));
        releaseScore = Math.max(20, 100 - daysBeyond * 0.5);
      }
    }
    
    let activityScore = 100;
    if (lastPush > cutoff) {
      const daysBeyond = Math.floor((lastPush.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24));
      activityScore = Math.max(30, 100 - daysBeyond * 0.3);
    }
    
    const maturityScore = createdAt < cutoff ? 100 : 50;
    const timelinessScore = releaseScore * 0.5 + activityScore * 0.3 + maturityScore * 0.2;
    
    const starScore = Math.min(100, Math.log10(repo.stars + 1) * 20);
    const forkScore = Math.min(100, Math.log10(repo.forks + 1) * 25);
    let downloadScore = 50;
    if (npmInfo && npmInfo.weeklyDownloads > 0) {
      downloadScore = Math.min(100, Math.log10(npmInfo.weeklyDownloads + 1) * 14.3);
    }
    const popularityScore = starScore * 0.4 + downloadScore * 0.4 + forkScore * 0.2;
    
    let aiFriendlinessScore = 0;
    const hasTypescript = repo.hasTypescript || repo.language === 'TypeScript';
    const hasNpmTypes = npmInfo?.hasTypes === 'bundled' || npmInfo?.hasTypes === 'definitelyTyped';
    if (hasTypescript || hasNpmTypes) aiFriendlinessScore += 35;
    if (hasLlmsTxt) aiFriendlinessScore += 25;
    if (repo.topics.length >= 3) aiFriendlinessScore += 15;
    if (new Date(repo.pushedAt) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) aiFriendlinessScore += 15;
    if (repo.license) aiFriendlinessScore += 10;
    aiFriendlinessScore = Math.min(100, aiFriendlinessScore);
    
    const issueRatio = repo.openIssues / Math.max(1, repo.stars);
    let communityScore = 50;
    if (issueRatio < 0.05) communityScore += 25;
    if (repo.forks > 100) communityScore += 15;
    if (repo.topics.length > 0) communityScore += 10;
    communityScore = Math.min(100, communityScore);
    
    const overall =
      timelinessScore * WEIGHTS.timeliness +
      popularityScore * WEIGHTS.popularity +
      aiFriendlinessScore * WEIGHTS.aiFriendliness +
      communityScore * WEIGHTS.community;
    
    const grade = overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : overall >= 40 ? 'D' : 'F';
    
    scores[llm.id] = {
      overall: Math.round(overall),
      grade,
      timeliness: {
        score: Math.round(timelinessScore),
        details: {
          releaseScore: Math.round(releaseScore),
          activityScore: Math.round(activityScore),
          maturityScore: Math.round(maturityScore),
          latestRelease: latestRelease?.tagName || 'N/A',
          releaseCovered: latestReleaseDate ? latestReleaseDate <= cutoff : true,
        },
      },
      popularity: {
        score: Math.round(popularityScore),
        details: {
          starScore: Math.round(starScore),
          downloadScore: Math.round(downloadScore),
          forkScore: Math.round(forkScore),
          stars: repo.stars,
          forks: repo.forks,
          weeklyDownloads: npmInfo?.weeklyDownloads || 0,
        },
      },
      aiFriendliness: {
        score: Math.round(aiFriendlinessScore),
        details: {
          hasTypescript: hasTypescript || hasNpmTypes,
          hasLlmsTxt,
          hasGoodTopics: repo.topics.length >= 3,
          isWellMaintained: new Date(repo.pushedAt) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          hasLicense: !!repo.license,
        },
      },
      community: {
        score: Math.round(communityScore),
        details: {
          openIssues: repo.openIssues,
          issueRatio: Math.round(issueRatio * 1000) / 1000,
          healthyIssueRatio: issueRatio < 0.05,
        },
      },
    };
  }
  
  return scores;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadExistingData(): Record<string, unknown> {
  try {
    const data = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
    return data.repos || {};
  } catch {
    return {};
  }
}

function saveData(results: Record<string, unknown>) {
  const dataStore = {
    version: DATA_VERSION,
    generatedAt: new Date().toISOString(),
    repos: results,
  };
  writeFileSync(OUTPUT_PATH, JSON.stringify(dataStore, null, 2));
}

async function main() {
  console.log('Loading curated repos...');
  const curatedData = JSON.parse(readFileSync(CURATED_PATH, 'utf-8'));
  const curatedRepos: CuratedRepo[] = curatedData.repos;
  
  console.log(`Found ${curatedRepos.length} curated repos`);
  
  const results: Record<string, unknown> = loadExistingData();
  const errors: string[] = [];
  const skipExisting = process.argv.includes('--skip-existing');
  
  for (let i = 0; i < curatedRepos.length; i++) {
    const curated = curatedRepos[i];
    const key = `${curated.owner}/${curated.name}`;
    
    if (skipExisting && results[key]) {
      console.log(`[${i + 1}/${curatedRepos.length}] Skipping ${key} (cached)`);
      continue;
    }
    
    console.log(`[${i + 1}/${curatedRepos.length}] Fetching ${key}...`);
    
    try {
      const [repo, releases, hasLlmsTxt] = await Promise.all([
        fetchRepoInfo(curated.owner, curated.name),
        fetchReleases(curated.owner, curated.name),
        checkLlmsTxt(curated.owner, curated.name),
      ]);
      
      let npmInfo: NpmPackageInfo | null = null;
      if (curated.npmPackage) {
        npmInfo = await fetchNpmPackage(curated.npmPackage);
      }
      
      const scores = calculateScores(repo, releases, npmInfo, hasLlmsTxt);
      
      results[key] = {
        owner: curated.owner,
        name: curated.name,
        fullName: repo.fullName,
        category: curated.category,
        featured: curated.featured || false,
        
        repo,
        releases,
        hasLlmsTxt,
        
        npmPackage: curated.npmPackage || null,
        npmInfo,
        
        scores,
        
        sources: {
          github: `https://github.com/${key}`,
          npm: curated.npmPackage ? `https://www.npmjs.com/package/${curated.npmPackage}` : null,
          releases: `https://github.com/${key}/releases`,
        },
        
        fetchedAt: new Date().toISOString(),
        dataVersion: DATA_VERSION,
      };
      
      saveData(results);
      await sleep(100);
    } catch (error) {
      const msg = `Failed to fetch ${key}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(msg);
      errors.push(msg);
    }
  }
  
  saveData(results);
  const totalRepos = Object.keys(results).length;
  if (totalRepos === 0) {
    throw new Error('No repo data generated. Check GITHUB_TOKEN or rate limits.');
  }
  console.log(`\nWrote ${totalRepos} repos to ${OUTPUT_PATH}`);
  
  if (errors.length > 0) {
    console.log(`\n${errors.length} errors occurred:`);
    errors.forEach(e => console.log(`  - ${e}`));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
