import type { CachedRepoData, DataStore, RepoCategory, RepoIndex, RepoIndexEntry } from './types';
import type { RepoScore } from './scoring';

interface R2Object {
  json(): Promise<unknown>;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<void>;
}

export interface DataEnv {
  DATA_BUCKET?: R2Bucket;
}

let dataStore: DataStore | null = null;
let repoIndex: RepoIndex | null = null;

function isDataStore(value: unknown): value is DataStore {
  if (!value || typeof value !== 'object') return false;
  const store = value as { repos?: unknown };
  return typeof store.repos === 'object' && store.repos !== null;
}

function isRepoIndex(value: unknown): value is RepoIndex {
  if (!value || typeof value !== 'object') return false;
  const index = value as { repos?: unknown };
  return typeof index.repos === 'object' && index.repos !== null;
}

// Load from old monolithic repos.json (backward compatibility)
async function loadFromR2Legacy(env?: DataEnv): Promise<DataStore | null> {
  if (!env?.DATA_BUCKET) return null;
  const object = await env.DATA_BUCKET.get('repos.json');
  if (!object) return null;
  const data = await object.json();
  return isDataStore(data) ? data : null;
}

// Load from new split architecture: index.json
async function loadIndexFromR2(env?: DataEnv): Promise<RepoIndex | null> {
  if (!env?.DATA_BUCKET) return null;
  const object = await env.DATA_BUCKET.get('index.json');
  if (!object) return null;
  const data = await object.json();
  return isRepoIndex(data) ? data : null;
}

// Load individual repo data from R2
async function loadRepoFromR2(owner: string, name: string, env?: DataEnv): Promise<CachedRepoData | null> {
  if (!env?.DATA_BUCKET) return null;
  const key = `repos/${owner}/${name}.json`;
  const object = await env.DATA_BUCKET.get(key);
  if (!object) return null;
  const data = await object.json();
  return data as CachedRepoData;
}

// Save individual repo to R2
export async function saveRepoToR2(data: CachedRepoData, env?: DataEnv): Promise<void> {
  if (!env?.DATA_BUCKET) return;
  const key = `repos/${data.owner}/${data.name}.json`;
  await env.DATA_BUCKET.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

// Save index to R2
export async function saveIndexToR2(index: RepoIndex, env?: DataEnv): Promise<void> {
  if (!env?.DATA_BUCKET) return;
  await env.DATA_BUCKET.put('index.json', JSON.stringify(index, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

// Get or create repo index
export async function getRepoIndex(env?: DataEnv): Promise<RepoIndex> {
  // Try loading from R2
  const r2Index = await loadIndexFromR2(env);
  if (r2Index) {
    repoIndex = r2Index;
    return r2Index;
  }

  // Return cached if available
  if (repoIndex) return repoIndex;

  // Try local index file first
  try {
    const data = await import('../data/index.json');
    const index = data.default as RepoIndex;
    if (isRepoIndex(index)) {
      repoIndex = index;
      return index;
    }
  } catch {
    // ignore and fall back
  }

  // Try loading legacy format and convert
  const legacyStore = await loadFromR2Legacy(env);
  if (legacyStore) {
    const index = convertDataStoreToIndex(legacyStore);
    repoIndex = index;
    return index;
  }

  // Try local file as fallback
  try {
    const data = await import('../data/repos.json');
    const store = data.default as DataStore;
    const index = convertDataStoreToIndex(store);
    repoIndex = index;
    return index;
  } catch {
    return { version: 1, generatedAt: new Date().toISOString(), repos: {} };
  }
}

// Convert legacy DataStore to new RepoIndex format
function convertDataStoreToIndex(store: DataStore): RepoIndex {
  const indexRepos: Record<string, RepoIndexEntry> = {};
  
  for (const [key, cachedData] of Object.entries(store.repos)) {
    // Find best score across all LLMs
    let bestScore = 0;
    let bestGrade = 'F';
    
    const scoreEntries = Object.values(cachedData.scores) as RepoScore[];
    for (const llmScores of scoreEntries) {
      const score = llmScores.overall || 0;
      const grade = llmScores.grade || 'F';
      if (score > bestScore) {
        bestScore = score;
        bestGrade = grade;
      }
    }
    
    indexRepos[key] = {
      owner: cachedData.owner,
      name: cachedData.name,
      fullName: cachedData.fullName,
      category: cachedData.category,
      featured: cachedData.featured,
      stars: cachedData.repo.stars,
      language: cachedData.repo.language,
      description: cachedData.repo.description,
      bestScore,
      bestGrade,
      updatedAt: cachedData.repo.updatedAt,
      fetchedAt: cachedData.fetchedAt,
    };
  }
  
  return {
    version: store.version,
    generatedAt: store.generatedAt,
    repos: indexRepos,
  };
}

// Get DataStore (backward compatibility - constructs from index + individual repos)
export async function getDataStore(env?: DataEnv): Promise<DataStore> {
  // Try loading legacy format first
  const r2Store = await loadFromR2Legacy(env);
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

// Get cached repo - tries R2 split format first, then falls back to legacy
export async function getCachedRepo(owner: string, name: string, env?: DataEnv): Promise<CachedRepoData | null> {
  // Try new split format first
  const repoData = await loadRepoFromR2(owner, name, env);
  if (repoData) return repoData;
  
  // Fall back to legacy format
  const store = await getDataStore(env);
  return store.repos[`${owner}/${name}`] || null;
}

// Get all cached repos from index
export async function getAllCachedRepos(env?: DataEnv): Promise<RepoIndexEntry[]> {
  const index = await getRepoIndex(env);
  return Object.values(index.repos);
}

// Get full repo data for all cached repos (expensive - loads all individual files)
export async function getAllCachedReposDetailed(env?: DataEnv): Promise<CachedRepoData[]> {
  const index = await getRepoIndex(env);
  const repos: CachedRepoData[] = [];
  
  for (const entry of Object.values(index.repos)) {
    const fullData = await getCachedRepo(entry.owner, entry.name, env);
    if (fullData) {
      repos.push(fullData);
    }
  }
  
  return repos;
}

export async function getFeaturedRepos(env?: DataEnv): Promise<RepoIndexEntry[]> {
  const repos = await getAllCachedRepos(env);
  return repos.filter((r) => r.featured);
}

export async function getReposByCategory(category: RepoCategory, env?: DataEnv): Promise<RepoIndexEntry[]> {
  const repos = await getAllCachedRepos(env);
  return repos.filter((r) => r.category === category);
}

export async function getStaticRepoPaths(env?: DataEnv): Promise<{ params: { slug: string } }[]> {
  const index = await getRepoIndex(env);
  return Object.keys(index.repos).map((key) => ({
    params: { slug: key },
  }));
}

export function isCachedRepo(owner: string, name: string, index: RepoIndex): boolean {
  return `${owner}/${name}` in index.repos;
}

// Update a single repo in the index
export async function updateRepoInIndex(data: CachedRepoData, env?: DataEnv): Promise<void> {
  const index = await getRepoIndex(env);
  
  // Calculate best score
  let bestScore = 0;
  let bestGrade = 'F';
  
  const scoreEntries = Object.values(data.scores) as RepoScore[];
  for (const llmScores of scoreEntries) {
    const score = llmScores.overall || 0;
    const grade = llmScores.grade || 'F';
    if (score > bestScore) {
      bestScore = score;
      bestGrade = grade;
    }
  }
  
  const key = `${data.owner}/${data.name}`;
  index.repos[key] = {
    owner: data.owner,
    name: data.name,
    fullName: data.fullName,
    category: data.category,
    featured: data.featured,
    stars: data.repo.stars,
    language: data.repo.language,
    description: data.repo.description,
    bestScore,
    bestGrade,
    updatedAt: data.repo.updatedAt,
    fetchedAt: data.fetchedAt,
  };
  
  index.generatedAt = new Date().toISOString();
  
  // Save updated index
  await saveIndexToR2(index, env);
  
  // Update cached index
  repoIndex = index;
}
