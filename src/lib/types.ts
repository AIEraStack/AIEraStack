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
  | 'utility'
  | 'python-web'
  | 'python-ai'
  | 'python-data'
  | 'go'
  | 'rust'
  | 'devops'
  | 'mobile'
  | 'desktop';

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
  'python-web': {
    label: 'Python Web',
    icon: '🐍',
    description: 'Python web frameworks and APIs',
  },
  'python-ai': {
    label: 'Python AI',
    icon: '🧠',
    description: 'Python AI/ML frameworks and tools',
  },
  'python-data': {
    label: 'Python Data',
    icon: '📊',
    description: 'Python data science and analysis',
  },
  'go': {
    label: 'Go',
    icon: '🔷',
    description: 'Go libraries and frameworks',
  },
  'rust': {
    label: 'Rust',
    icon: '🦀',
    description: 'Rust libraries and frameworks',
  },
  'devops': {
    label: 'DevOps',
    icon: '🚀',
    description: 'Infrastructure and deployment tools',
  },
  'mobile': {
    label: 'Mobile',
    icon: '📱',
    description: 'Mobile development frameworks',
  },
  'desktop': {
    label: 'Desktop',
    icon: '🖥️',
    description: 'Desktop application frameworks',
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

// New: Index structure for split storage
export interface RepoIndexEntry {
  owner: string;
  name: string;
  fullName: string;
  category: RepoCategory;
  featured: boolean;
  
  // Summary data for quick access
  stars: number;
  language: string;
  description: string;
  
  // Best score across all LLMs
  bestScore: number;
  bestGrade: string;
  
  updatedAt: string;
  fetchedAt: string;
}

export interface RepoIndex {
  version: number;
  generatedAt: string;
  repos: Record<string, RepoIndexEntry>; // key: owner/name
}

export const DATA_VERSION = 1;
