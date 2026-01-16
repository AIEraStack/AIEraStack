# AGENTS.md

> Context file for AI coding assistants (Cursor, Copilot, Windsurf, Claude, etc.)

## Project Overview

**AI Era Stack** evaluates how well LLMs understand GitHub projects, helping developers choose AI-friendly tech stacks.

**Live site**: https://aierastack.com

## Tech Stack

- **Framework**: Astro 5 (hybrid SSR/SSG)
- **UI**: React 19 (islands architecture)
- **Styling**: Tailwind CSS 4
- **Hosting**: Cloudflare Pages
- **Storage**: Cloudflare R2
- **API**: Cloudflare Pages Functions

## Project Structure

```
├── src/
│   ├── components/       # React components (islands)
│   │   └── repo/         # Repository analysis components
│   ├── layouts/          # Astro layouts
│   ├── pages/            # Astro pages (file-based routing)
│   │   └── repo/         # Dynamic repo pages
│   ├── lib/              # Shared utilities and types
│   ├── data/             # Curated repos config
│   └── styles/           # Global CSS
├── functions/            # Cloudflare Pages Functions
│   └── api/              # API endpoints
├── scripts/              # Data fetching scripts
└── public/               # Static assets
```

## Key Files

| File | Purpose |
|------|---------|
| `src/pages/repo/[...slug].astro` | Dynamic repo pages (SSR) |
| `src/pages/api/repo.ts` | On-demand GitHub data fetching API |
| `src/pages/badge/[...path].ts` | SVG badge generation API |
| `src/components/repo/RepoAnalyzer.tsx` | Client-side repo analysis |
| `src/lib/data-loader.ts` | Load cached repo data from R2 |
| `src/lib/llm-configs.ts` | LLM configurations and cutoff dates |
| `src/data/curated-repos.json` | List of pre-cached repositories |
| `scripts/fetch-data.ts` | Batch data fetching script |

## Architecture

### Hybrid Rendering

- **Cached repos** (59 curated projects): SSR from R2 data, SEO optimized
- **Uncached repos**: CSR with React, fetches via `/api/repo` endpoint

### Scoring Algorithm

4 dimensions weighted:
1. **Timeliness** (35%): Release date vs LLM training cutoff
2. **Popularity** (30%): GitHub stars + npm downloads
3. **AI-Friendliness** (20%): TypeScript, llms.txt presence
4. **Community** (15%): Issue response health

### Data Flow

```
User visits /repo/owner/name
       ↓
[...slug].astro checks R2 cache
       ↓
┌─────────────────┐     ┌──────────────────┐
│ Cached?         │ YES │ Render full HTML │
└────────┬────────┘     └──────────────────┘
         │ NO
         ↓
┌─────────────────┐     ┌──────────────────┐
│ Render React    │────→│ Call /api/repo   │
│ <RepoAnalyzer>  │     │ → GitHub API     │
└─────────────────┘     │ → Calculate      │
                        │ → Cache to R2    │
                        └──────────────────┘
```

## Development Commands

```bash
npm run dev          # Start dev server (localhost:4321)
npm run build        # Production build
npm run fetch-data   # Fetch data for curated repos (needs GITHUB_TOKEN)
```

## Code Style

- **English only** — All code, comments, commit messages, and documentation (except `docs/` folder) must be in English
- TypeScript strict mode
- React functional components with hooks
- Astro components for static/SSR content
- CSS via Tailwind utilities
- No `any` types or `@ts-ignore`

## Common Tasks

### Add a new curated repo
Edit `src/data/curated-repos.json`, add entry with owner, name, category.

### Modify scoring algorithm
Edit `src/lib/scoring.ts` → `calculateScores()` function.

### Add new LLM
Edit `src/lib/llm-configs.ts`, add to `LLM_CONFIGS` array.

### Change design/styling
Global styles in `src/styles/global.css`, component styles via Tailwind classes.

## Key Decisions

1. **Hybrid rendering** over pure SSR or SSG — balances SEO for popular repos with flexibility for any repo
2. **R2 over database** — simpler, JSON-based, good enough for this use case
3. **Astro API routes** over separate Functions — unified codebase, TypeScript support, better DX
4. **No auth** — public tool, no user accounts needed

## Deployment

Deployed via **GitHub Actions + Cloudflare Pages (Direct Upload)**:

1. **Build workflow** (`.github/workflows/build.yml`):
   - Downloads `repos.json` from R2
   - Builds the project (`npm run build`)
   - Deploys to Cloudflare Pages via `wrangler pages deploy`

2. **Data update workflow** (`.github/workflows/update-data.yml`):
   - Runs daily at 6:00 AM UTC
   - Fetches fresh data for curated repos
   - Updates R2 cache
   - Triggers rebuild

3. **Cloudflare Pages Settings**:
   - Git integration: **Disabled** (using Direct Upload instead)
   - R2 binding: `DATA_BUCKET` → `aierastack-data`
   - Environment variables: Optional `GITHUB_TOKEN` for API rate limits

See `DEPLOYMENT.md` for detailed configuration.

## Things to Avoid

- **Don't use Chinese** — All codebase content must be in English (except internal `docs/` folder)
- Don't add authentication complexity
- Don't add a database (R2 JSON is fine)
- Don't over-engineer the scoring algorithm
- Don't add features without clear user value
- Keep changes minimal and focused
- Prefer editing existing files over creating new ones
