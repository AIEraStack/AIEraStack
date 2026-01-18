# AGENTS.md

> Context file for AI coding assistants (Cursor, Copilot, Windsurf, Claude, etc.)

## Project Overview

AI Era Stack evaluates how well LLMs understand GitHub projects, helping developers choose AI-friendly tech stacks.

Live site: https://aierastack.com

## Tech Stack

- **Framework**: Astro 5 (server-side rendering)
- **UI**: React 19 (islands architecture)
- **Styling**: Tailwind CSS 4
- **Hosting**: Cloudflare Pages
- **Storage**: Cloudflare R2
- **API**: Astro API routes (Cloudflare Pages runtime)
- **Adapter**: `@astrojs/cloudflare`

## Project Structure

```
├── src/
│   ├── components/       # React islands
│   │   ├── compare/      # Compare UI
│   │   ├── home/         # Homepage sections
│   │   └── repo/         # Repository analysis UI
│   ├── layouts/          # Astro layouts
│   ├── pages/            # Astro pages + API routes
│   │   ├── api/          # /api/repo
│   │   ├── badge/        # SVG badge routes
│   │   └── repo/         # Dynamic repo pages
│   ├── lib/              # Utilities, scoring, types
│   ├── data/             # Curated list + cache snapshots
│   └── styles/           # Global CSS
├── scripts/              # Data fetch + R2 sync scripts
└── public/               # Static assets
```

## Key Files

| File | Purpose |
|------|---------|
| `src/pages/index.astro` | Home page with search and curated sections |
| `src/pages/repo/[...slug].astro` | Repo page shell; preloads data for `RepoAnalyzer` |
| `src/pages/compare.astro` | Compare page shell; preloads data for `CompareSection` |
| `src/pages/api/repo.ts` | On-demand GitHub + npm fetch, scoring, R2 cache + index update |
| `src/pages/badge/[...path].ts` | SVG badge generation API |
| `src/components/repo/RepoAnalyzer.tsx` | Client repo analysis UI and fallback fetch |
| `src/components/compare/CompareSection.tsx` | Client compare UI |
| `src/lib/data-loader.ts` | R2/local cache read-write helpers |
| `src/lib/scoring.ts` | Scoring algorithm and weights |
| `src/lib/llm-configs.ts` | LLM configurations and cutoff dates |
| `src/data/curated-repos.json` | Curated repo list |
| `src/data/index.json` | Cached repo index (local fallback) |
| `scripts/fetch-data.ts` | Batch data fetch for curated repos |
| `scripts/r2-download.ts` | Download index + repo data from R2 |

## Architecture

### Rendering and Data Loading

- Astro renders the page shell and metadata. Repo and compare content are React islands.
- Server preloads cached data via `getCachedRepo` and passes `initialData` into islands.
- If `initialData` is missing or mismatched, the island fetches `/api/repo` on the client.

### Cache Layout

- R2 stores `index.json` plus per-repo files at `repos/{owner}/{name}.json`.
- Local fallback uses `src/data/index.json` and `src/data/repos/`.

### Scoring Algorithm

6 dimensions weighted:
1. **Coverage** (25%): release and activity vs LLM cutoff
2. **Adoption** (20%): stars, forks, and npm downloads
3. **Documentation** (15%): README size and docs/examples/changelog presence
4. **AI Readiness** (15%): TypeScript/types, llms.txt, topics, license
5. **Momentum** (15%): commit frequency and release cadence
6. **Maintenance** (10%): issue ratio and PR close time

### Data Flow

```
Request /repo/owner/name or /compare?repos=...
    |
    v
Astro page calls getCachedRepo (R2 -> local)
    |
    +-- cache hit -> pass initialData to React island
    |
    +-- cache miss -> call /api/repo
                        |
                        v
                 GitHub + npm fetch
                 calculateScores()
                 save repo + update index in R2
                        |
                        v
                 pass initialData to React island
    |
    v
React island renders; if initialData is missing, it fetches /api/repo client-side
```

## Development Commands

```bash
npm run dev              # Start dev server (localhost:4321)
npm run build            # Production build
npm run preview          # Preview production build
npm run fetch-data       # Fetch data for curated repos (needs GITHUB_TOKEN)
npm run r2:download:all  # Download index + repos from R2 (needs wrangler auth)
```

## Code Style

- **English only** - All code, comments, commit messages, and documentation (except `docs/` folder) must be in English
- TypeScript strict mode
- React functional components with hooks
- Astro components for static/SSR content
- CSS via Tailwind utilities
- No `any` types or `@ts-ignore`

## Common Tasks

### Add a new curated repo
Edit `src/data/curated-repos.json`, then run `npm run fetch-data` to refresh `src/data/index.json` and `src/data/repos/`.

### Modify scoring algorithm
Edit `src/lib/scoring.ts` -> `calculateScores()` and helper functions.

### Add new LLM
Edit `src/lib/llm-configs.ts`, add to `LLM_CONFIGS`.

### Sync local cache from R2
Run `npm run r2:download:all` (requires wrangler auth or Cloudflare API credentials).

### Change design/styling
Global styles in `src/styles/global.css`, component styles via Tailwind classes.

## Key Decisions

1. **Astro SSR + React islands** - render metadata server-side, interactive UI client-side
2. **R2 over database** - JSON storage is simpler and sufficient
3. **Astro API routes** over separate Functions - keep endpoints in `src/pages/api`
4. **No auth** - public tool, no user accounts needed

## Deployment

Configured for Cloudflare Pages:

- Build output: `dist` (`pages_build_output_dir` in `wrangler.toml`)
- R2 binding: `DATA_BUCKET` -> `aierastack-data`
- Optional environment variable: `GITHUB_TOKEN` for GitHub API rate limits

## Things to Avoid

- **Don't use Chinese** - All codebase content must be in English (except internal `docs/` folder)
- Don't add authentication complexity
- Don't add a database (R2 JSON is fine)
- Don't over-engineer the scoring algorithm
- Don't add features without clear user value
- Keep changes minimal and focused
- Prefer editing existing files over creating new ones
