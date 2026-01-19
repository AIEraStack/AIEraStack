/**
 * Language AI Friendliness Scores
 *
 * Scores based on:
 * - generation: How well can LLMs generate correct code in this language?
 * - debugging: How easy is it to debug LLM-generated code errors?
 *
 * Based on:
 * - GitHub Octoverse 2025 language popularity (training data proxy)
 * - Language complexity and type system characteristics
 * - Error message readability
 */

export interface LanguageAIScore {
    generation: number; // 0-100: AI code generation accuracy
    debugging: number; // 0-100: Error debuggability
}

export const LANGUAGE_AI_SCORES: Record<string, LanguageAIScore> = {
    // Tier 1: Excellent AI support (80-100)
    TypeScript: { generation: 100, debugging: 100 },
    JavaScript: { generation: 95, debugging: 80 },
    Python: { generation: 95, debugging: 95 },

    // Tier 2: Good AI support (60-80)
    Java: { generation: 80, debugging: 85 },
    'C#': { generation: 80, debugging: 85 },
    Kotlin: { generation: 75, debugging: 80 },
    Swift: { generation: 75, debugging: 80 },
    Go: { generation: 70, debugging: 90 },
    PHP: { generation: 70, debugging: 75 },
    Ruby: { generation: 70, debugging: 80 },

    // Tier 3: Moderate AI support (40-60)
    Rust: { generation: 60, debugging: 40 },
    Scala: { generation: 60, debugging: 60 },
    'Objective-C': { generation: 55, debugging: 55 },

    // Tier 4: Limited AI support (20-40)
    C: { generation: 50, debugging: 35 },
    'C++': { generation: 50, debugging: 30 },
    Haskell: { generation: 40, debugging: 45 },

    // Default for unknown languages
    Other: { generation: 50, debugging: 50 },
};

/**
 * Get the combined AI score for a language
 * Weights: generation 60%, debugging 40%
 */
export function getLanguageAIScore(language: string | null): number {
    if (!language) return 50;

    const scores = LANGUAGE_AI_SCORES[language] || LANGUAGE_AI_SCORES.Other;
    return Math.round(scores.generation * 0.6 + scores.debugging * 0.4);
}

/**
 * Get detailed scores for a language
 */
export function getLanguageAIDetails(
    language: string | null
): LanguageAIScore & { overall: number } {
    const lang = language || 'Other';
    const scores = LANGUAGE_AI_SCORES[lang] || LANGUAGE_AI_SCORES.Other;
    return {
        ...scores,
        overall: getLanguageAIScore(language),
    };
}
