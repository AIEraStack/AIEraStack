import { ScoreBar } from '../ui/ScoreBar';
import type { RepoScore } from '../../lib/scoring';

interface DimensionBreakdownProps {
  score: RepoScore;
  llmName: string;
}

export function DimensionBreakdown({ score, llmName }: DimensionBreakdownProps) {
  // Guard against undefined score
  if (!score || !score.coverage || !score.languageAI || !score.aiReadiness || !score.documentation || !score.adoption || !score.momentum || !score.maintenance) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold mb-4 text-white">
          Dimension Breakdown <span className="text-slate-400 font-normal">({llmName})</span>
        </h2>
        <p className="text-slate-400">Loading scores...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold mb-4 text-white">
        Dimension Breakdown <span className="text-slate-400 font-normal">({llmName})</span>
      </h2>

      <div className="mb-6">
        <DimensionRadar score={score} />
      </div>

      <div className="space-y-6">
        <DimensionSection
          name="Coverage"
          weight="25%"
          score={score.coverage.score}
          color="#6366f1"
          details={[
            { label: 'Release Coverage', value: score.coverage.details.releaseScore as number },
            { label: 'Activity Coverage', value: score.coverage.details.activityScore as number },
            { label: 'Project Maturity', value: score.coverage.details.maturityScore as number },
          ]}
        />

        <DimensionSection
          name="Language AI"
          weight="20%"
          score={score.languageAI.score}
          color="#f472b6"
          details={[
            { label: 'Language', value: score.languageAI.score, raw: score.languageAI.details.language as string },
          ]}
        />

        <DimensionSection
          name="AI Readiness"
          weight="20%"
          score={score.aiReadiness.score}
          color="#a855f7"
          flags={[
            { label: 'TypeScript', value: score.aiReadiness.details.hasTypescript as boolean },
            { label: 'llms.txt', value: score.aiReadiness.details.hasLlmsTxt as boolean },
            { label: 'Claude.md', value: score.aiReadiness.details.hasClaudeMd as boolean },
            { label: 'Agent.md', value: score.aiReadiness.details.hasAgentMd as boolean },
            { label: 'Good Topics', value: score.aiReadiness.details.hasGoodTopics as boolean },
            { label: 'License', value: score.aiReadiness.details.hasLicense as boolean },
          ]}
        />

        <DimensionSection
          name="Documentation"
          weight="15%"
          score={score.documentation.score}
          color="#f59e0b"
          flags={[
            { label: 'README', value: (score.documentation.details.readmeSize as number) > 2000 },
            { label: 'Docs', value: score.documentation.details.hasDocs as boolean },
            { label: 'Examples', value: score.documentation.details.hasExamples as boolean },
            { label: 'Changelog', value: score.documentation.details.hasChangelog as boolean },
          ]}
        />

        <DimensionSection
          name="Adoption"
          weight="10%"
          score={score.adoption.score}
          color="#10b981"
          details={[
            { label: 'GitHub Stars', value: score.adoption.details.starScore as number, raw: formatNumber(score.adoption.details.stars as number) },
            { label: 'npm Downloads', value: score.adoption.details.downloadScore as number, raw: formatNumber(score.adoption.details.weeklyDownloads as number) + '/wk' },
            { label: 'Forks', value: score.adoption.details.forkScore as number, raw: formatNumber(score.adoption.details.forks as number) },
          ]}
        />

        <DimensionSection
          name="Documentation"
          weight="15%"
          score={score.documentation.score}
          color="#f59e0b"
          flags={[
            { label: 'README', value: (score.documentation.details.readmeSize as number) > 2000 },
            { label: 'Docs', value: score.documentation.details.hasDocs as boolean },
            { label: 'Examples', value: score.documentation.details.hasExamples as boolean },
            { label: 'Changelog', value: score.documentation.details.hasChangelog as boolean },
          ]}
        />

        <DimensionSection
          name="AI Readiness"
          weight="15%"
          score={score.aiReadiness.score}
          color="#a855f7"
          flags={[
            { label: 'TypeScript', value: score.aiReadiness.details.hasTypescript as boolean },
            { label: 'llms.txt', value: score.aiReadiness.details.hasLlmsTxt as boolean },
            { label: 'Claude.md', value: score.aiReadiness.details.hasClaudeMd as boolean },
            { label: 'Agent.md', value: score.aiReadiness.details.hasAgentMd as boolean },
            { label: 'Good Topics', value: score.aiReadiness.details.hasGoodTopics as boolean },
            { label: 'License', value: score.aiReadiness.details.hasLicense as boolean },
          ]}
        />

        <DimensionSection
          name="Momentum"
          weight="5%"
          score={score.momentum.score}
          color="#06b6d4"
          details={[
            { label: 'Commit Frequency', value: Math.min(100, (score.momentum.details.commitFrequency as number) * 10), raw: (score.momentum.details.commitFrequency as number).toFixed(1) + '/wk' },
            { label: 'Recent Commits', value: Math.min(100, (score.momentum.details.recentCommitsCount as number) * 3.33), raw: String(score.momentum.details.recentCommitsCount) },
          ]}
        />

        <DimensionSection
          name="Maintenance"
          weight="5%"
          score={score.maintenance.score}
          color="#ec4899"
          details={[
            { label: 'Issue Health', value: score.maintenance.details.issueRatio as number < 0.05 ? 75 : 25 },
            { label: 'PR Close Time', value: Math.max(0, 100 - (score.maintenance.details.avgPRCloseTimeHours as number) / 10), raw: Math.round(score.maintenance.details.avgPRCloseTimeHours as number) + 'h' },
          ]}
        />
      </div>
    </div>
  );
}

function DimensionRadar({ score }: { score: RepoScore }) {
  const size = 240;
  const center = size / 2;
  const maxRadius = 80;
  const labelRadius = 105;
  const levels = [0.25, 0.5, 0.75, 1];

  const axes = [
    { label: 'Coverage', value: score.coverage.score, angle: -90 },
    { label: 'Language AI', value: score.languageAI.score, angle: -38.6 },
    { label: 'AI Readiness', value: score.aiReadiness.score, angle: 12.8 },
    { label: 'Documentation', value: score.documentation.score, angle: 64.3 },
    { label: 'Adoption', value: score.adoption.score, angle: 115.7 },
    { label: 'Momentum', value: score.momentum.score, angle: 167.1 },
    { label: 'Maintenance', value: score.maintenance.score, angle: 218.6 },
  ];

  const toPoint = (angleDeg: number, radius: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: center + Math.cos(rad) * radius,
      y: center + Math.sin(rad) * radius,
    };
  };

  const clampScore = (value: number) => Math.max(0, Math.min(100, value));
  const pointsForRadius = (radius: number) =>
    axes
      .map((axis) => {
        const { x, y } = toPoint(axis.angle, radius);
        return `${x},${y}`;
      })
      .join(' ');

  const valuePoints = axes
    .map((axis) => toPoint(axis.angle, (clampScore(axis.value) / 100) * maxRadius))
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  return (
    <div className="flex justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Dimension radar chart"
        className="w-full max-w-[280px]"
      >
        <title>Dimension radar chart</title>

        {levels.map((level) => (
          <polygon
            key={level}
            points={pointsForRadius(maxRadius * level)}
            fill="none"
            stroke="rgba(148, 163, 184, 0.3)"
            strokeWidth="1"
          />
        ))}

        {axes.map((axis) => {
          const { x, y } = toPoint(axis.angle, maxRadius);
          return (
            <line
              key={axis.label}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(148, 163, 184, 0.35)"
              strokeWidth="1"
            />
          );
        })}

        <polygon
          points={valuePoints}
          fill="rgba(34, 211, 238, 0.15)"
          stroke="#22d3ee"
          strokeWidth="2"
        />

        {axes.map((axis) => {
          const { x, y } = toPoint(axis.angle, (clampScore(axis.value) / 100) * maxRadius);
          return (
            <circle
              key={`${axis.label}-point`}
              cx={x}
              cy={y}
              r="3"
              fill="#22d3ee"
              stroke="rgba(15, 23, 42, 0.6)"
              strokeWidth="1"
            />
          );
        })}

        {axes.map((axis) => {
          const { x, y } = toPoint(axis.angle, labelRadius);
          const textAnchor =
            Math.abs(axis.angle) < 45 || Math.abs(axis.angle - 360) < 45 ? 'start' :
              Math.abs(axis.angle - 180) < 45 ? 'end' : 'middle';
          return (
            <text
              key={`${axis.label}-label`}
              x={x}
              y={y}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              fontSize="10"
              fill="#94a3b8"
            >
              {axis.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

interface DimensionSectionProps {
  name: string;
  weight: string;
  score: number;
  color: string;
  details?: { label: string; value: number; raw?: string }[];
  flags?: { label: string; value: boolean }[];
}

function DimensionSection({ name, weight, score, color, details, flags }: DimensionSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-white">{name}</span>
        <span className="text-xs text-slate-400">{weight}</span>
      </div>
      <ScoreBar label="" score={score} color={color} />

      {details && (
        <div className="mt-2 pl-4 space-y-1">
          {details.map((d) => (
            <div key={d.label} className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 w-32">{d.label}</span>
              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${d.value}%`, backgroundColor: color, opacity: 0.6 }}
                />
              </div>
              <span className="text-slate-400 text-xs w-16 text-right">{d.raw || d.value}</span>
            </div>
          ))}
        </div>
      )}

      {flags && (
        <div className="mt-2 pl-4 flex flex-wrap gap-2">
          {flags.map((f) => (
            <span
              key={f.label}
              className={`text-xs px-2 py-1 rounded-full ${f.value
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-slate-700 text-slate-500'
                }`}
            >
              {f.value ? '✓' : '✗'} {f.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
