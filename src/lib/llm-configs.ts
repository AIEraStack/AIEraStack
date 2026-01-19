export interface LLMConfig {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Anthropic' | 'Google';
  knowledgeCutoff: string;
  trainingCutoff: string;
  color: string;
}

export const LLM_CONFIGS: LLMConfig[] = [
  {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2-Codex',
    provider: 'OpenAI',
    knowledgeCutoff: '2025-08-31',
    trainingCutoff: '2025-08-31',
    color: '#10a37f',
  },
  {
    id: 'claude-4.5-opus',
    name: 'Claude 4.5 (Opus/Sonnet)',
    provider: 'Anthropic',
    knowledgeCutoff: '2025-03-01',
    trainingCutoff: '2025-08-01',
    color: '#d4a574',
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    provider: 'Google',
    knowledgeCutoff: '2025-01-01',
    trainingCutoff: '2025-01-01',
    color: '#4285f4',
  },
];

export function getLLMById(id: string): LLMConfig | undefined {
  return LLM_CONFIGS.find((llm) => llm.id === id);
}
