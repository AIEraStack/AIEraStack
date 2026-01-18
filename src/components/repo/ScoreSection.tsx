import { useState } from 'react';
import { LLMComparison } from './LLMComparison';
import { DimensionBreakdown } from './DimensionBreakdown';
import { getLLMById } from '../../lib/llm-configs';
import type { AllLLMScores } from '../../lib/scoring';

interface ScoreSectionProps {
  scores: AllLLMScores;
  defaultLLMId: string;
}

export function ScoreSection({ scores, defaultLLMId }: ScoreSectionProps) {
  // Ensure initial LLM ID is valid
  const getValidLLMId = () => {
    if (scores[defaultLLMId]) return defaultLLMId;
    const bestId = getBestLLM(scores);
    if (scores[bestId]) return bestId;
    return Object.keys(scores)[0] || defaultLLMId;
  };
  
  const [selectedLLMId, setSelectedLLMId] = useState(getValidLLMId());
  
  const bestLLMId = getBestLLM(scores);
  const selectedScore = scores[selectedLLMId];
  const selectedLLM = getLLMById(selectedLLMId);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <LLMComparison 
        scores={scores} 
        bestLLMId={bestLLMId}
        selectedLLMId={selectedLLMId}
        onSelectLLM={setSelectedLLMId}
      />
      
      {selectedScore && (
        <DimensionBreakdown 
          score={selectedScore} 
          llmName={selectedLLM?.name || selectedLLMId} 
        />
      )}
    </div>
  );
}

function getBestLLM(scores: AllLLMScores): string {
  let bestId = '';
  let bestScore = -1;
  for (const [id, score] of Object.entries(scores)) {
    if (score.overall > bestScore) {
      bestScore = score.overall;
      bestId = id;
    }
  }
  // If no best ID found, return the first available LLM ID
  if (!bestId && Object.keys(scores).length > 0) {
    bestId = Object.keys(scores)[0];
  }
  return bestId || 'gpt-5.2-codex';
}
