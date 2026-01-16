const GITHUB_API = 'https://api.github.com';
const NPM_REGISTRY = 'https://registry.npmjs.org';
const NPM_DOWNLOADS = 'https://api.npmjs.org/downloads/point/last-week';
const DATA_VERSION = 1;

const LLM_CONFIGS = [
  { id: 'gpt-5.2-codex', knowledgeCutoff: '2025-08-31' },
  { id: 'gpt-5.2', knowledgeCutoff: '2025-08-31' },
  { id: 'claude-4.5-opus', knowledgeCutoff: '2025-05-01' },
  { id: 'claude-4.5-sonnet', knowledgeCutoff: '2025-01-01' },
  { id: 'gemini-3-pro', knowledgeCutoff: '2025-01-01' },
];

const WEIGHTS = {
  timeliness: 0.35,
  popularity: 0.30,
  aiFriendliness: 0.20,
  community: 0.15,
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const owner = url.searchParams.get('owner');
  const name = url.searchParams.get('name');

  if (!owner || !name) {
    return new Response(JSON.stringify({ error: 'Missing owner or name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const key = `${owner}/${name}`;

  try {
    const cached = await getCachedRepo(env, key);
    if (cached) {
      return jsonResponse(cached);
    }

    const data = await fetchAndCacheRepo(env, owner, name);
    return jsonResponse(data);
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function getCachedRepo(env, key) {
  try {
    const object = await env.DATA_BUCKET.get('repos.json');
    if (!object) return null;

    const data = await object.json();
    return data.repos?.[key] || null;
  } catch {
    return null;
  }
}

async function fetchAndCacheRepo(env, owner, name) {
  const githubToken = env.GITHUB_TOKEN;
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'AIEraStack',
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const [repoRes, releasesRes] = await Promise.all([
    fetch(`${GITHUB_API}/repos/${owner}/${name}`, { headers }),
    fetch(`${GITHUB_API}/repos/${owner}/${name}/releases?per_page=10`, { headers }),
  ]);

  if (!repoRes.ok) {
    throw new Error(`GitHub API error: ${repoRes.status}`);
  }

  const repoData = await repoRes.json();
  const releasesData = releasesRes.ok ? await releasesRes.json() : [];

  const repo = {
    owner: repoData.owner.login,
    name: repoData.name,
    fullName: repoData.full_name,
    description: repoData.description || '',
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    openIssues: repoData.open_issues_count,
    language: repoData.language || 'Unknown',
    createdAt: repoData.created_at,
    updatedAt: repoData.updated_at,
    pushedAt: repoData.pushed_at,
    hasTypescript: repoData.language === 'TypeScript',
    license: repoData.license?.spdx_id || null,
    topics: repoData.topics || [],
  };

  const releases = releasesData.map((r) => ({
    tagName: r.tag_name,
    name: r.name || r.tag_name,
    publishedAt: r.published_at,
    isPrerelease: r.prerelease,
  }));

  const hasLlmsTxt = await checkLlmsTxt(owner, name, headers);

  let npmInfo = null;
  const npmPackage = repoData.name.toLowerCase();
  try {
    const [pkgRes, dlRes] = await Promise.all([
      fetch(`${NPM_REGISTRY}/${npmPackage}`),
      fetch(`${NPM_DOWNLOADS}/${npmPackage}`),
    ]);
    if (pkgRes.ok) {
      const pkgData = await pkgRes.json();
      const latestVersion = pkgData['dist-tags']?.latest;
      const versionData = pkgData.versions?.[latestVersion] || {};
      let weeklyDownloads = 0;
      if (dlRes.ok) {
        const dlData = await dlRes.json();
        weeklyDownloads = dlData.downloads || 0;
      }
      npmInfo = {
        name: pkgData.name,
        version: latestVersion,
        description: pkgData.description || '',
        weeklyDownloads,
        hasTypes: versionData.types || versionData.typings ? 'bundled' : 'none',
        repository: null,
      };
    }
  } catch {}

  const scores = calculateScores(repo, releases, npmInfo, hasLlmsTxt);

  const key = `${owner}/${name}`;
  const cachedData = {
    owner,
    name,
    fullName: repo.fullName,
    category: 'utility',
    featured: false,
    repo,
    releases,
    hasLlmsTxt,
    npmPackage: npmInfo ? npmPackage : null,
    npmInfo,
    scores,
    sources: {
      github: `https://github.com/${key}`,
      npm: npmInfo ? `https://www.npmjs.com/package/${npmPackage}` : null,
      releases: `https://github.com/${key}/releases`,
    },
    fetchedAt: new Date().toISOString(),
    dataVersion: DATA_VERSION,
  };

  await saveToCache(env, key, cachedData);

  return cachedData;
}

async function checkLlmsTxt(owner, name, headers) {
  const paths = ['llms.txt', 'llms-full.txt'];
  for (const path of paths) {
    try {
      const res = await fetch(`${GITHUB_API}/repos/${owner}/${name}/contents/${path}`, { headers });
      if (res.ok) return true;
    } catch {}
  }
  return false;
}

async function saveToCache(env, key, data) {
  try {
    let store = { version: DATA_VERSION, generatedAt: new Date().toISOString(), repos: {} };
    const existing = await env.DATA_BUCKET.get('repos.json');
    if (existing) {
      store = await existing.json();
    }
    store.repos[key] = data;
    store.generatedAt = new Date().toISOString();
    await env.DATA_BUCKET.put('repos.json', JSON.stringify(store), {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch (e) {
    console.error('Failed to save cache:', e);
  }
}

function calculateScores(repo, releases, npmInfo, hasLlmsTxt) {
  const scores = {};

  for (const llm of LLM_CONFIGS) {
    const cutoff = new Date(llm.knowledgeCutoff);
    const latestRelease = releases.find((r) => !r.isPrerelease);
    const latestReleaseDate = latestRelease ? new Date(latestRelease.publishedAt) : null;
    const lastPush = new Date(repo.pushedAt);
    const createdAt = new Date(repo.createdAt);

    let releaseScore = 100;
    if (latestReleaseDate) {
      if (latestReleaseDate <= cutoff) {
        releaseScore = 100;
      } else {
        const daysBeyond = Math.floor((latestReleaseDate.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24));
        releaseScore = Math.max(20, 100 - daysBeyond * 0.5);
      }
    }

    let activityScore = 100;
    if (lastPush > cutoff) {
      const daysBeyond = Math.floor((lastPush.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24));
      activityScore = Math.max(30, 100 - daysBeyond * 0.3);
    }

    const maturityScore = createdAt < cutoff ? 100 : 50;
    const timelinessScore = releaseScore * 0.5 + activityScore * 0.3 + maturityScore * 0.2;

    const starScore = Math.min(100, Math.log10(repo.stars + 1) * 20);
    const forkScore = Math.min(100, Math.log10(repo.forks + 1) * 25);
    let downloadScore = 50;
    if (npmInfo && npmInfo.weeklyDownloads > 0) {
      downloadScore = Math.min(100, Math.log10(npmInfo.weeklyDownloads + 1) * 14.3);
    }
    const popularityScore = starScore * 0.4 + downloadScore * 0.4 + forkScore * 0.2;

    let aiFriendlinessScore = 0;
    const hasTypescript = repo.hasTypescript || repo.language === 'TypeScript';
    const hasNpmTypes = npmInfo?.hasTypes === 'bundled';
    if (hasTypescript || hasNpmTypes) aiFriendlinessScore += 35;
    if (hasLlmsTxt) aiFriendlinessScore += 25;
    if (repo.topics.length >= 3) aiFriendlinessScore += 15;
    if (new Date(repo.pushedAt) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) aiFriendlinessScore += 15;
    if (repo.license) aiFriendlinessScore += 10;
    aiFriendlinessScore = Math.min(100, aiFriendlinessScore);

    const issueRatio = repo.openIssues / Math.max(1, repo.stars);
    let communityScore = 50;
    if (issueRatio < 0.05) communityScore += 25;
    if (repo.forks > 100) communityScore += 15;
    if (repo.topics.length > 0) communityScore += 10;
    communityScore = Math.min(100, communityScore);

    const overall =
      timelinessScore * WEIGHTS.timeliness +
      popularityScore * WEIGHTS.popularity +
      aiFriendlinessScore * WEIGHTS.aiFriendliness +
      communityScore * WEIGHTS.community;

    const grade = overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : overall >= 40 ? 'D' : 'F';

    scores[llm.id] = {
      overall: Math.round(overall),
      grade,
      timeliness: {
        score: Math.round(timelinessScore),
        details: {
          releaseScore: Math.round(releaseScore),
          activityScore: Math.round(activityScore),
          maturityScore: Math.round(maturityScore),
          latestRelease: latestRelease?.tagName || 'N/A',
          releaseCovered: latestReleaseDate ? latestReleaseDate <= cutoff : true,
        },
      },
      popularity: {
        score: Math.round(popularityScore),
        details: {
          starScore: Math.round(starScore),
          downloadScore: Math.round(downloadScore),
          forkScore: Math.round(forkScore),
          stars: repo.stars,
          forks: repo.forks,
          weeklyDownloads: npmInfo?.weeklyDownloads || 0,
        },
      },
      aiFriendliness: {
        score: Math.round(aiFriendlinessScore),
        details: {
          hasTypescript: hasTypescript || hasNpmTypes,
          hasLlmsTxt,
          hasGoodTopics: repo.topics.length >= 3,
          isWellMaintained: new Date(repo.pushedAt) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          hasLicense: !!repo.license,
        },
      },
      community: {
        score: Math.round(communityScore),
        details: {
          openIssues: repo.openIssues,
          issueRatio: Math.round(issueRatio * 1000) / 1000,
          healthyIssueRatio: issueRatio < 0.05,
        },
      },
    };
  }

  return scores;
}
