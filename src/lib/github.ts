export interface RepoInfo {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  hasTypescript: boolean;
  license: string | null;
  topics: string[];
}

export interface ReleaseInfo {
  tagName: string;
  name: string;
  publishedAt: string;
  isPrerelease: boolean;
}

export interface NpmInfo {
  name: string;
  version: string;
  weeklyDownloads: number;
  hasTypes: 'bundled' | 'definitelyTyped' | 'none';
  publishedAt: string;
}

const GITHUB_API = 'https://api.github.com';

function getGithubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'AIEraStack',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function fetchRepoInfo(owner: string, name: string, token?: string): Promise<RepoInfo> {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${name}`, {
    headers: getGithubHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch repo: ${response.status}`);
  }

  const data = await response.json();

  return {
    owner: data.owner.login,
    name: data.name,
    fullName: data.full_name,
    description: data.description || '',
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    language: data.language || 'Unknown',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    pushedAt: data.pushed_at,
    hasTypescript: data.language === 'TypeScript',
    license: data.license?.spdx_id || null,
    topics: data.topics || [],
  };
}

export async function fetchReleases(owner: string, name: string, token?: string): Promise<ReleaseInfo[]> {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/releases?per_page=10`, {
    headers: getGithubHeaders(token),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  return data.map((release: Record<string, unknown>) => ({
    tagName: release.tag_name as string,
    name: release.name as string || release.tag_name as string,
    publishedAt: release.published_at as string,
    isPrerelease: release.prerelease as boolean,
  }));
}

export async function checkLlmsTxt(owner: string, name: string, token?: string): Promise<boolean> {
  const paths = ['llms.txt', 'llms-full.txt', '.llms/llms.txt'];

  for (const path of paths) {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/contents/${path}`, {
      headers: getGithubHeaders(token),
    });

    if (response.ok) {
      return true;
    }
  }

  return false;
}
