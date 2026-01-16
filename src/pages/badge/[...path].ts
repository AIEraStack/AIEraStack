import type { APIRoute } from 'astro';
import type { CachedRepoData, DataStore } from '../../lib/types';

interface R2Object {
  json(): Promise<unknown>;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
}

interface CloudflareEnv {
  DATA_BUCKET?: R2Bucket;
}

const GRADE_COLORS = {
  A: '22c55e',
  B: '84cc16',
  C: 'eab308',
  D: 'f97316',
  F: 'ef4444',
};

const DEFAULT_LLM = 'gpt-5.2-codex';

function isDataStore(value: unknown): value is DataStore {
  if (!value || typeof value !== 'object') return false;
  const store = value as { repos?: unknown };
  return typeof store.repos === 'object' && store.repos !== null;
}

async function getCachedRepo(bucket: R2Bucket | undefined, key: string): Promise<CachedRepoData | null> {
  if (!bucket) return null;
  
  try {
    const object = await bucket.get('repos.json');
    if (!object) return null;
    
    const data = await object.json();
    if (!isDataStore(data)) return null;
    
    return data.repos[key] || null;
  } catch {
    return null;
  }
}

function badgeResponse(label: string, message: string, color: string): Response {
  const svg = generateBadgeSVG(label, message, color);
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function generateBadgeSVG(label: string, message: string, color: string): string {
  const labelWidth = label.length * 6.5 + 10;
  const messageWidth = message.length * 7.5 + 10;
  const totalWidth = labelWidth + messageWidth;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="#${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text>
    <text x="${labelWidth / 2}" y="14" fill="#fff">${escapeXml(label)}</text>
    <text aria-hidden="true" x="${labelWidth + messageWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(message)}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14" fill="#fff">${escapeXml(message)}</text>
  </g>
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ params, request, locals }) => {
  const url = new URL(request.url);
  const pathParts = params.path?.split('/') || [];
  
  if (pathParts.length < 2) {
    return badgeResponse('error', 'invalid', '999999');
  }
  
  let owner = pathParts[0];
  let repo = pathParts[1];
  
  // 移除 .svg 后缀（如果有）
  if (repo.endsWith('.svg')) {
    repo = repo.slice(0, -4);
  }
  
  const llmId = url.searchParams.get('llm') || DEFAULT_LLM;
  const env = (locals?.runtime?.env as CloudflareEnv | undefined) ?? {};
  
  try {
    // 先尝试从缓存读取
    const cached = await getCachedRepo(env.DATA_BUCKET, `${owner}/${repo}`);
    
    if (cached && cached.scores && cached.scores[llmId]) {
      const score = cached.scores[llmId];
      return badgeResponse(
        'AI Era Stack',
        `${score.grade} · ${score.overall}`,
        GRADE_COLORS[score.grade] || '666666'
      );
    }
    
    // 如果缓存不存在，尝试调用 API 获取数据
    const apiUrl = new URL('/api/repo', url.origin);
    apiUrl.searchParams.set('owner', owner);
    apiUrl.searchParams.set('name', repo);
    
    const response = await fetch(apiUrl.toString());
    
    if (!response.ok) {
      return badgeResponse('AI Era Stack', 'not found', '999999');
    }
    
    const data = await response.json();
    
    if (data.scores && data.scores[llmId]) {
      const score = data.scores[llmId];
      return badgeResponse(
        'AI Era Stack',
        `${score.grade} · ${score.overall}`,
        GRADE_COLORS[score.grade] || '666666'
      );
    }
    
    return badgeResponse('AI Era Stack', 'error', '999999');
  } catch (error) {
    console.error('Badge generation error:', error);
    return badgeResponse('AI Era Stack', 'error', '999999');
  }
};
