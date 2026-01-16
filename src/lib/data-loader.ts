import type { CachedRepoData, DataStore, RepoCategory } from './types';

interface R2Object {
  json(): Promise<unknown>;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
}

export interface DataEnv {
  DATA_BUCKET?: R2Bucket;
}

let dataStore: DataStore | null = null;

function isDataStore(value: unknown): value is DataStore {
  if (!value || typeof value !== 'object') return false;
  const store = value as { repos?: unknown };
  return typeof store.repos === 'object' && store.repos !== null;
}

async function loadFromR2(env?: DataEnv): Promise<DataStore | null> {
  if (!env?.DATA_BUCKET) return null;
  const object = await env.DATA_BUCKET.get('repos.json');
  if (!object) return null;
  const data = await object.json();
  return isDataStore(data) ? data : null;
}

export async function getDataStore(env?: DataEnv): Promise<DataStore> {
  const r2Store = await loadFromR2(env);
  if (r2Store) {
    dataStore = r2Store;
    return r2Store;
  }

  if (dataStore) return dataStore;

  try {
    const data = await import('../data/repos.json');
    dataStore = data.default as DataStore;
    return dataStore;
  } catch {
    return { version: 1, generatedAt: new Date().toISOString(), repos: {} };
  }
}

export async function getCachedRepo(owner: string, name: string, env?: DataEnv): Promise<CachedRepoData | null> {
  const store = await getDataStore(env);
  return store.repos[`${owner}/${name}`] || null;
}

export async function getAllCachedRepos(env?: DataEnv): Promise<CachedRepoData[]> {
  const store = await getDataStore(env);
  return Object.values(store.repos);
}

export async function getFeaturedRepos(env?: DataEnv): Promise<CachedRepoData[]> {
  const repos = await getAllCachedRepos(env);
  return repos.filter((r) => r.featured);
}

export async function getReposByCategory(category: RepoCategory, env?: DataEnv): Promise<CachedRepoData[]> {
  const repos = await getAllCachedRepos(env);
  return repos.filter((r) => r.category === category);
}

export async function getStaticRepoPaths(env?: DataEnv): Promise<{ params: { slug: string } }[]> {
  const store = await getDataStore(env);
  return Object.keys(store.repos).map((key) => ({
    params: { slug: key },
  }));
}

export function isCachedRepo(owner: string, name: string, store: DataStore): boolean {
  return `${owner}/${name}` in store.repos;
}
