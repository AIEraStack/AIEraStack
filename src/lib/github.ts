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
const RELEASES_PER_PAGE = 100;

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

function isStableMajorRelease(release: ReleaseInfo): boolean {
  if (release.isPrerelease) return false;
  const match = release.tagName.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!match) return false;
  const minor = Number.parseInt(match[2], 10);
  const patch = match[3] ? Number.parseInt(match[3], 10) : 0;
  return minor === 0 && patch === 0;
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
  const releases: ReleaseInfo[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `${GITHUB_API}/repos/${owner}/${name}/releases?per_page=${RELEASES_PER_PAGE}&page=${page}`,
      {
        headers: getGithubHeaders(token),
      }
    );

    if (!response.ok) {
      return releases;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return releases;
    }

    const pageReleases = data.map((release: Record<string, unknown>) => ({
      tagName: release.tag_name as string,
      name: (release.name as string) || (release.tag_name as string),
      publishedAt: release.published_at as string,
      isPrerelease: release.prerelease as boolean,
    }));

    releases.push(...pageReleases);

    if (pageReleases.some(isStableMajorRelease)) {
      return releases;
    }

    if (data.length < RELEASES_PER_PAGE) {
      return releases;
    }

    page += 1;
  }
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

export interface ReadmeInfo {
  size: number;
  content: string;
}

export async function fetchReadme(owner: string, name: string, token?: string): Promise<ReadmeInfo> {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/readme`, {
    headers: getGithubHeaders(token),
  });

  if (!response.ok) {
    return { size: 0, content: '' };
  }

  const data = await response.json();
  const size = data.size || 0;
  
  // Decode base64 content
  let content = '';
  if (data.content && data.encoding === 'base64') {
    try {
      content = atob(data.content.replace(/\n/g, ''));
    } catch {
      content = '';
    }
  }
  
  return { size, content };
}

// Backward compatibility
export async function fetchReadmeSize(owner: string, name: string, token?: string): Promise<number> {
  const readme = await fetchReadme(owner, name, token);
  return readme.size;
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

/**
 * Parse README content for documentation and example links
 * Looks for Markdown links and bare URLs pointing to docs/examples
 */
export function parseReadmeLinks(content: string): { hasDocsLink: boolean; hasExamplesLink: boolean } {
  if (!content) {
    return { hasDocsLink: false, hasExamplesLink: false };
  }

  const lowerContent = content.toLowerCase();
  
  // Keywords for documentation
  const docsKeywords = ['documentation', 'docs', 'guide', 'tutorial', 'api', 'reference'];
  // Keywords for examples
  const examplesKeywords = ['example', 'examples', 'sample', 'samples', 'demo'];
  
  // Match Markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  // Match bare URLs: http(s)://...
  const urlRegex = /https?:\/\/[^\s<>'"]+/g;
  
  let hasDocsLink = false;
  let hasExamplesLink = false;
  
  // Check Markdown links
  let match;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    const linkText = match[1].toLowerCase();
    const linkUrl = match[2].toLowerCase();
    const combined = linkText + ' ' + linkUrl;
    
    if (!hasDocsLink && docsKeywords.some(kw => combined.includes(kw))) {
      hasDocsLink = true;
    }
    if (!hasExamplesLink && examplesKeywords.some(kw => combined.includes(kw))) {
      hasExamplesLink = true;
    }
  }
  
  // Check bare URLs in context (look at surrounding text)
  const lines = lowerContent.split('\n');
  for (const line of lines) {
    if (!hasDocsLink && docsKeywords.some(kw => line.includes(kw)) && urlRegex.test(line)) {
      hasDocsLink = true;
    }
    if (!hasExamplesLink && examplesKeywords.some(kw => line.includes(kw)) && urlRegex.test(line)) {
      hasExamplesLink = true;
    }
  }
  
  return { hasDocsLink, hasExamplesLink };
}
