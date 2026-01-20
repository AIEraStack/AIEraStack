/**
 * Repo Fetcher - Core logic for fetching repository data
 * Extracts shared functionality from /api/repo.ts for use by SSR pages
 */

import curatedSource from '../config/curated-repos.json';
import { saveRepoToD1 } from './d1-data-loader';
import {
    checkLlmsTxt,
    fetchReleases,
    fetchRepoInfo,
    fetchRecentCommits,
    fetchRecentClosedPRs,
    fetchReadme,
    fetchRootContents,
    parseReadmeLinks
} from './github';
import { fetchNpmPackage } from './npm';
import { calculateScores } from './scoring';
import type { CachedRepoData, CuratedRepo, DocSignals, ActivitySignals } from './types';
import { DATA_VERSION } from './types';

interface D1Database {
    prepare(query: string): any;
    batch<T>(statements: any[]): Promise<any[]>;
    exec(query: string): Promise<{ count: number }>;
}

export interface FetcherEnv {
    DB?: D1Database;
    GITHUB_TOKEN?: string;
}

const curatedRepos = (curatedSource as unknown as { repos: CuratedRepo[] }).repos;

/**
 * Find a curated repo match by owner/name (case-insensitive)
 */
export function findCuratedRepo(owner: string, name: string): CuratedRepo | undefined {
    const ownerLower = owner.toLowerCase();
    const nameLower = name.toLowerCase();
    return curatedRepos.find(
        (repo) => repo.owner.toLowerCase() === ownerLower && repo.name.toLowerCase() === nameLower
    );
}

/**
 * Calculate commit frequency (commits per week)
 */
function calculateCommitFrequency(commits: any[]): number {
    if (commits.length < 2) return 0;

    const dates = commits.map(c => new Date(c.date).getTime()).sort((a, b) => b - a);
    const oldestDate = dates[dates.length - 1];
    const newestDate = dates[0];
    const daysSpan = (newestDate - oldestDate) / (1000 * 60 * 60 * 24);

    if (daysSpan === 0) return commits.length;

    return (commits.length / daysSpan) * 7; // commits per week
}

/**
 * Calculate average days between stable releases (x.y.0)
 */
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

/**
 * Calculate average PR close time in hours
 */
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

/**
 * Fetch repository data from GitHub and calculate scores (without saving)
 * This is the core logic that can be reused by both SSR and batch update scripts
 */
export async function fetchRepoData(
    owner: string,
    name: string,
    curatedMatch: CuratedRepo | undefined,
    githubToken?: string
): Promise<CachedRepoData> {
    const [repo, releases, hasLlmsTxt, readme, rootContents, recentCommits, recentClosedPRs] = await Promise.all([
        fetchRepoInfo(owner, name, githubToken),
        fetchReleases(owner, name, githubToken),
        checkLlmsTxt(owner, name, githubToken),
        fetchReadme(owner, name, githubToken),
        fetchRootContents(owner, name, githubToken),
        fetchRecentCommits(owner, name, githubToken),
        fetchRecentClosedPRs(owner, name, githubToken),
    ]);

    const npmPackageName = curatedMatch?.npmPackage || repo.name.toLowerCase();
    const npmInfo = await fetchNpmPackage(npmPackageName);

    // Parse README for doc/example links
    const readmeLinks = parseReadmeLinks(readme.content);

    // Check for Claude.md and Agent.md in root
    const hasClaudeMd = rootContents.some(n => n === 'claude.md');
    const hasAgentMd = rootContents.some(n => n === 'agent.md' || n === 'agents.md');

    // Build doc signals
    const docSignals: DocSignals = {
        readmeSize: readme.size,
        hasDocsDir: rootContents.some(n => n === 'docs' || n === 'documentation'),
        hasExamplesDir: rootContents.some(n => n === 'examples' || n === 'example'),
        hasChangelog: rootContents.some(n => n.includes('changelog') || n.includes('history')),
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

    return {
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        category: curatedMatch?.category || 'tooling-utilities',
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
}

/**
 * Fetch repository data and save to D1
 * Used by SSR pages with D1 binding
 */
export async function fetchAndSaveRepo(
    owner: string,
    name: string,
    curatedMatch: CuratedRepo | undefined,
    env: FetcherEnv
): Promise<CachedRepoData> {
    const cacheRecord = await fetchRepoData(owner, name, curatedMatch, env.GITHUB_TOKEN);

    // Save to D1 - atomic operation
    if (env.DB) {
        await saveRepoToD1(cacheRecord, { DB: env.DB });
    }

    return cacheRecord;
}

/**
 * Get repo data - first check cache, then fetch if needed
 * This is the main function for SSR pages to use
 */
export async function getOrFetchRepo(
    owner: string,
    name: string,
    env: FetcherEnv,
    getCachedRepo: (owner: string, name: string, env: any) => Promise<CachedRepoData | null>
): Promise<CachedRepoData | null> {
    // Find curated match for correct owner/name
    const curatedMatch = findCuratedRepo(owner, name);
    const lookupOwner = curatedMatch?.owner || owner;
    const lookupName = curatedMatch?.name || name;

    // Check cache first
    const cached = await getCachedRepo(lookupOwner, lookupName, { DB: env.DB });
    if (cached) {
        return cached;
    }

    // Fetch from GitHub
    try {
        return await fetchAndSaveRepo(lookupOwner, lookupName, curatedMatch, env);
    } catch (error) {
        console.error(`Failed to fetch repo ${owner}/${name}:`, error);
        return null;
    }
}
