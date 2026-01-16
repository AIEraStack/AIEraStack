import { ScoreBar } from '../ui/ScoreBar';
import { LLM_CONFIGS, getLLMById } from '../../lib/llm-configs';
import type { AllLLMScores } from '../../lib/scoring';

interface LLMComparisonProps {
  scores: AllLLMScores;
  bestLLMId: string;
}

export function LLMComparison({ scores, bestLLMId }: LLMComparisonProps) {
  const sortedLLMs = [...LLM_CONFIGS].sort((a, b) => {
    return (scores[b.id]?.overall || 0) - (scores[a.id]?.overall || 0);
  });

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold mb-4 text-white">LLM Comparison</h2>
      <div className="space-y-3">
        {sortedLLMs.map((llm) => {
          const score = scores[llm.id];
          if (!score) return null;

          const isBest = llm.id === bestLLMId;

          return (
            <div
              key={llm.id}
              className={`relative ${isBest ? 'bg-slate-700/50 rounded-lg p-3 -mx-3' : ''}`}
            >
              {isBest && (
                <span className="absolute -top-2 -right-2 bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  BEST
                </span>
              )}
              <ScoreBar
                label={llm.name}
                score={score.overall}
                color={llm.color}
                showGrade
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
