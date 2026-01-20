import { ScoreBar } from '../ui/ScoreBar';
import type { RepoScore } from '../../lib/scoring';

interface DimensionBreakdownProps {
  score: RepoScore;
  llmName: string;
}

export function DimensionBreakdown({ score, llmName }: DimensionBreakdownProps) {
  // Guard against truly undefined score - only check core required fields
  // New fields like modelCapability and languageAI may not exist in older cached data
  if (!score || !score.coverage || !score.adoption) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold mb-4 text-white">
          Dimension Breakdown <span className="text-slate-400 font-normal">({llmName})</span>
        </h2>
        <p className="text-slate-400">Loading scores...</p>
      </div>
    );
  }

  // Provide defaults for dimensions that may not exist in cached data
  const languageAI = score.languageAI || {
    score: 50,
    details: { language: 'Unknown', score: 50 },
  };

  const modelCapability = score.modelCapability || {
    score: 85,
    details: { sweVerified: 80, humanEval: 90, debugging: 85, codeGeneration: 85 },
  };

  const aiReadiness = score.aiReadiness || {
    score: 50,
    details: { hasTypescript: false, hasLlmsTxt: false, hasClaudeMd: false, hasAgentMd: false, hasGoodTopics: true, hasLicense: true },
  };

  const documentation = score.documentation || {
    score: 50,
    details: { readmeSize: 3000, hasDocs: false, hasExamples: false, hasChangelog: false },
  };

  const momentum = score.momentum || {
    score: 50,
    details: { commitFrequency: 5, recentCommitsCount: 10, avgDaysBetweenReleases: 30 },
  };

  const maintenance = score.maintenance || {
    score: 50,
    details: { issueRatio: 0.01, avgPRCloseTimeHours: 48, recentClosedPRsCount: 10, openIssues: 50 },
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold mb-4 text-white">
        Dimension Breakdown <span className="text-slate-400 font-normal">({llmName})</span>
      </h2>

      <div className="mb-6">
        <DimensionRadar score={score} languageAI={languageAI} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
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
          score={languageAI.score}
          color="#f472b6"
          details={[
            { label: 'Language', value: languageAI.score, raw: languageAI.details.language as string },
          ]}
        />

        <DimensionSection
          name="AI Readiness"
          weight="20%"
          score={aiReadiness.score}
          color="#a855f7"
          flags={[
            { label: 'TypeScript', value: aiReadiness.details.hasTypescript as boolean },
            { label: 'llms.txt', value: aiReadiness.details.hasLlmsTxt as boolean },
            { label: 'Claude.md', value: aiReadiness.details.hasClaudeMd as boolean },
            { label: 'Agent.md', value: aiReadiness.details.hasAgentMd as boolean },
            { label: 'Good Topics', value: aiReadiness.details.hasGoodTopics as boolean },
            { label: 'License', value: aiReadiness.details.hasLicense as boolean },
          ]}
        />

        <DimensionSection
          name="Documentation"
          weight="10%"
          score={documentation.score}
          color="#f59e0b"
          flags={[
            { label: 'README', value: (documentation.details.readmeSize as number) > 2000 },
            { label: 'Docs', value: documentation.details.hasDocs as boolean },
            { label: 'Examples', value: documentation.details.hasExamples as boolean },
            { label: 'Changelog', value: documentation.details.hasChangelog as boolean },
          ]}
        />

        <DimensionSection
          name="Model Capability"
          weight="10%"
          score={modelCapability.score}
          color="#8b5cf6"
          details={[
            { label: 'SWE-bench Verified', value: modelCapability.details.sweVerified as number },
            { label: 'HumanEval', value: modelCapability.details.humanEval as number },
            { label: 'Debugging', value: modelCapability.details.debugging as number },
            { label: 'Code Generation', value: modelCapability.details.codeGeneration as number },
          ]}
        />

        <DimensionSection
          name="Adoption"
          weight="5%"
          score={score.adoption.score}
          color="#10b981"
          details={[
            { label: 'GitHub Stars', value: score.adoption.details.starScore as number, raw: formatNumber(score.adoption.details.stars as number) },
            { label: 'npm Downloads', value: score.adoption.details.downloadScore as number, raw: formatNumber(score.adoption.details.weeklyDownloads as number) + '/wk' },
            { label: 'Forks', value: score.adoption.details.forkScore as number, raw: formatNumber(score.adoption.details.forks as number) },
          ]}
        />

        <DimensionSection
          name="Momentum"
          weight="5%"
          score={momentum.score}
          color="#06b6d4"
          details={[
            { label: 'Commit Frequency', value: Math.min(100, (momentum.details.commitFrequency as number) * 10), raw: (momentum.details.commitFrequency as number).toFixed(1) + '/wk' },
            { label: 'Recent Commits', value: Math.min(100, (momentum.details.recentCommitsCount as number) * 3.33), raw: String(momentum.details.recentCommitsCount) },
          ]}
        />

        <DimensionSection
          name="Maintenance"
          weight="5%"
          score={maintenance.score}
          color="#ec4899"
          details={[
            { label: 'Issue Health', value: maintenance.details.issueRatio as number < 0.05 ? 75 : 25 },
            { label: 'PR Close Time', value: Math.max(0, 100 - (maintenance.details.avgPRCloseTimeHours as number) / 10), raw: Math.round(maintenance.details.avgPRCloseTimeHours as number) + 'h' },
          ]}
        />
      </div>
    </div>
  );
}

function DimensionRadar({ score, languageAI }: { score: RepoScore; languageAI: { score: number; details: Record<string, unknown> } }) {
  const size = 240;
  const center = size / 2;
  const maxRadius = 80;
  const labelRadius = 105;
  const levels = [0.25, 0.5, 0.75, 1];

  // Provide defaults for backwards compatibility with cached data
  const modelCapability = score.modelCapability || { score: 85 };
  const aiReadiness = score.aiReadiness || { score: 50 };
  const documentation = score.documentation || { score: 50 };
  const momentum = score.momentum || { score: 50 };
  const maintenance = score.maintenance || { score: 50 };

  const axes = [
    { label: 'Coverage', value: score.coverage.score, angle: -90 },
    { label: 'Lang AI', value: languageAI.score, angle: -45 },
    { label: 'AI Ready', value: aiReadiness.score, angle: 0 },
    { label: 'Docs', value: documentation.score, angle: 45 },
    { label: 'Model Cap', value: modelCapability.score, angle: 90 },
    { label: 'Adoption', value: score.adoption.score, angle: 135 },
    { label: 'Momentum', value: momentum.score, angle: 180 },
    { label: 'Maintain', value: maintenance.score, angle: 225 },
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
    <div className="bg-slate-800/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-medium text-white text-sm">{name}</span>
        <span className="text-xs text-slate-400">{weight}</span>
      </div>
      <ScoreBar label="" score={score} color={color} />

      {details && (
        <div className="mt-2 space-y-0.5">
          {details.map((d) => (
            <div key={d.label} className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 w-24 truncate">{d.label}</span>
              <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${d.value}%`, backgroundColor: color, opacity: 0.6 }}
                />
              </div>
              <span className="text-slate-400 text-xs w-14 text-right">{d.raw || d.value}</span>
            </div>
          ))}
        </div>
      )}

      {flags && (
        <div className="mt-2 flex flex-wrap gap-1">
          {flags.map((f) => (
            <span
              key={f.label}
              className={`text-xs px-1.5 py-0.5 rounded-full ${f.value
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
