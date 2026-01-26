import type { ComparisonEvaluation, EvaluationVerdict } from '../../lib/evaluation-loader';

interface AIEvaluationCardProps {
  evaluation: ComparisonEvaluation;
}

function getVerdictBadge(verdict: EvaluationVerdict) {
  const styles: Record<EvaluationVerdict, { bg: string; text: string; label: string }> = {
    'highly-recommended': { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Highly Recommended' },
    'recommended': { bg: 'bg-lime-500/20', text: 'text-lime-400', label: 'Recommended' },
    'consider': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Consider' },
    'not-recommended': { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Not Recommended' },
  };
  return styles[verdict] || styles['consider'];
}

function getRankBadge(rank: number) {
  if (rank === 1) return { icon: '🥇', label: '1st' };
  if (rank === 2) return { icon: '🥈', label: '2nd' };
  if (rank === 3) return { icon: '🥉', label: '3rd' };
  return { icon: '', label: `${rank}th` };
}

export function AIEvaluationCard({ evaluation }: AIEvaluationCardProps) {
  const { summary, recommendations, rankings, categoryLabel, generatedAt } = evaluation;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b border-white/10">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🤖</span>
              <h2 className="text-xl font-bold text-white">AI Evaluation</h2>
              {categoryLabel && (
                <span className="px-3 py-1 text-sm bg-purple-500/20 text-purple-300 rounded-full">
                  {categoryLabel}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              Generated {generatedAt ? new Date(generatedAt).toLocaleDateString() : 'recently'}
            </p>
          </div>
        </div>

        {/* Summary */}
        <p className="text-slate-300 text-base leading-relaxed">{summary}</p>
      </div>

      {/* Scenario Recommendations */}
      <div className="p-8 border-b border-white/10">
        <h3 className="text-base font-semibold text-white mb-6">Recommendations by Scenario</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <RecommendationCard
            title="New Projects"
            icon="🚀"
            repo={recommendations.forNewProjects.repo}
            reason={recommendations.forNewProjects.reason}
          />
          <RecommendationCard
            title="AI Coding"
            icon="🤖"
            repo={recommendations.forAICoding.repo}
            reason={recommendations.forAICoding.reason}
          />
          <RecommendationCard
            title="Migrations"
            icon="🔄"
            repo={recommendations.forMigrations.repo}
            reason={recommendations.forMigrations.reason}
          />
        </div>
      </div>

      {/* Rankings */}
      <div className="p-8">
        <h3 className="text-base font-semibold text-white mb-6">Library Rankings</h3>
        <div className="space-y-6">
          {rankings.map((ranking) => {
            const badge = getVerdictBadge(ranking.verdict);
            const rankBadge = getRankBadge(ranking.rank);
            const repoName = ranking.repoSlug.split('/')[1];

            return (
              <div key={ranking.repoSlug} className="bg-white/5 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{rankBadge.icon}</span>
                    <div>
                      <a
                        href={`/repo/${ranking.repoSlug}`}
                        className="text-lg text-white font-semibold hover:text-cyan-400 transition-colors"
                      >
                        {repoName}
                      </a>
                      <span className="text-sm text-slate-500 ml-3">{ranking.repoSlug}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 text-sm rounded-full ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>

                <p className="text-base text-cyan-400 mb-4">{ranking.bestFor}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-green-400 mb-3">Strengths</h4>
                    <ul className="space-y-2">
                      {ranking.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-green-400 font-bold">+</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-orange-400 mb-3">Weaknesses</h4>
                    <ul className="space-y-2">
                      {ranking.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-orange-400 font-bold">-</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({
  title,
  icon,
  repo,
  reason,
}: {
  title: string;
  icon: string;
  repo: string;
  reason: string;
}) {
  const repoName = repo.split('/')[1];

  return (
    <div className="bg-white/5 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h4 className="text-base font-medium text-white">{title}</h4>
      </div>
      <a
        href={`/repo/${repo}`}
        className="text-cyan-400 hover:text-cyan-300 font-semibold text-base block mb-3"
      >
        {repoName}
      </a>
      <p className="text-sm text-slate-400 leading-relaxed">{reason}</p>
    </div>
  );
}
