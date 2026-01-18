import type { APIRoute } from 'astro';
import curatedSource from '../data/curated-repos.json';
import { getRepoIndex, type DataEnv } from '../lib/data-loader';
import type { CuratedRepo, RepoIndexEntry } from '../lib/types';

const SITE_URL = 'https://aierastack.com';

type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
};

const curatedRepos = (curatedSource as { repos: CuratedRepo[] }).repos;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeDate(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function buildSitemapXml(urls: SitemapUrl[]): string {
  const items = urls
    .map((entry) => {
      const fields = [
        `<loc>${escapeXml(entry.loc)}</loc>`,
        entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : '',
        entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : '',
        entry.priority ? `<priority>${entry.priority}</priority>` : '',
      ]
        .filter(Boolean)
        .join('');

      return `  <url>${fields}</url>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    items,
    '</urlset>',
  ].join('\n');
}

function buildRepoUrl(entry: RepoIndexEntry, lastmod: string): SitemapUrl {
  return {
    loc: `${SITE_URL}/repo/${entry.owner}/${entry.name}`,
    lastmod,
    changefreq: 'weekly',
    priority: '0.6',
  };
}

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals?.runtime?.env as DataEnv | undefined) ?? {};
  const index = await getRepoIndex(env);
  const fallbackLastmod = normalizeDate(index.generatedAt, new Date().toISOString());

  const urls: SitemapUrl[] = [
    {
      loc: `${SITE_URL}/`,
      lastmod: fallbackLastmod,
      changefreq: 'daily',
      priority: '1.0',
    },
    {
      loc: `${SITE_URL}/compare`,
      lastmod: fallbackLastmod,
      changefreq: 'weekly',
      priority: '0.7',
    },
  ];

  const seen = new Set<string>();
  for (const url of urls) {
    seen.add(url.loc);
  }

  for (const repo of curatedRepos) {
    const key = `${repo.owner}/${repo.name}`;
    const entry = index.repos[key];
    const lastmod = normalizeDate(entry?.updatedAt ?? entry?.fetchedAt, fallbackLastmod);
    const repoUrl = entry
      ? buildRepoUrl(entry, lastmod)
      : {
          loc: `${SITE_URL}/repo/${repo.owner}/${repo.name}`,
          lastmod,
          changefreq: 'weekly',
          priority: '0.6',
        };

    if (!seen.has(repoUrl.loc)) {
      urls.push(repoUrl);
      seen.add(repoUrl.loc);
    }
  }

  const xml = buildSitemapXml(urls.sort((a, b) => a.loc.localeCompare(b.loc)));

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
};
