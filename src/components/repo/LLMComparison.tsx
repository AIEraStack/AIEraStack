import { ScoreBar } from '../ui/ScoreBar';
import { LLM_CONFIGS, getLLMById } from '../../lib/llm-configs';
import type { AllLLMScores } from '../../lib/scoring';

interface LLMComparisonProps {
  scores: AllLLMScores;
  bestLLMId: string;
  selectedLLMId?: string;
  onSelectLLM?: (llmId: string) => void;
}

export function LLMComparison({ scores, bestLLMId, selectedLLMId, onSelectLLM }: LLMComparisonProps) {
  const sortedLLMs = [...LLM_CONFIGS].sort((a, b) => {
    return (scores[b.id]?.overall || 0) - (scores[a.id]?.overall || 0);
  });

  const isInteractive = !!onSelectLLM;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold mb-4 text-white">
        LLM Comparison
        {isInteractive && <span className="text-xs font-normal text-slate-400 ml-2">(click to view breakdown)</span>}
      </h2>
      <div className="space-y-3">
        {sortedLLMs.map((llm) => {
          const score = scores[llm.id];
          if (!score) return null;

          const isBest = llm.id === bestLLMId;
          const isSelected = llm.id === selectedLLMId;

          return (
            <div
              key={llm.id}
              onClick={() => onSelectLLM?.(llm.id)}
              className={`relative transition-all duration-200 ${
                isInteractive ? 'cursor-pointer hover:bg-slate-700/30 rounded-lg' : ''
              } ${
                isSelected 
                  ? 'bg-slate-700/70 rounded-lg p-3 -mx-3 ring-2 ring-cyan-500/50' 
                  : isBest 
                    ? 'bg-slate-700/50 rounded-lg p-3 -mx-3' 
                    : isInteractive ? 'p-3 -mx-3' : ''
              }`}
            >
              {isBest && (
                <span className="absolute -top-2 -right-2 bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  BEST
                </span>
              )}
              {isSelected && !isBest && (
                <span className="absolute -top-2 -right-2 bg-cyan-500 text-cyan-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  SELECTED
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
