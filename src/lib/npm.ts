export interface NpmPackageInfo {
  name: string;
  version: string;
  description: string;
  weeklyDownloads: number;
  hasTypes: 'bundled' | 'definitelyTyped' | 'none';
  repository: string | null;
}

const NPM_REGISTRY = 'https://registry.npmjs.org';
const NPM_DOWNLOADS = 'https://api.npmjs.org/downloads/point/last-week';

export async function fetchNpmPackage(packageName: string): Promise<NpmPackageInfo | null> {
  try {
    const [packageRes, downloadsRes] = await Promise.all([
      fetch(`${NPM_REGISTRY}/${packageName}`),
      fetch(`${NPM_DOWNLOADS}/${packageName}`),
    ]);

    if (!packageRes.ok) {
      return null;
    }

    const packageData = await packageRes.json();
    const latestVersion = packageData['dist-tags']?.latest;
    const versionData = packageData.versions?.[latestVersion] || {};

    let weeklyDownloads = 0;
    if (downloadsRes.ok) {
      const downloadsData = await downloadsRes.json();
      weeklyDownloads = downloadsData.downloads || 0;
    }

    const hasTypes = determineTypesStatus(versionData, packageName);

    const repoUrl = extractRepoUrl(packageData.repository);

    return {
      name: packageData.name,
      version: latestVersion,
      description: packageData.description || '',
      weeklyDownloads,
      hasTypes,
      repository: repoUrl,
    };
  } catch {
    return null;
  }
}

function determineTypesStatus(
  versionData: Record<string, unknown>,
  packageName: string
): 'bundled' | 'definitelyTyped' | 'none' {
  if (versionData.types || versionData.typings) {
    return 'bundled';
  }

  const typesPackage = `@types/${packageName.replace('@', '').replace('/', '__')}`;
  return 'none';
}

function extractRepoUrl(repository: unknown): string | null {
  if (!repository) return null;

  if (typeof repository === 'string') {
    return repository;
  }

  if (typeof repository === 'object' && repository !== null) {
    const repo = repository as Record<string, unknown>;
    if (typeof repo.url === 'string') {
      return repo.url
        .replace(/^git\+/, '')
        .replace(/\.git$/, '')
        .replace(/^git:\/\//, 'https://');
    }
  }

  return null;
}

export async function findNpmPackageForRepo(owner: string, name: string): Promise<string | null> {
  const candidates = [
    name,
    `@${owner}/${name}`,
    name.toLowerCase(),
    `@${owner.toLowerCase()}/${name.toLowerCase()}`,
  ];

  for (const candidate of candidates) {
    const pkg = await fetchNpmPackage(candidate);
    if (pkg && pkg.repository?.includes(`${owner}/${name}`)) {
      return candidate;
    }
  }

  return null;
}
