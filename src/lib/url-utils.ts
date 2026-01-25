export function buildCompareUrl(repos: string[]): string {
  if (repos.length === 0) return '/compare';
  return `/compare/${repos.map(r => r.trim()).filter(r => r.includes('/')).join('~')}`;
}

export function parseCompareUrl(path: string | undefined): string[] {
  if (!path) return [];
  return path.split('~').map(s => s.trim()).filter(s => s.includes('/'));
}
