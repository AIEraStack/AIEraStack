import type { CachedRepoData, DataStore, RepoCategory } from './types';

let dataStore: DataStore | null = null;

export async function getDataStore(): Promise<DataStore> {
  if (dataStore) return dataStore;

  try {
    const data = await import('../data/repos.json');
    dataStore = data.default as DataStore;
    return dataStore;
  } catch {
    return { version: 1, generatedAt: new Date().toISOString(), repos: {} };
  }
}

export async function getCachedRepo(owner: string, name: string): Promise<CachedRepoData | null> {
  const store = await getDataStore();
  return store.repos[`${owner}/${name}`] || null;
}

export async function getAllCachedRepos(): Promise<CachedRepoData[]> {
  const store = await getDataStore();
  return Object.values(store.repos);
}

export async function getFeaturedRepos(): Promise<CachedRepoData[]> {
  const repos = await getAllCachedRepos();
  return repos.filter((r) => r.featured);
}

export async function getReposByCategory(category: RepoCategory): Promise<CachedRepoData[]> {
  const repos = await getAllCachedRepos();
  return repos.filter((r) => r.category === category);
}

export async function getStaticRepoPaths(): Promise<{ params: { slug: string } }[]> {
  const store = await getDataStore();
  return Object.keys(store.repos).map((key) => ({
    params: { slug: key },
  }));
}

export function isCachedRepo(owner: string, name: string, store: DataStore): boolean {
  return `${owner}/${name}` in store.repos;
}
