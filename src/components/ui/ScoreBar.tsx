interface ScoreBarProps {
  score: number;
  label: string;
  color?: string;
  showGrade?: boolean;
}

export function ScoreBar({ score, label, color = '#6366f1', showGrade = false }: ScoreBarProps) {
  const grade = getGrade(score);
  const gradeColor = getGradeColor(grade);

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-32 text-sm text-slate-300 truncate">{label}</span>
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="w-8 text-sm text-right font-mono">{score}</span>
      {showGrade && (
        <span
          className="w-6 text-sm font-bold text-center"
          style={{ color: gradeColor }}
        >
          {grade}
        </span>
      )}
    </div>
  );
}

function getGrade(score: number): string {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    A: '#22c55e',
    B: '#84cc16',
    C: '#eab308',
    D: '#f97316',
    F: '#ef4444',
  };
  return colors[grade] || '#94a3b8';
}
