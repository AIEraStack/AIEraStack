# AI Era Stack

**Stop using libraries Copilot doesn't know.**

AI Era Stack helps developers evaluate how well LLMs (GPT, Claude, Gemini) understand GitHub projects—so you can pick the right stack for AI-assisted coding.

[**Try it live →**](https://aierastack.com)

![AI Era Stack Screenshot](https://aierastack.com/og-image.png)

## The Problem

You're building with Cursor/Copilot, but your AI keeps hallucinating APIs. Why?

- **New libraries** released after LLM training cutoff
- **Rapid updates** that outpace AI knowledge
- **Poor documentation** that wasn't in training data

## The Solution

AI Era Stack analyzes any GitHub project and scores it across 4 dimensions:

| Dimension | Weight | What it measures |
|-----------|--------|------------------|
| **Timeliness** | 35% | Is the latest release within LLM training data? |
| **Popularity** | 30% | Stars + npm downloads = more training exposure |
| **AI-Friendliness** | 20% | TypeScript, llms.txt, good docs |
| **Community** | 15% | Issue health, active maintenance |

## Features

- **Score any GitHub repo** — just visit `/repo/owner/name`
- **Compare across LLMs** — see which AI knows your stack best
- **Curated catalog** — 59 popular projects pre-analyzed
- **Real-time analysis** — uncached repos fetched on-demand

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | [Astro 5](https://astro.build) (hybrid mode) |
| UI | [React 19](https://react.dev) (islands) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Hosting | [Cloudflare Pages](https://pages.cloudflare.com) |
| Storage | [Cloudflare R2](https://www.cloudflare.com/r2) |
| API | Astro API routes (Workers) |

### Architecture

```
/repo/facebook/react
        ↓
┌──────────────────────┐
│  Cached in R2?       │
│  (curated projects)  │
└──────────┬───────────┘
           │
    YES ───┼─── NO
           │     │
           ▼     ▼
┌──────────┐   ┌──────────────┐
│ SSR page │   │ CSR + API    │
│ (SEO)    │   │ (on-demand)  │
└──────────┘   └──────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Fetch data for curated repos (requires GITHUB_TOKEN)
GITHUB_TOKEN=xxx npm run fetch-data
```

## Deployment

Deployed automatically via GitHub Actions:

1. **Daily** — Updates data for curated repos
2. **On push** — Builds and deploys to Cloudflare Pages

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare deployment |
| `CLOUDFLARE_API_TOKEN` | Cloudflare deployment + R2 |
| `DATA_GITHUB_TOKEN` | GitHub API for data fetching |

## Why This Exists

In the AI-assisted coding era, your choice of libraries matters more than ever. A well-documented, popular library with stable APIs will get better AI support than a cutting-edge but obscure one.

AI Era Stack quantifies this tradeoff.

## License

MIT

---

Built by [Your Name](https://github.com/yourusername) — [Twitter](https://twitter.com/yourhandle)
