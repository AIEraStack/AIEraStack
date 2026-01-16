import type { RepoInfo, ReleaseInfo } from './github';
import type { NpmPackageInfo } from './npm';
import type { AllLLMScores } from './scoring';

export interface CuratedRepo {
  owner: string;
  name: string;
  npmPackage?: string;
  category: RepoCategory;
  featured?: boolean;
}

export type RepoCategory =
  | 'framework'
  | 'ui-library'
  | 'state-management'
  | 'build-tool'
  | 'testing'
  | 'database'
  | 'api'
  | 'ai-ml'
  | 'utility';

export const CATEGORY_META: Record<RepoCategory, { label: string; icon: string; description: string }> = {
  'framework': {
    label: 'Frameworks',
    icon: '🏗️',
    description: 'Full-stack and frontend frameworks',
  },
  'ui-library': {
    label: 'UI Libraries',
    icon: '🎨',
    description: 'Component libraries and design systems',
  },
  'state-management': {
    label: 'State Management',
    icon: '🔄',
    description: 'Application state and data flow',
  },
  'build-tool': {
    label: 'Build Tools',
    icon: '⚡',
    description: 'Bundlers, compilers, and dev tools',
  },
  'testing': {
    label: 'Testing',
    icon: '🧪',
    description: 'Testing frameworks and utilities',
  },
  'database': {
    label: 'Database',
    icon: '🗄️',
    description: 'ORMs, query builders, and database clients',
  },
  'api': {
    label: 'API & Backend',
    icon: '🔌',
    description: 'API frameworks and server utilities',
  },
  'ai-ml': {
    label: 'AI & ML',
    icon: '🤖',
    description: 'AI SDKs and machine learning tools',
  },
  'utility': {
    label: 'Utilities',
    icon: '🔧',
    description: 'General-purpose utility libraries',
  },
};

export interface CachedRepoData {
  owner: string;
  name: string;
  fullName: string;
  category: RepoCategory;
  featured: boolean;

  repo: RepoInfo;
  releases: ReleaseInfo[];
  hasLlmsTxt: boolean;

  npmPackage: string | null;
  npmInfo: NpmPackageInfo | null;

  scores: AllLLMScores;

  sources: {
    github: string;
    npm: string | null;
    releases: string;
  };

  fetchedAt: string;
  dataVersion: number;
}

export interface DataStore {
  version: number;
  generatedAt: string;
  repos: Record<string, CachedRepoData>;
}

export const DATA_VERSION = 1;
