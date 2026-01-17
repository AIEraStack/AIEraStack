import type { APIRoute } from 'astro';
import curatedSource from '../../data/curated-repos.json';
import { getCachedRepo, saveRepoToR2, updateRepoInIndex } from '../../lib/data-loader';
import { checkLlmsTxt, fetchReleases, fetchRepoInfo } from '../../lib/github';
import { fetchNpmPackage } from '../../lib/npm';
import { calculateScores } from '../../lib/scoring';
import type { CachedRepoData, CuratedRepo } from '../../lib/types';
import { DATA_VERSION } from '../../lib/types';

interface R2Bucket {
  get(key: string): Promise<any>;
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<void>;
}

interface CloudflareEnv {
  DATA_BUCKET?: R2Bucket;
  GITHUB_TOKEN?: string;
}

const curatedRepos = (curatedSource as unknown as { repos: CuratedRepo[] }).repos;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=3600' : 'no-store',
    },
  });
}

function findCuratedRepo(owner: string, name: string): CuratedRepo | undefined {
  const ownerLower = owner.toLowerCase();
  const nameLower = name.toLowerCase();
  return curatedRepos.find(
    (repo) => repo.owner.toLowerCase() === ownerLower && repo.name.toLowerCase() === nameLower
  );
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const owner = url.searchParams.get('owner');
  const name = url.searchParams.get('name');

  if (!owner || !name) {
    return jsonResponse({ error: 'Missing owner or name' }, 400);
  }

  const env = (locals?.runtime?.env as CloudflareEnv | undefined) ?? {};
  const curatedMatch = findCuratedRepo(owner, name);
  const cacheKey = curatedMatch ? `${curatedMatch.owner}/${curatedMatch.name}` : `${owner}/${name}`;

  // Check cache using new loader (supports both split and legacy formats)
  const cached = await getCachedRepo(
    curatedMatch?.owner || owner,
    curatedMatch?.name || name,
    { DATA_BUCKET: env.DATA_BUCKET }
  );
  
  if (cached) {
    return jsonResponse(cached);
  }

  // Fetch fresh data
  try {
    const repo = await fetchRepoInfo(owner, name, env.GITHUB_TOKEN);
    const releases = await fetchReleases(owner, name, env.GITHUB_TOKEN);
    const hasLlmsTxt = await checkLlmsTxt(owner, name, env.GITHUB_TOKEN);

    const npmPackageName = curatedMatch?.npmPackage || repo.name.toLowerCase();
    const npmInfo = await fetchNpmPackage(npmPackageName);
    const scores = calculateScores(repo, releases, npmInfo, hasLlmsTxt);

    const cacheRecord: CachedRepoData = {
      owner: repo.owner,
      name: repo.name,
      fullName: repo.fullName,
      category: curatedMatch?.category || 'utility',
      featured: curatedMatch?.featured || false,
      repo,
      releases,
      hasLlmsTxt,
      npmPackage: npmInfo ? npmPackageName : null,
      npmInfo,
      scores,
      sources: {
        github: `https://github.com/${repo.owner}/${repo.name}`,
        npm: npmInfo ? `https://www.npmjs.com/package/${npmPackageName}` : null,
        releases: `https://github.com/${repo.owner}/${repo.name}/releases`,
      },
      fetchedAt: new Date().toISOString(),
      dataVersion: DATA_VERSION,
    };

    // Save using new split architecture
    if (env.DATA_BUCKET) {
      await saveRepoToR2(cacheRecord, { DATA_BUCKET: env.DATA_BUCKET });
      await updateRepoInIndex(cacheRecord, { DATA_BUCKET: env.DATA_BUCKET });
    }

    return jsonResponse(cacheRecord);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch repository data';
    return jsonResponse({ error: message }, 500);
  }
};
