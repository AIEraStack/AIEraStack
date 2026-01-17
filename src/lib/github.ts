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

export interface CommitInfo {
  sha: string;
  date: string;
  message: string;
}

export interface PullRequestInfo {
  number: number;
  createdAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  state: string;
}

export async function fetchRecentCommits(owner: string, name: string, token?: string): Promise<CommitInfo[]> {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/commits?per_page=30`, {
    headers: getGithubHeaders(token),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  return data.map((commit: any) => ({
    sha: commit.sha,
    date: commit.commit.author.date,
    message: commit.commit.message,
  }));
}

export async function fetchRecentClosedPRs(owner: string, name: string, token?: string): Promise<PullRequestInfo[]> {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/pulls?state=closed&per_page=30&sort=updated&direction=desc`, {
    headers: getGithubHeaders(token),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  return data.map((pr: any) => ({
    number: pr.number,
    createdAt: pr.created_at,
    closedAt: pr.closed_at,
    mergedAt: pr.merged_at,
    state: pr.state,
  }));
}

export async function fetchReadmeSize(owner: string, name: string, token?: string): Promise<number> {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/readme`, {
    headers: getGithubHeaders(token),
  });

  if (!response.ok) {
    return 0;
  }

  const data = await response.json();
  return data.size || 0;
}

export async function fetchRootContents(owner: string, name: string, token?: string): Promise<string[]> {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/contents`, {
    headers: getGithubHeaders(token),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item: any) => item.name.toLowerCase());
}
