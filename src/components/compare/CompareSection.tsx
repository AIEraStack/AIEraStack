import { useEffect, useState } from 'react';
import { LLM_CONFIGS, getLLMById } from '../../lib/llm-configs';
import type { CachedRepoData } from '../../lib/types';

interface RepoInput {
  slug: string;
  owner: string;
  name: string;
  initialData: CachedRepoData | null;
}

interface RepoState {
  slug: string;
  owner: string;
  name: string;
  data: CachedRepoData | null;
  status: 'loading' | 'success' | 'error';
  error: string;
}

interface CompareSectionProps {
  repos: RepoInput[];
}

function getGradeClass(grade: string): string {
  const colors: Record<string, string> = {
    A: 'text-green-400',
    B: 'text-lime-400',
    C: 'text-yellow-400',
    D: 'text-orange-400',
    F: 'text-red-400',
  };
  return colors[grade] || 'text-slate-400';
}

function getGradeBg(grade: string): string {
  const colors: Record<string, string> = {
    A: 'bg-green-500/10 border-green-500/30',
    B: 'bg-lime-500/10 border-lime-500/30',
    C: 'bg-yellow-500/10 border-yellow-500/30',
    D: 'bg-orange-500/10 border-orange-500/30',
    F: 'bg-red-500/10 border-red-500/30',
  };
  return colors[grade] || 'bg-slate-500/10 border-slate-500/30';
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function toRepoState(repo: RepoInput): RepoState {
  return {
    slug: repo.slug,
    owner: repo.owner,
    name: repo.name,
    data: repo.initialData,
    status: repo.initialData ? 'success' : 'loading',
    error: '',
  };
}

export function CompareSection({ repos }: CompareSectionProps) {
  const [selectedLLMId, setSelectedLLMId] = useState('gpt-5.2-codex');
  const [repoState, setRepoState] = useState<RepoState[]>(() => repos.map(toRepoState));
  const selectedLLM = getLLMById(selectedLLMId);

  useEffect(() => {
    const initialState = repos.map(toRepoState);
    setRepoState(initialState);

    let cancelled = false;
    const missing = initialState.filter((repo) => !repo.data);
    if (missing.length === 0) return;

    missing.forEach(async (repo) => {
      try {
        const response = await fetch(
          `/api/repo?owner=${encodeURIComponent(repo.owner)}&name=${encodeURIComponent(repo.name)}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message = errorData.error || `Failed to fetch: ${response.status}`;
          throw new Error(message);
        }

        const repoData: CachedRepoData = await response.json();
        if (cancelled) return;

        setRepoState((prev) =>
          prev.map((item) =>
            item.slug === repo.slug
              ? { ...item, data: repoData, status: 'success', error: '' }
              : item
          )
        );
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load repository data';
        setRepoState((prev) =>
          prev.map((item) =>
            item.slug === repo.slug ? { ...item, status: 'error', error: message } : item
          )
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [repos]);

  const sortedRepos = [...repoState].sort((a, b) => {
    const scoreA = a.data?.scores[selectedLLMId]?.overall ?? -1;
    const scoreB = b.data?.scores[selectedLLMId]?.overall ?? -1;
    return scoreB - scoreA;
  });

  const bestRepoSlug = sortedRepos.find((repo) => repo.data?.scores[selectedLLMId])?.slug;

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="text-sm font-medium text-white">Compare for:</span>
          <div className="flex flex-wrap gap-2">
            {LLM_CONFIGS.map((llm) => (
              <button
                key={llm.id}
                onClick={() => setSelectedLLMId(llm.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedLLMId === llm.id
                    ? 'text-white ring-2 ring-offset-2 ring-offset-slate-900'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
                style={{
                  backgroundColor: selectedLLMId === llm.id ? llm.color : undefined,
                }}
              >
                {llm.name}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Knowledge cutoff: {selectedLLM?.knowledgeCutoff || 'N/A'}
        </p>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${Math.min(sortedRepos.length, 3)}, 1fr)` }}
      >
        {sortedRepos.map((repo) => {
          const repoData = repo.data;
          const score = repoData?.scores[selectedLLMId];
          const isWinner = bestRepoSlug === repo.slug;
          const displayName = repoData?.repo.name ?? repo.name;
          const displayOwner = repoData?.repo.owner ?? repo.owner;
          const description = repoData?.repo.description?.trim();
          const descriptionText =
            description ||
            (repo.status === 'error'
              ? repo.error || 'Failed to load repository data'
              : repo.status === 'loading'
                ? 'Fetching repository data...'
                : 'No description');
          const starsText = repoData ? formatNumber(repoData.repo.stars) : '—';
          const forksText = repoData ? formatNumber(repoData.repo.forks) : '—';
          const weeklyDownloads = repoData?.npmInfo?.weeklyDownloads ?? null;

          return (
            <a
              key={repo.slug}
              href={`/repo/${repo.slug}`}
              className={`glass-card p-6 rounded-2xl transition-all hover:border-cyan-500/30 ${
                isWinner ? 'ring-2 ring-yellow-500/50' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    {isWinner && <span className="text-yellow-400">🏆</span>}
                    <h3 className="text-lg font-bold text-white">{displayName}</h3>
                  </div>
                  <p className="text-sm text-slate-400">{displayOwner}</p>
                </div>
                {score && (
                  <div className={`px-3 py-2 rounded-xl border ${getGradeBg(score.grade)} text-center`}>
                    <div className={`text-2xl font-bold ${getGradeClass(score.grade)}`}>
                      {score.overall}
                    </div>
                    <div className={`text-xs font-medium ${getGradeClass(score.grade)}`}>
                      Grade {score.grade}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                {descriptionText}
              </p>

              {score && (
                <div className="space-y-2">
                  <ScoreRow label="Timeliness" score={score.timeliness.score} color="#6366f1" />
                  <ScoreRow label="Popularity" score={score.popularity.score} color="#10b981" />
                  <ScoreRow label="AI-Friendliness" score={score.aiFriendliness.score} color="#f59e0b" />
                  <ScoreRow label="Community" score={score.community.score} color="#ec4899" />
                </div>
              )}

              <div className="flex gap-3 mt-4 pt-4 border-t border-white/5 text-xs text-slate-400">
                <span>⭐ {starsText}</span>
                <span>🍴 {forksText}</span>
                {repoData && weeklyDownloads !== null && (
                  <span>📦 {formatNumber(weeklyDownloads)}/wk</span>
                )}
              </div>
            </a>
          );
        })}
      </div>

      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-lg font-bold text-white mb-4">
          Summary for {selectedLLM?.name}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-2 text-slate-400 font-medium">Library</th>
                <th className="text-center py-3 px-2 text-slate-400 font-medium">Overall</th>
                <th className="text-center py-3 px-2 text-slate-400 font-medium">Timeliness</th>
                <th className="text-center py-3 px-2 text-slate-400 font-medium">Popularity</th>
                <th className="text-center py-3 px-2 text-slate-400 font-medium">AI-Friendly</th>
                <th className="text-center py-3 px-2 text-slate-400 font-medium">Community</th>
              </tr>
            </thead>
            <tbody>
              {sortedRepos.map((repo) => {
                const repoData = repo.data;
                const score = repoData?.scores[selectedLLMId];
                const displayName = repoData?.repo.name ?? repo.name;
                const overallText = score ? `${score.grade} · ${score.overall}` : '—';
                const overallClass = score ? getGradeClass(score.grade) : 'text-slate-500';
                const cellClass = score ? 'text-white' : 'text-slate-500';
                return (
                  <tr key={repo.slug} className="border-b border-white/5">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        {bestRepoSlug === repo.slug && <span className="text-yellow-400">🏆</span>}
                        <a
                          href={`/repo/${repo.slug}`}
                          className="text-white hover:text-cyan-400 transition-colors"
                        >
                          {displayName}
                        </a>
                      </div>
                    </td>
                    <td className="text-center py-3 px-2">
                      <span className={`font-bold ${overallClass}`}>{overallText}</span>
                    </td>
                    <td className={`text-center py-3 px-2 ${cellClass}`}>
                      {score ? score.timeliness.score : '-'}
                    </td>
                    <td className={`text-center py-3 px-2 ${cellClass}`}>
                      {score ? score.popularity.score : '-'}
                    </td>
                    <td className={`text-center py-3 px-2 ${cellClass}`}>
                      {score ? score.aiFriendliness.score : '-'}
                    </td>
                    <td className={`text-center py-3 px-2 ${cellClass}`}>
                      {score ? score.community.score : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-lg font-bold text-white mb-4">Score by LLM</h2>
        <p className="text-sm text-slate-400 mb-4">
          See how each library scores across different AI models
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-2 text-slate-400 font-medium">Library</th>
                {LLM_CONFIGS.map((llm) => (
                  <th
                    key={llm.id}
                    className={`text-center py-3 px-2 font-medium ${
                      llm.id === selectedLLMId ? 'text-white' : 'text-slate-400'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: llm.color }}
                      />
                      <span className="text-xs">{llm.name.split(' ')[0]}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRepos.map((repo) => {
                const repoData = repo.data;
                const displayName = repoData?.repo.name ?? repo.name;
                return (
                  <tr key={repo.slug} className="border-b border-white/5">
                    <td className="py-3 px-2">
                      <a
                        href={`/repo/${repo.slug}`}
                        className="text-white hover:text-cyan-400 transition-colors"
                      >
                        {displayName}
                      </a>
                    </td>
                    {LLM_CONFIGS.map((llm) => {
                      const score = repoData?.scores[llm.id];
                      const scoreText = score?.overall ?? '-';
                      const scoreClass = score ? getGradeClass(score.grade) : 'text-slate-500';
                      return (
                        <td
                          key={llm.id}
                          className={`text-center py-3 px-2 ${
                            llm.id === selectedLLMId ? 'bg-white/5' : ''
                          }`}
                        >
                          <span className={`font-medium ${scoreClass}`}>{scoreText}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <>
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-white">{score}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </>
  );
}
