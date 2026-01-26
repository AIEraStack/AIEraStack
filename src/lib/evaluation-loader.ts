/**
 * Evaluation Loader - Load AI-generated comparison evaluations from D1
 */

import { createHash } from 'crypto';
import type { DataEnv } from './d1-data-loader';

// Types for AI evaluation data
export type EvaluationDimension = 'coverage' | 'aiReadiness' | 'documentation' | 'adoption' | 'momentum' | 'maintenance';
export type EvaluationVerdict = 'highly-recommended' | 'recommended' | 'consider' | 'not-recommended';

export interface ComparisonEvaluation {
  id: string;                    // SHA256 of sorted repo slugs (truncated)
  repos: string[];               // ["facebook/react", "vuejs/core", ...]
  category?: string;             // category id if applicable
  categoryLabel?: string;        // "Core Frameworks"

  // Summary
  summary: string;               // 2-3 sentence overall comparison summary

  // Scenario-based recommendations
  recommendations: {
    forNewProjects: {
      repo: string;              // "facebook/react"
      reason: string;            // Why recommended
    };
    forAICoding: {
      repo: string;
      reason: string;
    };
    forMigrations: {
      repo: string;
      reason: string;
    };
  };

  // Detailed per-repo rankings
  rankings: {
    repoSlug: string;            // "facebook/react"
    rank: number;                // 1, 2, 3...
    verdict: EvaluationVerdict;
    strengths: string[];         // 2-3 key strengths
    weaknesses: string[];        // 2-3 key weaknesses
    bestFor: string;             // "Best for X scenario"
  }[];

  // Per-dimension analysis
  dimensionInsights: {
    dimension: EvaluationDimension;
    dimensionLabel: string;      // "Coverage", "AI Readiness" etc
    winner: string;              // Winning repo for this dimension
    insight: string;             // Why they won
    comparison: {
      repo: string;
      score: number;
      note?: string;             // Optional brief note
    }[];
  }[];

  // Metadata
  modelUsed?: string;
  generatedAt: string;
}

/**
 * Calculate unique ID for a set of repos
 * Uses SHA256 of sorted repo slugs, truncated to 16 chars
 */
export function calculateEvaluationId(repos: string[]): string {
  const sorted = [...repos].sort();
  const hash = createHash('sha256').update(sorted.join('|')).digest('hex');
  return hash.slice(0, 16);
}

/**
 * Get evaluation by repo slugs
 */
export async function getEvaluation(
  repos: string[],
  env: DataEnv
): Promise<ComparisonEvaluation | null> {
  if (!env?.DB) {
    return null;
  }

  const id = calculateEvaluationId(repos);
  return getEvaluationById(id, env);
}

/**
 * Get evaluation by ID
 */
export async function getEvaluationById(
  id: string,
  env: DataEnv
): Promise<ComparisonEvaluation | null> {
  if (!env?.DB) return null;

  try {
    const row = await env.DB.prepare(`
      SELECT evaluation FROM comparison_evaluations WHERE id = ?
    `).bind(id).first<{ evaluation: string }>();

    if (!row) return null;
    return JSON.parse(row.evaluation);
  } catch (error) {
    console.error('Error fetching evaluation by ID:', error);
    return null;
  }
}

/**
 * Get evaluation by category
 */
export async function getEvaluationByCategory(
  category: string,
  env: DataEnv
): Promise<ComparisonEvaluation | null> {
  if (!env?.DB) return null;

  try {
    const row = await env.DB.prepare(`
      SELECT evaluation FROM comparison_evaluations WHERE category = ?
    `).bind(category).first<{ evaluation: string }>();

    if (!row) return null;
    return JSON.parse(row.evaluation);
  } catch (error) {
    console.error('Error fetching evaluation by category:', error);
    return null;
  }
}

/**
 * Get all evaluations (for debugging/admin)
 */
export async function getAllEvaluations(
  env: DataEnv
): Promise<ComparisonEvaluation[]> {
  if (!env?.DB) return [];

  try {
    const result = await env.DB.prepare(`
      SELECT evaluation FROM comparison_evaluations ORDER BY created_at DESC
    `).all<{ evaluation: string }>();

    return result.results.map(row => JSON.parse(row.evaluation));
  } catch (error) {
    console.error('Error fetching all evaluations:', error);
    return [];
  }
}
