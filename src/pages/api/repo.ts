import type { APIRoute } from 'astro';
import curatedSource from '../../data/curated-repos.json';
import { getCachedRepo, saveRepoToR2, updateRepoInIndex } from '../../lib/data-loader';
import { 
  checkLlmsTxt, 
  fetchReleases, 
  fetchRepoInfo, 
  fetchRecentCommits, 
  fetchRecentClosedPRs, 
  fetchReadme, 
  fetchRootContents,
  parseReadmeLinks
} from '../../lib/github';
import { fetchNpmPackage } from '../../lib/npm';
import { calculateScores } from '../../lib/scoring';
import type { CachedRepoData, CuratedRepo, DocSignals, ActivitySignals } from '../../lib/types';
import { DATA_VERSION } from '../../lib/types';

interface R2Bucket {
  get(key: string): Promise<any>;
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<void>;
}

interface CloudflareEnv {
  DATA_BUCKET?: R2Bucket;
  GITHUB_TOKEN?: string;
}

const curatedRepos = (curatedSource as unknown as { repos: CuratedRepo[] }).repos;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=3600' : 'no-store',
    },
  });
}

function findCuratedRepo(owner: string, name: string): CuratedRepo | undefined {
  const ownerLower = owner.toLowerCase();
  const nameLower = name.toLowerCase();
  return curatedRepos.find(
    (repo) => repo.owner.toLowerCase() === ownerLower && repo.name.toLowerCase() === nameLower
  );
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const owner = url.searchParams.get('owner');
  const name = url.searchParams.get('name');

  if (!owner || !name) {
    return jsonResponse({ error: 'Missing owner or name' }, 400);
  }

  const env = (locals?.runtime?.env as CloudflareEnv | undefined) ?? {};
  const curatedMatch = findCuratedRepo(owner, name);
  const cacheKey = curatedMatch ? `${curatedMatch.owner}/${curatedMatch.name}` : `${owner}/${name}`;

  // Check cache using split architecture
  const cached = await getCachedRepo(
    curatedMatch?.owner || owner,
    curatedMatch?.name || name,
    { DATA_BUCKET: env.DATA_BUCKET }
  );
  
  if (cached) {
    return jsonResponse(cached);
  }

  // Fetch fresh data
  try {
    const [repo, releases, hasLlmsTxt, readme, rootContents, recentCommits, recentClosedPRs] = await Promise.all([
      fetchRepoInfo(owner, name, env.GITHUB_TOKEN),
      fetchReleases(owner, name, env.GITHUB_TOKEN),
      checkLlmsTxt(owner, name, env.GITHUB_TOKEN),
      fetchReadme(owner, name, env.GITHUB_TOKEN),
      fetchRootContents(owner, name, env.GITHUB_TOKEN),
      fetchRecentCommits(owner, name, env.GITHUB_TOKEN),
      fetchRecentClosedPRs(owner, name, env.GITHUB_TOKEN),
    ]);

    const npmPackageName = curatedMatch?.npmPackage || repo.name.toLowerCase();
    const npmInfo = await fetchNpmPackage(npmPackageName);

    // Parse README for doc/example links
    const readmeLinks = parseReadmeLinks(readme.content);

    // Check for Claude.md and Agent.md in root
    const hasClaudeMd = rootContents.some(name => name === 'claude.md');
    const hasAgentMd = rootContents.some(name => name === 'agent.md' || name === 'agents.md');

    // Build doc signals
    const docSignals: DocSignals = {
      readmeSize: readme.size,
      hasDocsDir: rootContents.some(name => name === 'docs' || name === 'documentation'),
      hasExamplesDir: rootContents.some(name => name === 'examples' || name === 'example'),
      hasChangelog: rootContents.some(name => name.includes('changelog') || name.includes('history')),
      hasDocsLink: readmeLinks.hasDocsLink,
      hasExamplesLink: readmeLinks.hasExamplesLink,
    };

    // Build activity signals
    const activitySignals: ActivitySignals = {
      recentCommitsCount: recentCommits.length,
      commitFrequency: calculateCommitFrequency(recentCommits),
      avgDaysBetweenReleases: calculateAvgDaysBetweenReleases(releases),
      recentClosedPRsCount: recentClosedPRs.length,
      avgPRCloseTimeHours: calculateAvgPRCloseTime(recentClosedPRs),
    };

    const scores = calculateScores(repo, releases, npmInfo, hasLlmsTxt, docSignals, activitySignals, hasClaudeMd, hasAgentMd);

    const cacheRecord: CachedRepoData = {
      owner: repo.owner,
      name: repo.name,
      fullName: repo.fullName,
      category: curatedMatch?.category || 'utility',
      featured: curatedMatch?.featured || false,
      repo,
      releases,
      hasLlmsTxt,
      hasClaudeMd,
      hasAgentMd,
      npmPackage: npmInfo ? npmPackageName : null,
      npmInfo,
      docSignals,
      activitySignals,
      scores,
      sources: {
        github: `https://github.com/${repo.owner}/${repo.name}`,
        npm: npmInfo ? `https://www.npmjs.com/package/${npmPackageName}` : null,
        releases: `https://github.com/${repo.owner}/${repo.name}/releases`,
      },
      fetchedAt: new Date().toISOString(),
      dataVersion: DATA_VERSION,
    };

    // Save using new split architecture
    if (env.DATA_BUCKET) {
      await saveRepoToR2(cacheRecord, { DATA_BUCKET: env.DATA_BUCKET });
      await updateRepoInIndex(cacheRecord, { DATA_BUCKET: env.DATA_BUCKET });
    }

    return jsonResponse(cacheRecord);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch repository data';
    return jsonResponse({ error: message }, 500);
  }
};

function calculateCommitFrequency(commits: any[]): number {
  if (commits.length < 2) return 0;
  
  const dates = commits.map(c => new Date(c.date).getTime()).sort((a, b) => b - a);
  const oldestDate = dates[dates.length - 1];
  const newestDate = dates[0];
  const daysSpan = (newestDate - oldestDate) / (1000 * 60 * 60 * 24);
  
  if (daysSpan === 0) return commits.length;
  
  return (commits.length / daysSpan) * 7; // commits per week
}

function calculateAvgDaysBetweenReleases(releases: any[]): number {
  // Filter to stable minor/major releases (x.y.0) only
  const stableReleases = releases.filter(r => {
    if (r.isPrerelease) return false;
    const match = r.tagName.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?$/);
    if (!match) return false;
    const patch = match[3] ? parseInt(match[3], 10) : 0;
    return patch === 0;
  });
  
  if (stableReleases.length < 2) return 0;
  
  const dates = stableReleases.map(r => new Date(r.publishedAt).getTime()).sort((a, b) => b - a);
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
