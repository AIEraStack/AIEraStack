import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../src/data');
const CURATED_PATH = join(DATA_DIR, 'curated-repos.json');
const INDEX_PATH = join(DATA_DIR, 'index.json');
const REPOS_DIR = join(DATA_DIR, 'repos');

const GITHUB_API = 'https://api.github.com';
const NPM_REGISTRY = 'https://registry.npmjs.org';
const NPM_DOWNLOADS = 'https://api.npmjs.org/downloads/point/last-week';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DATA_VERSION = 2;

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

interface DocSignals {
  readmeSize: number;
  hasDocsDir: boolean;
  hasExamplesDir: boolean;
  hasChangelog: boolean;
}

interface ActivitySignals {
  recentCommitsCount: number;
  commitFrequency: number;
  avgDaysBetweenReleases: number;
  recentClosedPRsCount: number;
  avgPRCloseTimeHours: number;
}

interface RepoIndexEntry {
  owner: string;
  name: string;
  fullName: string;
  category: string;
  featured: boolean;
  stars: number;
  language: string;
  description: string;
  bestScore: number;
  bestGrade: string;
  scoresByLLM: Record<string, { overall: number; grade: string }>;
  updatedAt: string;
  fetchedAt: string;
}

interface RepoScoreSummary {
  overall: number;
  grade: string;
  [key: string]: unknown;
}

type ScoresByLlm = Record<string, RepoScoreSummary>;

interface CachedRepoDataFile {
  owner: string;
  name: string;
  fullName: string;
  category: string;
  featured: boolean;
  repo: RepoInfo;
  releases: ReleaseInfo[];
  hasLlmsTxt: boolean;
  npmPackage: string | null;
  npmInfo: NpmPackageInfo | null;
  docSignals: DocSignals;
  activitySignals: ActivitySignals;
  scores: ScoresByLlm;
  sources: {
    github: string;
    npm: string | null;
    releases: string;
  };
  fetchedAt: string;
  dataVersion: number;
}

const LLM_CONFIGS = [
  { id: 'gpt-5.2-codex', knowledgeCutoff: '2025-08-31' },
  { id: 'claude-4.5-opus', knowledgeCutoff: '2025-05-01' },
  { id: 'gemini-3-pro', knowledgeCutoff: '2025-01-01' },
];

const WEIGHTS = {
  coverage: 0.25,
  adoption: 0.20,
  documentation: 0.15,
  aiReadiness: 0.15,
  momentum: 0.15,
  maintenance: 0.10,
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

async function fetchReadmeSize(owner: string, name: string): Promise<number> {
  try {
    const response = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${name}/readme`, getHeaders());
    if (!response.ok) return 0;
    const data = await response.json();
    return data.size || 0;
  } catch {
    return 0;
  }
}

async function fetchRootContents(owner: string, name: string): Promise<string[]> {
  try {
    const response = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${name}/contents`, getHeaders());
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => item.name.toLowerCase());
  } catch {
    return [];
  }
}

async function fetchRecentCommits(owner: string, name: string): Promise<any[]> {
  try {
    const response = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${name}/commits?per_page=30`, getHeaders());
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((commit: any) => ({
      sha: commit.sha,
      date: commit.commit.author.date,
      message: commit.commit.message,
    }));
  } catch {
    return [];
  }
}

async function fetchRecentClosedPRs(owner: string, name: string): Promise<any[]> {
  try {
    const response = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${name}/pulls?state=closed&per_page=30&sort=updated&direction=desc`, getHeaders());
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((pr: any) => ({
      number: pr.number,
      createdAt: pr.created_at,
      closedAt: pr.closed_at,
      mergedAt: pr.merged_at,
      state: pr.state,
    }));
  } catch {
    return [];
  }
}

function calculateCommitFrequency(commits: any[]): number {
  if (commits.length < 2) return 0;
  const dates = commits.map(c => new Date(c.date).getTime()).sort((a, b) => b - a);
  const oldestDate = dates[dates.length - 1];
  const newestDate = dates[0];
  const daysSpan = (newestDate - oldestDate) / (1000 * 60 * 60 * 24);
  if (daysSpan === 0) return commits.length;
  return (commits.length / daysSpan) * 7;
}

function calculateAvgDaysBetweenReleases(releases: ReleaseInfo[]): number {
  const nonPrereleases = releases.filter(r => !r.isPrerelease);
  if (nonPrereleases.length < 2) return 0;
  const dates = nonPrereleases.map(r => new Date(r.publishedAt).getTime()).sort((a, b) => b - a);
  let totalDays = 0;
  for (let i = 0; i < dates.length - 1; i++) {
    totalDays += (dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24);
  }
  return totalDays / (dates.length - 1);
}

function calculateAvgPRCloseTime(prs: any[]): number {
  const closedPRs = prs.filter(pr => pr.closedAt);
  if (closedPRs.length === 0) return 0;
  let totalHours = 0;
  for (const pr of closedPRs) {
    const created = new Date(pr.createdAt).getTime();
    const closed = new Date(pr.closedAt).getTime();
    totalHours += (closed - created) / (1000 * 60 * 60);
  }
  return totalHours / closedPRs.length;
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
  hasLlmsTxt: boolean,
  docSignals: DocSignals,
  activitySignals: ActivitySignals
): ScoresByLlm {
  const scores: ScoresByLlm = {};
  
  for (const llm of LLM_CONFIGS) {
    // Coverage dimension
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
    const coverageScore = releaseScore * 0.5 + activityScore * 0.3 + maturityScore * 0.2;
    
    // Adoption dimension
    const starScore = Math.min(100, Math.log10(repo.stars + 1) * 20);
    const forkScore = Math.min(100, Math.log10(repo.forks + 1) * 25);
    let downloadScore = 50;
    if (npmInfo && npmInfo.weeklyDownloads > 0) {
      downloadScore = Math.min(100, Math.log10(npmInfo.weeklyDownloads + 1) * 14.3);
    }
    const adoptionScore = starScore * 0.4 + downloadScore * 0.4 + forkScore * 0.2;
    
    // Documentation dimension
    let documentationScore = 0;
    if (docSignals.readmeSize > 10000) documentationScore += 40;
    else if (docSignals.readmeSize > 5000) documentationScore += 30;
    else if (docSignals.readmeSize > 2000) documentationScore += 20;
    else if (docSignals.readmeSize > 500) documentationScore += 10;
    if (docSignals.hasDocsDir) documentationScore += 25;
    if (docSignals.hasExamplesDir) documentationScore += 20;
    if (docSignals.hasChangelog) documentationScore += 15;
    documentationScore = Math.min(100, documentationScore);
    
    // AI Readiness dimension
    let aiReadinessScore = 0;
    const hasTypescript = repo.hasTypescript || repo.language === 'TypeScript';
    const hasNpmTypes = npmInfo?.hasTypes === 'bundled' || npmInfo?.hasTypes === 'definitelyTyped';
    if (hasTypescript || hasNpmTypes) aiReadinessScore += 40;
    if (hasLlmsTxt) aiReadinessScore += 30;
    if (repo.topics.length >= 3) aiReadinessScore += 15;
    if (repo.license) aiReadinessScore += 15;
    aiReadinessScore = Math.min(100, aiReadinessScore);
    
    // Momentum dimension
    let momentumScore = 0;
    if (activitySignals.commitFrequency > 10) momentumScore += 40;
    else if (activitySignals.commitFrequency > 5) momentumScore += 30;
    else if (activitySignals.commitFrequency > 2) momentumScore += 20;
    else if (activitySignals.commitFrequency > 0.5) momentumScore += 10;
    
    if (activitySignals.avgDaysBetweenReleases > 0) {
      if (activitySignals.avgDaysBetweenReleases < 30) momentumScore += 35;
      else if (activitySignals.avgDaysBetweenReleases < 60) momentumScore += 25;
      else if (activitySignals.avgDaysBetweenReleases < 120) momentumScore += 15;
      else if (activitySignals.avgDaysBetweenReleases < 180) momentumScore += 5;
    }
    
    if (activitySignals.recentCommitsCount >= 30) momentumScore += 25;
    else if (activitySignals.recentCommitsCount >= 20) momentumScore += 20;
    else if (activitySignals.recentCommitsCount >= 10) momentumScore += 15;
    else if (activitySignals.recentCommitsCount >= 5) momentumScore += 10;
    momentumScore = Math.min(100, momentumScore);
    
    // Maintenance dimension
    const issueRatio = repo.openIssues / Math.max(1, repo.stars);
    let maintenanceScore = 50;
    if (issueRatio < 0.02) maintenanceScore += 30;
    else if (issueRatio < 0.05) maintenanceScore += 20;
    else if (issueRatio < 0.1) maintenanceScore += 10;
    
    if (activitySignals.avgPRCloseTimeHours > 0) {
      if (activitySignals.avgPRCloseTimeHours < 24) maintenanceScore += 20;
      else if (activitySignals.avgPRCloseTimeHours < 72) maintenanceScore += 15;
      else if (activitySignals.avgPRCloseTimeHours < 168) maintenanceScore += 10;
      else if (activitySignals.avgPRCloseTimeHours < 720) maintenanceScore += 5;
    }
    maintenanceScore = Math.min(100, maintenanceScore);
    
    const overall =
      coverageScore * WEIGHTS.coverage +
      adoptionScore * WEIGHTS.adoption +
      documentationScore * WEIGHTS.documentation +
      aiReadinessScore * WEIGHTS.aiReadiness +
      momentumScore * WEIGHTS.momentum +
      maintenanceScore * WEIGHTS.maintenance;
    
    const grade = overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : overall >= 40 ? 'D' : 'F';
    
    scores[llm.id] = {
      overall: Math.round(overall),
      grade,
      coverage: {
        score: Math.round(coverageScore),
        details: {
          releaseScore: Math.round(releaseScore),
          activityScore: Math.round(activityScore),
          maturityScore: Math.round(maturityScore),
          latestRelease: latestRelease?.tagName || 'N/A',
          releaseCovered: latestReleaseDate ? latestReleaseDate <= cutoff : true,
        },
      },
      adoption: {
        score: Math.round(adoptionScore),
        details: {
          starScore: Math.round(starScore),
          downloadScore: Math.round(downloadScore),
          forkScore: Math.round(forkScore),
          stars: repo.stars,
          forks: repo.forks,
          weeklyDownloads: npmInfo?.weeklyDownloads || 0,
        },
      },
      documentation: {
        score: Math.round(documentationScore),
        details: {
          readmeSize: docSignals.readmeSize,
          hasDocsDir: docSignals.hasDocsDir,
          hasExamplesDir: docSignals.hasExamplesDir,
          hasChangelog: docSignals.hasChangelog,
        },
      },
      aiReadiness: {
        score: Math.round(aiReadinessScore),
        details: {
          hasTypescript: hasTypescript || hasNpmTypes,
          hasLlmsTxt,
          hasGoodTopics: repo.topics.length >= 3,
          hasLicense: !!repo.license,
        },
      },
      momentum: {
        score: Math.round(momentumScore),
        details: {
          commitFrequency: Math.round(activitySignals.commitFrequency * 10) / 10,
          avgDaysBetweenReleases: Math.round(activitySignals.avgDaysBetweenReleases),
          recentCommitsCount: activitySignals.recentCommitsCount,
        },
      },
      maintenance: {
        score: Math.round(maintenanceScore),
        details: {
          openIssues: repo.openIssues,
          issueRatio: Math.round(issueRatio * 1000) / 1000,
          avgPRCloseTimeHours: Math.round(activitySignals.avgPRCloseTimeHours),
          recentClosedPRsCount: activitySignals.recentClosedPRsCount,
        },
      },
    };
  }
  
  return scores;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadExistingIndex(): Record<string, RepoIndexEntry> {
  try {
    const data = JSON.parse(readFileSync(INDEX_PATH, 'utf-8')) as { repos?: Record<string, RepoIndexEntry> };
    if (!data || typeof data !== 'object') return {};
    if (!data.repos || typeof data.repos !== 'object') return {};
    return data.repos;
  } catch {
    return {};
  }
}

function readRepoFile(owner: string, name: string): CachedRepoDataFile | null {
  const filePath = join(REPOS_DIR, owner, `${name}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as CachedRepoDataFile;
  } catch {
    return null;
  }
}

function getBestScore(scores: ScoresByLlm): { bestScore: number; bestGrade: string } {
  let bestScore = 0;
  let bestGrade = 'F';
  for (const entry of Object.values(scores)) {
    const score = typeof entry.overall === 'number' ? entry.overall : 0;
    const grade = typeof entry.grade === 'string' ? entry.grade : 'F';
    if (score > bestScore) {
      bestScore = score;
      bestGrade = grade;
    }
  }
  return { bestScore, bestGrade };
}

function buildIndexEntry(data: CachedRepoDataFile): RepoIndexEntry {
  const { bestScore, bestGrade } = getBestScore(data.scores);
  const scoresByLLM: Record<string, { overall: number; grade: string }> = {};
  for (const [llmId, llmScores] of Object.entries(data.scores)) {
    scoresByLLM[llmId] = {
      overall: llmScores.overall,
      grade: llmScores.grade,
    };
  }
  return {
    owner: data.owner,
    name: data.name,
    fullName: data.fullName,
    category: data.category,
    featured: data.featured,
    stars: data.repo.stars,
    language: data.repo.language,
    description: data.repo.description,
    bestScore,
    bestGrade,
    scoresByLLM,
    updatedAt: data.repo.updatedAt,
    fetchedAt: data.fetchedAt,
  };
}

// Save individual repo file in split architecture
function saveRepoFile(owner: string, name: string, data: unknown) {
  mkdirSync(REPOS_DIR, { recursive: true });
  const ownerDir = join(REPOS_DIR, owner);
  mkdirSync(ownerDir, { recursive: true });
  const filePath = join(ownerDir, `${name}.json`);
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Save index file
function saveIndexFile(index: Record<string, RepoIndexEntry>) {
  const indexData = {
    version: DATA_VERSION,
    generatedAt: new Date().toISOString(),
    repos: index,
  };
  writeFileSync(INDEX_PATH, JSON.stringify(indexData, null, 2));
}

async function main() {
  console.log('Loading curated repos...');
  const curatedData = JSON.parse(readFileSync(CURATED_PATH, 'utf-8'));
  const curatedRepos: CuratedRepo[] = curatedData.repos;
  
  console.log(`Found ${curatedRepos.length} curated repos`);
  console.log('Using split architecture: index.json + individual repo files');

  const index: Record<string, RepoIndexEntry> = { ...loadExistingIndex() };
  const errors: string[] = [];
  const skipExisting = process.argv.includes('--skip-existing');
  
  for (let i = 0; i < curatedRepos.length; i++) {
    const curated = curatedRepos[i];
    const key = `${curated.owner}/${curated.name}`;
    
    if (skipExisting) {
      const existingRepo = readRepoFile(curated.owner, curated.name);
      if (existingRepo) {
        if (!index[key]) {
          index[key] = buildIndexEntry(existingRepo);
        }
        console.log(`[${i + 1}/${curatedRepos.length}] Skipping ${key} (cached)`);
        continue;
      }
    }
    
    console.log(`[${i + 1}/${curatedRepos.length}] Fetching ${key}...`);
    
    try {
      const [repo, releases, hasLlmsTxt, readmeSize, rootContents, recentCommits, recentClosedPRs] = await Promise.all([
        fetchRepoInfo(curated.owner, curated.name),
        fetchReleases(curated.owner, curated.name),
        checkLlmsTxt(curated.owner, curated.name),
        fetchReadmeSize(curated.owner, curated.name),
        fetchRootContents(curated.owner, curated.name),
        fetchRecentCommits(curated.owner, curated.name),
        fetchRecentClosedPRs(curated.owner, curated.name),
      ]);
      
      let npmInfo: NpmPackageInfo | null = null;
      if (curated.npmPackage) {
        npmInfo = await fetchNpmPackage(curated.npmPackage);
      }
      
      const docSignals: DocSignals = {
        readmeSize,
        hasDocsDir: rootContents.some(name => name === 'docs' || name === 'documentation'),
        hasExamplesDir: rootContents.some(name => name === 'examples' || name === 'example'),
        hasChangelog: rootContents.some(name => name.includes('changelog') || name.includes('history')),
      };

      const activitySignals: ActivitySignals = {
        recentCommitsCount: recentCommits.length,
        commitFrequency: calculateCommitFrequency(recentCommits),
        avgDaysBetweenReleases: calculateAvgDaysBetweenReleases(releases),
        recentClosedPRsCount: recentClosedPRs.length,
        avgPRCloseTimeHours: calculateAvgPRCloseTime(recentClosedPRs),
      };
      
      const scores = calculateScores(repo, releases, npmInfo, hasLlmsTxt, docSignals, activitySignals);
      
      const fetchedAt = new Date().toISOString();
      const repoData: CachedRepoDataFile = {
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
        
        docSignals,
        activitySignals,
        
        scores,
        
        sources: {
          github: `https://github.com/${key}`,
          npm: curated.npmPackage ? `https://www.npmjs.com/package/${curated.npmPackage}` : null,
          releases: `https://github.com/${key}/releases`,
        },
        
        fetchedAt,
        dataVersion: DATA_VERSION,
      };
      
      // Save individual repo file (new architecture)
      saveRepoFile(curated.owner, curated.name, repoData);

      // Add to index
      index[key] = buildIndexEntry(repoData);
      
      // Save after each repo to avoid data loss
      saveIndexFile(index);
      
      await sleep(100);
    } catch (error) {
      const msg = `Failed to fetch ${key}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(msg);
      errors.push(msg);
    }
  }
  
  // Final save
  saveIndexFile(index);
  
  const totalRepos = Object.keys(index).length;
  if (totalRepos === 0) {
    throw new Error('No repo data generated. Check GITHUB_TOKEN or rate limits.');
  }
  
  console.log(`\n✅ Success!`);
  console.log(`  - Index file: ${INDEX_PATH} (${Object.keys(index).length} entries)`);
  console.log(`  - Individual files: ${REPOS_DIR}/ (${Object.keys(index).length} files)`);
  
  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} errors occurred:`);
    errors.forEach(e => console.log(`  - ${e}`));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
