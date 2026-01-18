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
  // System Layer
  | 'system-languages'
  
  // Frontend - Framework Comparison
  | 'frontend-frameworks-core'
  | 'frontend-frameworks-alt'
  | 'frontend-frameworks-html'
  
  // Frontend - Ecosystem
  | 'frontend-react-ecosystem'
  | 'frontend-vue-ecosystem'
  | 'frontend-svelte-ecosystem'
  
  // Backend - Framework Comparison
  | 'backend-go-web'
  | 'backend-python-web'
  | 'backend-rust-web'
  | 'backend-nodejs-api'
  
  // Backend - Data Layer
  | 'backend-go-data'
  | 'backend-rust-data'
  | 'backend-database-clients'
  
  // AI & ML - JS/TS
  | 'ai-js-sdks'
  
  // AI & ML - Python
  | 'ai-python-frameworks'
  | 'ai-python-sdks'
  
  // Data Science
  | 'data-core'
  | 'data-ml'
  | 'data-apps'
  
  // UI & Design
  | 'ui-design-systems'
  | 'ui-headless'
  
  // State & Data Management
  | 'state-stores'
  | 'state-data-fetching'
  
  // Developer Tooling
  | 'tooling-bundlers'
  | 'tooling-runtimes'
  | 'tooling-workflow'
  | 'tooling-testing'
  | 'tooling-utilities'
  
  // Infrastructure & DevOps
  | 'infra-containers'
  | 'infra-iac'
  | 'infra-observability'
  
  // Cross-Platform
  | 'cross-platform-mobile'
  | 'cross-platform-desktop'
  | 'cross-platform-cli';

export const CATEGORY_META: Record<RepoCategory, { label: string; icon: string; description: string }> = {
  // System Layer
  'system-languages': {
    label: 'Backend Languages',
    icon: '🌐',
    description: 'Python, Go, Rust language ecosystems',
  },
  
  // Frontend - Framework Comparison
  'frontend-frameworks-core': {
    label: 'Core Frameworks',
    icon: '⚛️',
    description: 'React, Vue, Preact - mainstream choices',
  },
  'frontend-frameworks-alt': {
    label: 'Alternative Frameworks',
    icon: '🏗️',
    description: 'Svelte, Astro, Angular, Solid, Qwik - modern alternatives',
  },
  'frontend-frameworks-html': {
    label: 'HTML-First Frameworks',
    icon: '📄',
    description: 'HTMX, Alpine, Turbo - lightweight HTML-first approaches',
  },
  
  // Frontend - Ecosystem
  'frontend-react-ecosystem': {
    label: 'React Ecosystem',
    icon: '⚛️',
    description: 'Next.js, Remix, Gatsby - React meta-frameworks',
  },
  'frontend-vue-ecosystem': {
    label: 'Vue Ecosystem',
    icon: '💚',
    description: 'Nuxt, Router, Pinia - Vue meta-frameworks and tools',
  },
  'frontend-svelte-ecosystem': {
    label: 'Svelte Ecosystem',
    icon: '🧡',
    description: 'SvelteKit, Vite Plugin - Svelte tooling',
  },
  
  // Backend - Framework Comparison
  'backend-go-web': {
    label: 'Go Web Frameworks',
    icon: '🔷',
    description: 'Gin, Fiber, Echo, Chi - Go web frameworks',
  },
  'backend-python-web': {
    label: 'Python Web Frameworks',
    icon: '🐍',
    description: 'FastAPI, Django, Flask, Starlette - Python web',
  },
  'backend-rust-web': {
    label: 'Rust Web Frameworks',
    icon: '🦀',
    description: 'Tokio, Axum, Actix - Rust async web',
  },
  'backend-nodejs-api': {
    label: 'Node.js API Frameworks',
    icon: '🔌',
    description: 'tRPC, Hono, Fastify, Express - Node.js APIs',
  },
  
  // Backend - Data Layer
  'backend-go-data': {
    label: 'Go Data Libraries',
    icon: '💾',
    description: 'GORM, Ent, sqlc - Go ORMs and data',
  },
  'backend-rust-data': {
    label: 'Rust Data Libraries',
    icon: '🦀',
    description: 'Serde, SQLx, SeaORM, Diesel - Rust data',
  },
  'backend-database-clients': {
    label: 'Database Clients',
    icon: '🗄️',
    description: 'Prisma, Drizzle, Kysely - TypeScript ORMs',
  },
  
  // AI & ML - JS/TS
  'ai-js-sdks': {
    label: 'AI SDKs (JS/TS)',
    icon: '🤖',
    description: 'Vercel AI, LangChain, OpenAI, Anthropic - TS SDKs',
  },
  
  // AI & ML - Python
  'ai-python-frameworks': {
    label: 'AI Frameworks',
    icon: '🧠',
    description: 'LangChain, LlamaIndex, CrewAI - AI orchestration',
  },
  'ai-python-sdks': {
    label: 'LLM SDKs (Python)',
    icon: '💬',
    description: 'OpenAI, Anthropic, Transformers, Cohere - Python SDKs',
  },
  
  // Data Science
  'data-core': {
    label: 'Data Processing',
    icon: '📊',
    description: 'Pandas, NumPy, Polars, Arrow - data core',
  },
  'data-ml': {
    label: 'Machine Learning',
    icon: '🤖',
    description: 'PyTorch, scikit-learn, TensorFlow - ML frameworks',
  },
  'data-apps': {
    label: 'Data Apps',
    icon: '📈',
    description: 'Streamlit, Gradio - data visualization apps',
  },
  
  // UI & Design
  'ui-design-systems': {
    label: 'Design Systems',
    icon: '🎨',
    description: 'Tailwind, shadcn/ui, Material UI - complete systems',
  },
  'ui-headless': {
    label: 'Headless UI',
    icon: '🎭',
    description: 'Radix, HeadlessUI, Mantine - unstyled components',
  },
  
  // State & Data Management
  'state-stores': {
    label: 'State Stores',
    icon: '🔄',
    description: 'Zustand, Redux, Jotai, XState - global state',
  },
  'state-data-fetching': {
    label: 'Data Fetching',
    icon: '🔀',
    description: 'TanStack Query, Router - server state',
  },
  
  // Developer Tooling
  'tooling-bundlers': {
    label: 'Bundlers',
    icon: '📦',
    description: 'Vite, Webpack, esbuild, Rolldown - build tools',
  },
  'tooling-runtimes': {
    label: 'Runtimes',
    icon: '⚡',
    description: 'Node, Deno, Bun, Workerd - JavaScript runtimes',
  },
  'tooling-workflow': {
    label: 'Dev Workflow',
    icon: '🛠️',
    description: 'Biome, Turbo, pnpm - dev tooling',
  },
  'tooling-testing': {
    label: 'Testing',
    icon: '🧪',
    description: 'Vitest, Playwright, Cypress - testing tools',
  },
  'tooling-utilities': {
    label: 'Utilities',
    icon: '🔧',
    description: 'Zod, date-fns, lodash - utility libraries',
  },
  
  // Infrastructure & DevOps
  'infra-containers': {
    label: 'Containers',
    icon: '🐳',
    description: 'Docker, Kubernetes - container orchestration',
  },
  'infra-iac': {
    label: 'Infrastructure as Code',
    icon: '🏗️',
    description: 'Terraform, Pulumi, Helm - IaC tools',
  },
  'infra-observability': {
    label: 'Observability',
    icon: '📊',
    description: 'Grafana, Prometheus - monitoring',
  },
  
  // Cross-Platform
  'cross-platform-mobile': {
    label: 'Mobile',
    icon: '📱',
    description: 'React Native, Expo, Flutter - mobile frameworks',
  },
  'cross-platform-desktop': {
    label: 'Desktop',
    icon: '🖥️',
    description: 'Electron, Tauri - desktop frameworks',
  },
  'cross-platform-cli': {
    label: 'CLI',
    icon: '⌨️',
    description: 'oclif, Commander, yargs - CLI frameworks',
  },
};

export interface DocSignals {
  readmeSize: number;
  hasDocsDir: boolean;
  hasExamplesDir: boolean;
  hasChangelog: boolean;
}

export interface ActivitySignals {
  recentCommitsCount: number; // Last 30 commits
  commitFrequency: number; // Commits per week (based on recent 30)
  avgDaysBetweenReleases: number; // Based on recent releases
  recentClosedPRsCount: number; // Last 30 closed PRs
  avgPRCloseTimeHours: number; // Average time to close/merge PRs (hours)
}

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

  docSignals: DocSignals;
  activitySignals: ActivitySignals;

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
  
  // Per-LLM scores for sorting (only overall + grade)
  scoresByLLM: Record<string, { overall: number; grade: string }>;
  
  updatedAt: string;
  fetchedAt: string;
}

export interface RepoIndex {
  version: number;
  generatedAt: string;
  repos: Record<string, RepoIndexEntry>; // key: owner/name
}

export const DATA_VERSION = 2;
