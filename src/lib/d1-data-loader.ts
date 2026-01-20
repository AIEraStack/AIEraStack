/**
 * D1 Data Loader - Replaces R2-based data-loader.ts
 * Uses Cloudflare D1 SQL database for atomic operations
 */

import { DATA_VERSION, type CachedRepoData, type RepoCategory, type RepoIndex, type RepoIndexEntry } from './types';

interface D1Result<T> {
    results: T[];
    success: boolean;
    meta: {
        changes: number;
        last_row_id: number;
        duration: number;
    };
}

interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<{ count: number }>;
}

interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(column?: string): Promise<T | null>;
    all<T = unknown>(): Promise<D1Result<T>>;
    run(): Promise<D1Result<unknown>>;
}

export interface DataEnv {
    DB?: D1Database;
}

interface RepoRow {
    owner: string;
    name: string;
    full_name: string;
    category: string;
    featured: number;
    stars: number;
    language: string | null;
    description: string | null;
    best_score: number;
    best_grade: string;
    scores_by_llm: string;
    updated_at: string | null;
    fetched_at: string;
    data_version: number;
    data: string;
}

function isDataVersionCurrent(dataVersion: number): boolean {
    return typeof dataVersion === 'number' && dataVersion >= DATA_VERSION;
}

// Default cache max age: 1 days
const DEFAULT_CACHE_MAX_AGE_HOURS = 24 * 1;

/**
 * Check if cached data is stale based on fetchedAt timestamp
 */
function isCacheStale(fetchedAt: string, maxAgeHours = DEFAULT_CACHE_MAX_AGE_HOURS): boolean {
    const fetchedTime = new Date(fetchedAt).getTime();
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    return (now - fetchedTime) > maxAgeMs;
}

// Convert database row to RepoIndexEntry
function rowToIndexEntry(row: RepoRow): RepoIndexEntry {
    return {
        owner: row.owner,
        name: row.name,
        fullName: row.full_name,
        category: row.category as RepoCategory,
        featured: row.featured === 1,
        stars: row.stars,
        language: row.language || '',
        description: row.description || '',
        bestScore: row.best_score,
        bestGrade: row.best_grade,
        scoresByLLM: JSON.parse(row.scores_by_llm || '{}'),
        updatedAt: row.updated_at || '',
        fetchedAt: row.fetched_at,
    };
}

// Get repo index from D1
export async function getRepoIndex(env?: DataEnv): Promise<RepoIndex> {
    if (!env?.DB) {
        throw new Error('D1 database not available - env.DB is undefined');
    }

    const result = await env.DB.prepare(`
    SELECT owner, name, full_name, category, featured, stars, language, 
           description, best_score, best_grade, scores_by_llm, updated_at, fetched_at
    FROM repos
    ORDER BY best_score DESC
  `).all<RepoRow>();

    const repos: Record<string, RepoIndexEntry> = {};
    for (const row of result.results) {
        const key = `${row.owner}/${row.name}`;
        repos[key] = rowToIndexEntry(row);
    }

    return {
        version: 2,
        generatedAt: new Date().toISOString(),
        repos,
    };
}

export interface CacheResult {
    data: CachedRepoData | null;
    isStale: boolean;
}

/**
 * Get cached repo from D1 with staleness information
 * Returns both the cached data and whether it's stale
 */
export async function getCachedRepoWithStatus(
    owner: string,
    name: string,
    env?: DataEnv,
    maxAgeHours = DEFAULT_CACHE_MAX_AGE_HOURS
): Promise<CacheResult> {
    if (!env?.DB) {
        throw new Error('D1 database not available - env.DB is undefined');
    }

    const row = await env.DB.prepare(`
    SELECT data, data_version, fetched_at FROM repos WHERE owner = ? AND name = ?
  `).bind(owner, name).first<{ data: string; data_version: number; fetched_at: string }>();

    if (!row) {
        return { data: null, isStale: true };
    }

    if (!isDataVersionCurrent(row.data_version)) {
        return { data: null, isStale: true };
    }

    const data = JSON.parse(row.data) as CachedRepoData;
    const isStale = isCacheStale(row.fetched_at, maxAgeHours);

    return { data, isStale };
}

/**
 * Get cached repo from D1 (backward compatible)
 * Returns null if cache is stale or doesn't exist
 */
export async function getCachedRepo(
    owner: string,
    name: string,
    env?: DataEnv,
    options?: { allowStale?: boolean; maxAgeHours?: number }
): Promise<CachedRepoData | null> {
    const { allowStale = false, maxAgeHours = DEFAULT_CACHE_MAX_AGE_HOURS } = options || {};
    const result = await getCachedRepoWithStatus(owner, name, env, maxAgeHours);

    if (!result.data) return null;
    if (!allowStale && result.isStale) return null;

    return result.data;
}

// Save repo to D1 - single transaction for atomicity
export async function saveRepoToD1(data: CachedRepoData, env?: DataEnv): Promise<void> {
    if (!env?.DB) {
        throw new Error('D1 database not available - env.DB is undefined');
    }

    // Calculate best score and per-LLM scores
    let bestScore = 0;
    let bestGrade = 'F';
    const scoresByLLM: Record<string, { overall: number; grade: string }> = {};

    const scoreEntries = Object.entries(data.scores);
    for (const [llmId, llmScores] of scoreEntries) {
        const score = llmScores.overall || 0;
        const grade = llmScores.grade || 'F';

        scoresByLLM[llmId] = { overall: score, grade };

        if (score > bestScore) {
            bestScore = score;
            bestGrade = grade;
        }
    }

    // Single UPSERT - atomically updates both index fields and full data
    await env.DB.prepare(`
    INSERT INTO repos (
      owner, name, full_name, category, featured, stars, language, description,
      best_score, best_grade, scores_by_llm, updated_at, fetched_at, data_version, data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner, name) DO UPDATE SET
      full_name = excluded.full_name,
      category = excluded.category,
      featured = excluded.featured,
      stars = excluded.stars,
      language = excluded.language,
      description = excluded.description,
      best_score = excluded.best_score,
      best_grade = excluded.best_grade,
      scores_by_llm = excluded.scores_by_llm,
      updated_at = excluded.updated_at,
      fetched_at = excluded.fetched_at,
      data_version = excluded.data_version,
      data = excluded.data
  `).bind(
        data.owner,
        data.name,
        data.fullName,
        data.category,
        data.featured ? 1 : 0,
        data.repo.stars,
        data.repo.language,
        data.repo.description,
        bestScore,
        bestGrade,
        JSON.stringify(scoresByLLM),
        data.repo.updatedAt,
        data.fetchedAt,
        DATA_VERSION,
        JSON.stringify(data)
    ).run();
}

// Get all cached repos from D1
export async function getAllCachedRepos(env?: DataEnv): Promise<RepoIndexEntry[]> {
    const index = await getRepoIndex(env);
    return Object.values(index.repos);
}

// Get full repo data for all cached repos
export async function getAllCachedReposDetailed(env?: DataEnv): Promise<CachedRepoData[]> {
    if (!env?.DB) {
        throw new Error('D1 database not available - env.DB is undefined');
    }

    const result = await env.DB.prepare(`
    SELECT data, data_version FROM repos WHERE data_version >= ?
  `).bind(DATA_VERSION).all<{ data: string; data_version: number }>();

    return result.results.map(row => JSON.parse(row.data) as CachedRepoData);
}

export async function getFeaturedRepos(env?: DataEnv): Promise<RepoIndexEntry[]> {
    if (!env?.DB) {
        throw new Error('D1 database not available - env.DB is undefined');
    }

    // Use the featured column directly - avoids SQLite variable limit issues
    const result = await env.DB.prepare(`
    SELECT owner, name, full_name, category, featured, stars, language,
           description, best_score, best_grade, scores_by_llm, updated_at, fetched_at
    FROM repos
    WHERE featured = 1
    ORDER BY best_score DESC
  `).all<RepoRow>();

    return result.results.map(rowToIndexEntry);
}

export async function getReposByCategory(category: RepoCategory, env?: DataEnv): Promise<RepoIndexEntry[]> {
    if (!env?.DB) {
        throw new Error('D1 database not available - env.DB is undefined');
    }

    const result = await env.DB.prepare(`
    SELECT owner, name, full_name, category, featured, stars, language,
           description, best_score, best_grade, scores_by_llm, updated_at, fetched_at
    FROM repos
    WHERE category = ?
    ORDER BY best_score DESC
  `).bind(category).all<RepoRow>();

    return result.results.map(rowToIndexEntry);
}

export async function getStaticRepoPaths(env?: DataEnv): Promise<{ params: { slug: string } }[]> {
    const index = await getRepoIndex(env);
    return Object.keys(index.repos).map((key) => ({
        params: { slug: key },
    }));
}

export function isCachedRepo(owner: string, name: string, index: RepoIndex): boolean {
    return `${owner}/${name}` in index.repos;
}
