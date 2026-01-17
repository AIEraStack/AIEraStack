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
  const [selectedLLMId, setSelectedLLMId] = useState(defaultLLMId);
  
  const bestLLMId = getBestLLM(scores);
  const selectedScore = scores[selectedLLMId];
  const selectedLLM = getLLMById(selectedLLMId);

  return (
    <div className="space-y-8">
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
  return bestId;
}
