import { useState, useEffect } from 'react';
import { getLLMById } from '../../lib/llm-configs';
import { LLMComparison } from './LLMComparison';
import { DimensionBreakdown } from './DimensionBreakdown';
import { BadgeCopy } from './BadgeCopy';
import type { CachedRepoData } from '../../lib/types';

interface RepoAnalyzerProps {
  owner: string;
  name: string;
  initialData: CachedRepoData | null;
  defaultLLMId?: string;
}

export function RepoAnalyzer({ owner, name, initialData, defaultLLMId = 'gpt-5.2-codex' }: RepoAnalyzerProps) {
  // Data is now always provided via SSR, no client-side fetching needed
  const data = initialData;

  // Ensure selectedLLMId is valid, fallback to best LLM if not found in scores
  const getInitialLLMId = () => {
    if (!data?.scores || Object.keys(data.scores).length === 0) {
      return defaultLLMId;
    }
    if (data.scores[defaultLLMId]) {
      return defaultLLMId;
    }
    const bestId = getBestLLM(data.scores);
    if (data.scores[bestId]) {
      return bestId;
    }
    return Object.keys(data.scores)[0] || defaultLLMId;
  };

  const [selectedLLMId, setSelectedLLMId] = useState<string>(getInitialLLMId());

  // Ensure selectedLLMId is always valid when data changes
  useEffect(() => {
    if (data?.scores && !data.scores[selectedLLMId]) {
      const newLLMId = getBestLLM(data.scores);
      if (data.scores[newLLMId]) {
        setSelectedLLMId(newLLMId);
      }
    }
  }, [data, selectedLLMId]);

  if (!data) {
    return <ErrorStateComponent message="Repository data not available" />;
  }

  const { repo, scores, releases, npmInfo, hasLlmsTxt, hasClaudeMd, hasAgentMd, sources } = data;
  const bestLLMId = getBestLLM(scores);
  const bestLLM = getLLMById(bestLLMId);
  const selectedScore = scores[selectedLLMId];

  return (
    <div className="animate-fade-in">
      <header className="mb-10 relative">
        <div className="absolute top-0 right-0 -z-10 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-white tracking-tight">
                {repo.owner}<span className="text-cyan-500">/</span>{repo.name}
              </h1>
              {repo.hasTypescript && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">TS</span>
              )}
            </div>

            <p className="text-lg text-[var(--text-muted)] max-w-2xl">{repo.description}</p>
          </div>

          <div className="flex items-center gap-4">
            <a
              href={sources.github}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
              View on GitHub
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <StatBadge icon="⭐" label="Stars" value={formatNumber(repo.stars)} />
          <StatBadge icon="🍴" label="Forks" value={formatNumber(repo.forks)} />
          {npmInfo && (
            <StatBadge icon="📦" label="Downloads" value={`${formatNumber(npmInfo.weeklyDownloads)}/wk`} />
          )}
          <StatBadge icon="🛠️" label="Language" value={repo.language} />
          {releases[0] && (
            <StatBadge icon="🏷️" label="Latest" value={releases[0].tagName} />
          )}
        </div>
      </header>

      {bestLLM && selectedScore && (
        <div className="relative glass-card rounded-2xl p-8 mb-10 overflow-hidden border-cyan-500/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600"></div>

          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500">🏆</span>
                <h2 className="text-xl font-bold text-white">
                  Recommended: <span className="text-cyan-400">{bestLLM.name}</span>
                </h2>
              </div>
              <p className="text-lg text-[var(--text-primary)] leading-relaxed">
                {generateInsight(selectedScore, bestLLM.name)}
              </p>
            </div>

            <div className="flex-shrink-0 text-center bg-white/5 p-4 rounded-xl border border-white/10 min-w-[140px]">
              <div className="text-5xl font-bold mb-1 gradient-text">{selectedScore.overall}</div>
              <div className={`text-sm font-bold uppercase tracking-wider`} style={{ color: getGradeColor(selectedScore.grade) }}>
                Grade {selectedScore.grade}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[380px_1fr] gap-8 items-start">
        <div className="glass-card rounded-2xl p-6 lg:sticky lg:top-24">
          <LLMComparison
            scores={scores}
            bestLLMId={bestLLMId}
            selectedLLMId={selectedLLMId}
            onSelectLLM={setSelectedLLMId}
          />
        </div>

        {selectedScore && (
          <div className="glass-card rounded-2xl p-6">
            <DimensionBreakdown
              score={selectedScore}
              llmName={getLLMById(selectedLLMId)?.name || selectedLLMId}
            />
          </div>
        )}
      </div>

      {selectedScore && (
        <div className="mt-8 glass-card rounded-2xl p-8">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            Detailed Insights
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <InsightItem
              positive={selectedScore.coverage?.details?.releaseCovered as boolean}
              label={
                selectedScore.coverage?.details?.latestRelease === 'N/A'
                  ? 'No stable major release (x.0.0) found'
                  : selectedScore.coverage?.details?.releaseCovered
                    ? `Latest stable major release (${selectedScore.coverage.details.latestRelease}) is within LLM training data`
                    : `Latest stable major release (${selectedScore.coverage?.details?.latestRelease}) is newer than LLM knowledge cutoff`
              }
            />
            <InsightItem
              positive={repo.stars > 1000}
              label={`${formatNumber(repo.stars)} GitHub stars indicate strong presence in training data`}
            />
            <InsightItem
              positive={selectedScore.aiReadiness?.details?.hasTypescript as boolean}
              label={
                selectedScore.aiReadiness?.details?.hasTypescript
                  ? 'Strong typing support helps LLM understand code structure'
                  : 'Lack of TypeScript makes inference harder for LLMs'
              }
            />
            <InsightItem
              positive={hasLlmsTxt}
              label={hasLlmsTxt ? 'Project provides llms.txt for optimized AI context' : 'No llms.txt found (standard context only)'}
            />
            {hasClaudeMd && (
              <InsightItem
                positive={true}
                label="Project includes Claude.md for AI assistant guidance"
              />
            )}
            {hasAgentMd && (
              <InsightItem
                positive={true}
                label="Project includes Agent.md for AI agent configuration"
              />
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <BadgeCopy owner={data.owner} name={data.name} />
      </div>

      <div className="mt-6 glass-card rounded-xl p-4">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Data fetched: {new Date(data.fetchedAt).toLocaleDateString()}</span>
          <div className="flex gap-4">
            <a href={sources.github} target="_blank" rel="noopener" className="hover:text-cyan-400 transition-colors">GitHub ↗</a>
            {sources.npm && <a href={sources.npm} target="_blank" rel="noopener" className="hover:text-cyan-400 transition-colors">npm ↗</a>}
          </div>
        </div>
      </div>
    </div>
  );
}

function getBestLLM(scores: Record<string, { overall: number }>): string {
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

function StatBadge({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[var(--text-muted)]">
      <span>{icon}</span>
      <span className="font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function LoadingStateComponent() {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-xl text-white font-medium animate-pulse">Analyzing Repository Knowledge...</p>
      <p className="text-slate-400 mt-2">Checking training data coverage...</p>
    </div>
  );
}

function ErrorStateComponent({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 text-3xl">😕</div>
      <h2 className="text-2xl font-bold text-white mb-2">Analysis Failed</h2>
      <p className="text-slate-400 mb-8 max-w-md">{message}</p>
      <a
        href="/"
        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
      >
        Try Another Repo
      </a>
    </div>
  );
}

function InsightItem({ positive, label }: { positive: boolean; label: string }) {
  return (
    <div className={`p-4 rounded-xl border ${positive ? 'bg-green-500/5 border-green-500/20' : 'bg-orange-500/5 border-orange-500/20'} flex items-start gap-3`}>
      <span className={`mt-0.5 text-lg ${positive ? 'text-green-400' : 'text-orange-400'}`}>
        {positive ? '✅' : '⚠️'}
      </span>
      <span className={`text-sm leading-relaxed ${positive ? 'text-green-100' : 'text-orange-100'}`}>{label}</span>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
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

function generateInsight(score: { overall: number; grade: string }, llmName: string): string {
  if (score.grade === 'A') {
    return `Excellent choice for AI-assisted coding. ${llmName} has comprehensive knowledge of this project's patterns and APIs.`;
  }
  if (score.grade === 'B') {
    return `Solid choice. ${llmName} understands the core of this project well, though it might lack knowledge of very recent edge cases.`;
  }
  if (score.grade === 'C') {
    return `Use with caution. ${llmName} has gaps in its knowledge about this project. You may need to provide more context or documentation manually.`;
  }
  return `Not recommended for AI assistance. ${llmName} likely has significant hallucinations about this project due to lack of training data.`;
}
