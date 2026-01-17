import { ScoreBar } from '../ui/ScoreBar';
import type { RepoScore } from '../../lib/scoring';

interface DimensionBreakdownProps {
  score: RepoScore;
  llmName: string;
}

export function DimensionBreakdown({ score, llmName }: DimensionBreakdownProps) {
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
          name="Timeliness"
          weight="35%"
          score={score.timeliness.score}
          color="#6366f1"
          details={[
            { label: 'Release Coverage', value: score.timeliness.details.releaseScore as number },
            { label: 'Activity Coverage', value: score.timeliness.details.activityScore as number },
            { label: 'Project Maturity', value: score.timeliness.details.maturityScore as number },
          ]}
        />

        <DimensionSection
          name="Popularity"
          weight="30%"
          score={score.popularity.score}
          color="#10b981"
          details={[
            { label: 'GitHub Stars', value: score.popularity.details.starScore as number, raw: formatNumber(score.popularity.details.stars as number) },
            { label: 'npm Downloads', value: score.popularity.details.downloadScore as number, raw: formatNumber(score.popularity.details.weeklyDownloads as number) + '/wk' },
            { label: 'Forks', value: score.popularity.details.forkScore as number, raw: formatNumber(score.popularity.details.forks as number) },
          ]}
        />

        <DimensionSection
          name="AI Friendliness"
          weight="20%"
          score={score.aiFriendliness.score}
          color="#f59e0b"
          flags={[
            { label: 'TypeScript', value: score.aiFriendliness.details.hasTypescript as boolean },
            { label: 'llms.txt', value: score.aiFriendliness.details.hasLlmsTxt as boolean },
            { label: 'Good Topics', value: score.aiFriendliness.details.hasGoodTopics as boolean },
            { label: 'Maintained', value: score.aiFriendliness.details.isWellMaintained as boolean },
            { label: 'License', value: score.aiFriendliness.details.hasLicense as boolean },
          ]}
        />

        <DimensionSection
          name="Community"
          weight="15%"
          score={score.community.score}
          color="#ec4899"
          details={[
            { label: 'Issue Health', value: score.community.details.healthyIssueRatio ? 75 : 25 },
          ]}
        />
      </div>
    </div>
  );
}

function DimensionRadar({ score }: { score: RepoScore }) {
  const size = 220;
  const center = size / 2;
  const maxRadius = 70;
  const labelRadius = 96;
  const levels = [0.25, 0.5, 0.75, 1];

  const axes = [
    { label: 'Timeliness', value: score.timeliness.score, angle: -90 },
    { label: 'Popularity', value: score.popularity.score, angle: 0 },
    { label: 'AI Friendliness', value: score.aiFriendliness.score, angle: 90 },
    { label: 'Community', value: score.community.score, angle: 180 },
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
          const textAnchor = axis.angle === 0 ? 'start' : axis.angle === 180 ? 'end' : 'middle';
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
              className={`text-xs px-2 py-1 rounded-full ${
                f.value
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
