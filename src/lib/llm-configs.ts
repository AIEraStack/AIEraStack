export interface LLMEvidence {
  sweBenchVerifiedResolved?: number; // % Resolved on SWE-bench Verified
  sourceUrl?: string; // Evidence source URL
}

export interface LLMProfile {
  // Dimension weight adjustments (multipliers on base weights)
  coverageWeight: number;
  adoptionWeight: number;
  documentationWeight: number;
  aiReadinessWeight: number;
  momentumWeight: number;
  maintenanceWeight: number;
  // Coverage decay factor (higher = slower decay for repos beyond cutoff)
  coverageDecayFactor: number;
}

export interface LLMConfig {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Anthropic' | 'Google';
  knowledgeCutoff: string;
  trainingCutoff: string;
  color: string;
  evidence?: LLMEvidence;
  profile: LLMProfile;
}

export const LLM_CONFIGS: LLMConfig[] = [
  {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2-Codex',
    provider: 'OpenAI',
    knowledgeCutoff: '2025-08-31',
    trainingCutoff: '2025-08-31',
    color: '#10a37f',
    evidence: {
      // No public SWE-bench Verified data for GPT-5.2-Codex yet
      sourceUrl: 'https://www.swebench.com/',
    },
    profile: {
      // Assumed strong code model: higher AI readiness & momentum weights
      coverageWeight: 1.0,
      adoptionWeight: 0.9,
      documentationWeight: 0.95,
      aiReadinessWeight: 1.15,
      momentumWeight: 1.1,
      maintenanceWeight: 1.0,
      coverageDecayFactor: 1.2, // Slower decay for code-focused model
    },
  },
  {
    id: 'claude-4.5-opus',
    name: 'Claude 4.5 (Opus/Sonnet)',
    provider: 'Anthropic',
    knowledgeCutoff: '2025-05-01',
    trainingCutoff: '2025-08-01',
    color: '#d4a574',
    evidence: {
      sweBenchVerifiedResolved: 49.0, // From SWE-bench Verified default leaderboard
      sourceUrl: 'https://www.swebench.com/',
    },
    profile: {
      // Strong on documentation understanding and code reasoning
      coverageWeight: 1.0,
      adoptionWeight: 0.95,
      documentationWeight: 1.1,
      aiReadinessWeight: 1.05,
      momentumWeight: 1.0,
      maintenanceWeight: 1.05,
      coverageDecayFactor: 1.1,
    },
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    provider: 'Google',
    knowledgeCutoff: '2025-01-01',
    trainingCutoff: '2025-01-01',
    color: '#4285f4',
    evidence: {
      sweBenchVerifiedResolved: 45.5, // From SWE-bench Verified default leaderboard
      sourceUrl: 'https://www.swebench.com/',
    },
    profile: {
      // Balanced profile with slight emphasis on adoption/momentum
      coverageWeight: 1.0,
      adoptionWeight: 1.05,
      documentationWeight: 1.0,
      aiReadinessWeight: 1.0,
      momentumWeight: 1.08,
      maintenanceWeight: 0.95,
      coverageDecayFactor: 1.0, // Standard decay
    },
  },
];

export function getLLMById(id: string): LLMConfig | undefined {
  return LLM_CONFIGS.find((llm) => llm.id === id);
}
