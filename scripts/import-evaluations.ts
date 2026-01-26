/**
 * Import generated evaluation JSON files into D1 database
 *
 * Usage: npx tsx scripts/import-evaluations.ts
 */

import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EVALUATIONS_DIR = join(__dirname, 'evaluations');
const CURATED_REPOS_PATH = join(__dirname, '..', 'src', 'config', 'curated-repos.json');
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const D1_DATABASE_ID = '68f2745c-b588-438d-b1e8-24d78ec402d3';

// Load curated repos to get canonical repo names per category
interface CuratedRepo {
  owner: string;
  name: string;
  category: string;
}
const curatedReposData = JSON.parse(readFileSync(CURATED_REPOS_PATH, 'utf8')) as { repos: CuratedRepo[] };

function getCanonicalReposForCategory(category: string): string[] {
  return curatedReposData.repos
    .filter(r => r.category === category)
    .map(r => `${r.owner}/${r.name}`);
}

interface ComparisonEvaluation {
  id?: string;
  repos: string[];
  category?: string;
  modelUsed?: string;
  generatedAt?: string;
  [key: string]: unknown;
}

function calculateId(repos: string[]): string {
  const sorted = [...repos].sort();
  return createHash('sha256').update(sorted.join('|')).digest('hex').slice(0, 16);
}

async function executeD1Query(sql: string): Promise<void> {
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

  const result = await response.json() as { success: boolean; errors?: { message: string }[] };
  if (!result.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(result.errors)}`);
  }
}

function escapeSQL(s: string): string {
  return s.replace(/'/g, "''");
}

async function importEvaluation(filePath: string, fileName: string): Promise<void> {
  const content = readFileSync(filePath, 'utf8');
  let evaluation: ComparisonEvaluation;

  try {
    evaluation = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${fileName}: ${error}`);
  }

  // Validate required fields
  if (!evaluation.repos || !Array.isArray(evaluation.repos) || evaluation.repos.length === 0) {
    throw new Error(`Missing or invalid repos array in ${fileName}`);
  }

  // Extract category from filename if not in evaluation
  const category = evaluation.category || fileName.replace('.json', '');

  // Use canonical repos from curated-repos.json to ensure ID matches URL lookups
  const canonicalRepos = getCanonicalReposForCategory(category);
  if (canonicalRepos.length > 0) {
    console.log(`  Using canonical repos for ${category}:`, canonicalRepos.join(', '));
    evaluation.repos = canonicalRepos;
  }

  // Calculate/override ID to ensure consistency
  evaluation.id = calculateId(evaluation.repos);
  console.log(`  Calculated ID: ${evaluation.id}`);

  // Ensure timestamps
  if (!evaluation.generatedAt) {
    evaluation.generatedAt = new Date().toISOString();
  }

  const sql = `
    INSERT INTO comparison_evaluations
      (id, repos, repos_count, category, evaluation, model_used, generated_at)
    VALUES (
      '${escapeSQL(evaluation.id)}',
      '${escapeSQL(JSON.stringify(evaluation.repos))}',
      ${evaluation.repos.length},
      ${category ? `'${escapeSQL(category)}'` : 'NULL'},
      '${escapeSQL(JSON.stringify(evaluation))}',
      ${evaluation.modelUsed ? `'${escapeSQL(evaluation.modelUsed)}'` : "'claude-haiku'"},
      '${escapeSQL(evaluation.generatedAt)}'
    )
    ON CONFLICT(id) DO UPDATE SET
      evaluation = excluded.evaluation,
      model_used = excluded.model_used,
      generated_at = excluded.generated_at,
      updated_at = datetime('now')
  `;

  await executeD1Query(sql);
}

async function main() {
  console.log('=== Import Evaluations to D1 ===\n');

  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    console.error('Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required');
    console.error('Set them in .env file or environment variables');
    process.exit(1);
  }

  // Check if evaluations directory exists
  let files: string[];
  try {
    files = readdirSync(EVALUATIONS_DIR).filter(f => f.endsWith('.json'));
  } catch (error) {
    console.error(`Error: Evaluations directory not found at ${EVALUATIONS_DIR}`);
    console.error('Run generate-evaluations.sh first to create evaluation files.');
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('No evaluation files found in', EVALUATIONS_DIR);
    console.log('Run generate-evaluations.sh first.');
    process.exit(0);
  }

  console.log(`Found ${files.length} evaluation files\n`);

  let imported = 0;
  let errors = 0;

  for (const file of files) {
    const filePath = join(EVALUATIONS_DIR, file);
    try {
      await importEvaluation(filePath, file);
      console.log(`  ✓ Imported: ${file}`);
      imported++;
    } catch (error) {
      console.error(`  ✗ Failed: ${file}`, error instanceof Error ? error.message : error);
      errors++;
    }
  }

  console.log('\n=== Import Complete ===');
  console.log(`Imported: ${imported}`);
  console.log(`Errors: ${errors}`);

  if (imported > 0) {
    console.log('\nVerify with:');
    console.log('  wrangler d1 execute DB --command "SELECT category, repos_count FROM comparison_evaluations"');
  }
}

main().catch(console.error);
