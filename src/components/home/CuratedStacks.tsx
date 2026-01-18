import { useMemo, useState } from 'react';

import { LLM_CONFIGS } from '../../lib/llm-configs';
import type { RepoCategory, RepoIndexEntry } from '../../lib/types';

interface CategoryMeta {
  label: string;
  icon: string;
  description: string;
}

interface CategoryBlock {
  category: RepoCategory;
  meta: CategoryMeta;
  repos: RepoIndexEntry[];
}

interface GroupBlock {
  id: string;
  label: string;
  description: string;
  categories: CategoryBlock[];
}

interface CuratedStacksProps {
  groups: GroupBlock[];
  defaultLLMId?: string;
}

const MAX_REPOS_PER_CATEGORY = 5;

function getRepoScore(repo: RepoIndexEntry, llmId: string): number {
  return repo.scoresByLLM?.[llmId]?.overall ?? repo.bestScore ?? 0;
}

export function CuratedStacks({ groups, defaultLLMId }: CuratedStacksProps) {
  const [selectedLLMId, setSelectedLLMId] = useState(
    () => defaultLLMId ?? LLM_CONFIGS[0]?.id ?? 'gpt-5.2-codex'
  );

  const sortedGroups = useMemo(() => {
    return groups.map((group) => ({
      ...group,
      categories: group.categories.map((category) => {
        const sortedRepos = [...category.repos].sort(
          (a, b) => getRepoScore(b, selectedLLMId) - getRepoScore(a, selectedLLMId)
        );
        return {
          ...category,
          repos: sortedRepos.slice(0, MAX_REPOS_PER_CATEGORY),
        };
      }),
    }));
  }, [groups, selectedLLMId]);

  return (
    <section className="py-24 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <h2 className="text-3xl font-bold text-white">
            <span className="gradient-text">Curated</span> Stacks
          </h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className="text-sm text-[var(--text-muted)]">Scored for:</span>
            <div className="flex flex-wrap gap-2">
              {LLM_CONFIGS.map((llm) => (
                <button
                  key={llm.id}
                  type="button"
                  onClick={() => setSelectedLLMId(llm.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedLLMId === llm.id
                      ? 'text-white ring-2 ring-offset-2 ring-offset-slate-900'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                  style={selectedLLMId === llm.id ? { backgroundColor: llm.color } : undefined}
                  aria-pressed={selectedLLMId === llm.id}
                >
                  {llm.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-12">
          {sortedGroups.map((group) => (
            <div key={group.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">{group.label}</h3>
                  <p className="text-sm text-[var(--text-muted)]">{group.description}</p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {group.categories.map((cat) => (
                  <div
                    key={cat.category}
                    className="glass-card rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-300"
                  >
                    <h4 className="text-lg font-bold text-white mb-4">
                      {cat.meta.label}
                    </h4>
                    <div className="space-y-2">
                      {cat.repos.map((repo, i) => {
                        const score = getRepoScore(repo, selectedLLMId);
                        return (
                          <a
                            key={`${repo.owner}/${repo.name}`}
                            href={`/repo/${repo.owner}/${repo.name}`}
                            className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span
                                className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 ${
                                  i === 0
                                    ? 'bg-yellow-500/20 text-yellow-500'
                                    : 'text-[var(--text-muted)] bg-white/5'
                                }`}
                              >
                                {i + 1}
                              </span>
                              <span
                                className="text-sm text-[var(--text-primary)] font-medium group-hover:text-cyan-400 transition-colors truncate"
                                title={`${repo.owner}/${repo.name}`}
                              >
                                <span className="text-slate-500">{repo.owner}/</span>
                                {repo.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-cyan-400 w-6">{score}</span>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
