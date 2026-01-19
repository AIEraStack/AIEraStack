export interface LLMCodingBenchmarks {
  /** SWE-bench Verified score (0-100) - real-world software engineering */
  sweVerified: number;
  /** HumanEval score (0-100) - algorithmic problem solving */
  humanEval: number;
  /** Debugging capability (0-100) - based on expert assessment */
  debugging: number;
  /** Overall code generation quality (0-100) */
  codeGeneration: number;
}

export interface LLMConfig {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Anthropic' | 'Google';
  knowledgeCutoff: string;
  trainingCutoff: string;
  color: string;
  /** Coding benchmark scores for capability comparison */
  benchmarks: LLMCodingBenchmarks;
}

export const LLM_CONFIGS: LLMConfig[] = [
  {
    id: 'claude-4.5-opus',
    name: 'Claude 4.5 Opus',
    provider: 'Anthropic',
    knowledgeCutoff: '2025-03-01',
    trainingCutoff: '2025-08-01',
    color: '#d4a574',
    benchmarks: {
      sweVerified: 81, // 80.9% - first to break 80%
      humanEval: 92,
      debugging: 95, // recognized as best for debugging
      codeGeneration: 92,
    },
  },
  {
    id: 'claude-4.5-sonnet',
    name: 'Claude 4.5 Sonnet',
    provider: 'Anthropic',
    knowledgeCutoff: '2025-03-01',
    trainingCutoff: '2025-08-01',
    color: '#cc9966',
    benchmarks: {
      sweVerified: 77, // 77.2%
      humanEval: 92,
      debugging: 90,
      codeGeneration: 88,
    },
  },
  {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2-Codex',
    provider: 'OpenAI',
    knowledgeCutoff: '2025-08-31',
    trainingCutoff: '2025-08-31',
    color: '#10a37f',
    benchmarks: {
      sweVerified: 80, // 80% Verified, 56.4% Pro
      humanEval: 90,
      debugging: 85,
      codeGeneration: 90,
    },
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    provider: 'Google',
    knowledgeCutoff: '2025-01-01',
    trainingCutoff: '2025-01-01',
    color: '#4285f4',
    benchmarks: {
      sweVerified: 76, // 76.2%
      humanEval: 84,
      debugging: 80,
      codeGeneration: 82,
    },
  },
];

export function getLLMById(id: string): LLMConfig | undefined {
  return LLM_CONFIGS.find((llm) => llm.id === id);
}

/**
 * Calculate a benchmark factor (0.9-1.1) based on LLM coding capabilities.
 * Used to adjust AI-related dimension scores.
 * Baseline: ~85 average = factor of 1.0
 */
export function getBenchmarkFactor(benchmarks: LLMCodingBenchmarks): number {
  const avgBenchmark =
    benchmarks.sweVerified * 0.4 +
    benchmarks.humanEval * 0.3 +
    benchmarks.debugging * 0.2 +
    benchmarks.codeGeneration * 0.1;

  // Convert to 0.9-1.1 range (85 = 1.0 baseline)
  return Math.max(0.9, Math.min(1.1, 0.9 + (avgBenchmark - 70) / 100));
}

