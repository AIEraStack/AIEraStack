/**
 * Batch Update Script for D1
 * 
 * Uses the shared fetchRepoData function from repo-fetcher.ts
 * to ensure consistent data fetching and scoring logic.
 */

import 'dotenv/config';
import curatedRepos from '../src/config/curated-repos.json' assert { type: 'json' };
import { fetchRepoData, findCuratedRepo } from '../src/lib/repo-fetcher';
import type { CuratedRepo, CachedRepoData } from '../src/lib/types';
import { DATA_VERSION } from '../src/lib/types';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.DATA_GITHUB_TOKEN;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const D1_DATABASE_ID = '68f2745c-b588-438d-b1e8-24d78ec402d3';

const repos = (curatedRepos as { repos: CuratedRepo[] }).repos;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function saveToD1(data: CachedRepoData): Promise<void> {
    // Calculate best score
    let bestScore = 0;
    let bestGrade = 'F';
    const scoresByLLM: Record<string, { overall: number; grade: string }> = {};

    for (const [llmId, llmScores] of Object.entries(data.scores)) {
        const score = llmScores.overall || 0;
        const grade = llmScores.grade || 'F';
        scoresByLLM[llmId] = { overall: score, grade };
        if (score > bestScore) {
            bestScore = score;
            bestGrade = grade;
        }
    }

    const escapeSQL = (s: string) => s.replace(/'/g, "''");

    const sql = `
    INSERT INTO repos (owner, name, full_name, category, featured, stars, language, description, 
                       best_score, best_grade, scores_by_llm, updated_at, fetched_at, data_version, data)
    VALUES ('${escapeSQL(data.owner)}', '${escapeSQL(data.name)}', '${escapeSQL(data.fullName)}',
            '${escapeSQL(data.category)}', ${data.featured ? 1 : 0}, ${data.repo.stars},
            '${escapeSQL(data.repo.language)}', '${escapeSQL((data.repo.description || '').substring(0, 500))}',
            ${bestScore}, '${bestGrade}', '${escapeSQL(JSON.stringify(scoresByLLM))}',
            '${data.repo.updatedAt}', '${data.fetchedAt}', ${DATA_VERSION}, '${escapeSQL(JSON.stringify(data))}')
    ON CONFLICT(owner, name) DO UPDATE SET
      full_name = excluded.full_name, category = excluded.category, featured = excluded.featured,
      stars = excluded.stars, language = excluded.language, description = excluded.description,
      best_score = excluded.best_score, best_grade = excluded.best_grade, scores_by_llm = excluded.scores_by_llm,
      updated_at = excluded.updated_at, fetched_at = excluded.fetched_at, data_version = excluded.data_version, data = excluded.data
  `;

    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`D1 API error: ${response.status} - ${error}`);
    }
}

async function processRepo(curatedRepo: CuratedRepo): Promise<void> {
    const { owner, name } = curatedRepo;
    console.log(`Processing ${owner}/${name}...`);

    try {
        // Use shared fetchRepoData - same logic as SSR pages
        const curatedMatch = findCuratedRepo(owner, name) || curatedRepo;
        const data = await fetchRepoData(owner, name, curatedMatch, GITHUB_TOKEN);

        await saveToD1(data);

        const bestScore = Math.max(...Object.values(data.scores).map(s => s.overall));
        console.log(`  ✓ ${owner}/${name} - Score: ${bestScore}`);
    } catch (error) {
        console.error(`  ✗ ${owner}/${name} - Error:`, error instanceof Error ? error.message : error);
        throw error;
    }
}

async function main() {
    console.log('=== D1 Batch Update ===\n');
    console.log(`Using shared fetchRepoData from repo-fetcher.ts`);
    console.log(`Found ${repos.length} curated repos\n`);

    if (!GITHUB_TOKEN) {
        console.error('Error: GITHUB_TOKEN or DATA_GITHUB_TOKEN is required');
        process.exit(1);
    }

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
        console.error('Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required');
        process.exit(1);
    }

    let processed = 0, errors = 0;

    for (const repo of repos) {
        try {
            await processRepo(repo);
            processed++;
        } catch {
            errors++;
        }
        await delay(1500); // Rate limit
    }

    console.log(`\n=== Complete ===`);
    console.log(`Processed: ${processed}, Errors: ${errors}`);
}

main().catch(console.error);
