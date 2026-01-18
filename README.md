# AI Era Stack

**Stop using libraries AI doesn't know.**

AI Era Stack helps developers evaluate how well LLMs (Sonnet, Opus, Codex, Gemini) understand GitHub projects—so you can pick the right stack for AI-assisted coding.

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

## Why This Exists

In the AI-assisted coding era, your choice of libraries matters more than ever. A well-documented, popular library with stable APIs will get better AI support than a cutting-edge but obscure one.

AI Era Stack quantifies this tradeoff.

## Contributing

We welcome contributions! Feel free to:

- 🐛 **Report bugs** — [Open an issue](https://github.com/AIEraStack/aierastack/issues)
- 💡 **Suggest features** — [Start a discussion](https://github.com/AIEraStack/aierastack/issues)
- 🔧 **Submit pull requests** — Improvements, bug fixes, and new features are appreciated

## License

MIT

## Contact

- 📧 Email: [aierastack@outlook.com](mailto:aierastack@outlook.com)
- 𝕏 X/Twitter: [@AIEraStack](https://x.com/AIEraStack)
