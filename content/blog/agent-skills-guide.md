---
title: "Agent Skills: The Capability Extension Standard for AI Coding Assistants"
description: "Agent Skills is a capability extension format for AI coding assistants, now adopted by 26+ AI development tools. Learn about its origin, usage, and popular Skills recommendations."
publishDate: "2025-01-28"
author: "AI Era Stack"
tags: ["agent-skills", "ai-coding", "claude-code", "cursor"]
---

Recently, a website called [skills.sh](https://skills.sh) quietly launched, backed by a rapidly forming ecosystem: **Agent Skills**.

This isn't a proprietary feature from a single company—it's an open standard now adopted by **26+ AI development tools**, including Claude Code, Cursor, GitHub Copilot, VS Code, OpenAI Codex, Gemini CLI, and more.

## What Are Agent Skills

Agent Skills is a **capability extension format for AI coding assistants**.

The core idea is simple: package instructions, scripts, and reference materials into a folder. When an AI reads it, it gains new abilities or domain expertise.

```
my-skill/
├── SKILL.md           # Main instruction file (required)
├── reference.md       # Reference docs (optional)
├── examples/          # Examples (optional)
└── scripts/           # Executable scripts (optional)
```

`SKILL.md` is the entry point, containing YAML frontmatter and Markdown instructions:

```yaml
---
name: code-review
description: Review code according to team standards
---

When reviewing code, check the following:
1. Does it follow naming conventions
2. Are there potential performance issues
3. Are there security vulnerabilities
4. Is test coverage sufficient
```

When you ask AI to help review code, it automatically loads this skill and executes according to your defined standards.

## Origin and Evolution

The Agent Skills format was originally developed by **Anthropic** and released alongside Claude Code (February 2025).

Unlike many companies that lock core features into their own products, Anthropic chose to open-source it as an open standard. This decision led to rapid ecosystem expansion:

- **[agentskills.io](https://agentskills.io)** — Official specification docs
- **[skills.sh](https://skills.sh)** — Skills directory and leaderboard built by Vercel
- **[github.com/anthropics/skills](https://github.com/anthropics/skills)** — Official example repository
- **[github.com/vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)** — Vercel's Skills collection (17,000+ stars)

Now, almost all mainstream AI coding tools support this format:

| Tool | Status |
|------|--------|
| Claude Code | Native support (creator) |
| Cursor | Supported |
| GitHub Copilot / VS Code | Supported |
| OpenAI Codex | Supported |
| Gemini CLI | Supported |
| Windsurf | Supported |
| Goose, Roo Code, Amp | Supported |
| Databricks, Spring AI | Supported |

## Why Skills Matter

AI models are already powerful, but they lack **context**:

- They don't know your team's coding standards
- They don't know your project's architectural conventions
- They don't know a framework's best practices
- They don't know domain-specific expertise

The traditional approach is to repeat this information in every prompt. Skills provide a more elegant solution: **write once, use everywhere**.

And because it's an open standard, the same skill works seamlessly across Claude Code, Cursor, and Copilot.

## skills.sh: The Skills Marketplace

[skills.sh](https://skills.sh), built by Vercel, is currently the most active Skills directory, offering:

- **Skills Leaderboard** — Sorted by popularity
- **Category Browsing** — Framework best practices, design, marketing, testing, etc.
- **One-Click Install** — Copy a command and you're ready

Popular Skills include:

| Category | Popular Skills |
|----------|---------------|
| Framework Best Practices | `react-best-practices`, `supabase-postgres`, `better-auth` |
| Design | `frontend-design`, `ui-ux-pro-max`, `canvas-design` |
| Dev Workflow | `systematic-debugging`, `test-driven-development` |
| Marketing | `seo-audit`, `copywriting`, `marketing-psychology` |
| Media Creation | `slide-deck`, `remotion-best-practices` |

## Vercel's Contribution

Vercel plays an important role in this ecosystem. Beyond building skills.sh, they've open-sourced a set of high-quality Skills:

**react-best-practices** — 40+ rules across 8 categories, distilling Vercel's decade of React/Next.js optimization experience:

- **Ordering** — Eliminate request waterfalls
- **Rendering** — Server vs Client Components
- **Data Fetching** — Caching, preloading, streaming
- **Core Web Vitals** — LCP, CLS, INP optimization

Core insight: **High-level architectural issues have far greater impact than local code optimizations**.

**composition-patterns** — Solving the Boolean Prop proliferation problem:

```jsx
// ❌ Not recommended
<Button primary small disabled loading />

// ✅ Recommended
<Button variant="primary" size="sm" state="loading" />
```

**web-design-guidelines** — UI code review rules covering responsive design, accessibility, and visual consistency.

## Getting Started

The Skills ecosystem provides a unified CLI tool—install with a single command:

### Installing Skills

```bash
# Search skills (interactive)
npx skills find

# Search by keyword
npx skills find typescript
npx skills find "react testing"

# Install from a repository
npx skills add vercel-labs/agent-skills
```

### Installation Options

```bash
# Install globally (user-level, available across all projects)
npx skills add vercel-labs/agent-skills -g

# Specify which AI tools to install to
npx skills add vercel-labs/agent-skills --agent claude-code cursor

# Install only specific skills
npx skills add vercel-labs/agent-skills --skill react-best-practices commit

# Skip confirmation prompts, install all
npx skills add vercel-labs/agent-skills --all
```

### Updates and Management

```bash
# Check for updates
npx skills check

# Update all installed skills
npx skills update
```

### Creating Your Own Skill

```bash
# Initialize a new skill
npx skills init my-skill
```

This creates a `my-skill/SKILL.md` template that you can fill in with your instructions. Once installed, invoke it in Claude Code with `/skill-name`, or let AI load it automatically based on context.

## Some Thoughts

Agent Skills represents an interesting trend: **knowledge in the AI era needs new packaging formats**.

Traditional documentation is written for humans—progressive, illustrated, narrative. But AI needs structured, executable, prioritized instructions.

This explains why more and more projects are maintaining files like `CLAUDE.md` and `AGENTS.md`—they're not for humans, they're for AI.

When all AI tools support the same standard, developer knowledge becomes portable across tools. Team standards, company best practices, and industry expertise can all be packaged as Skills—write once, work everywhere.

This may be a key turning point in AI-assisted development, moving from "Q&A mode" to "collaboration mode".

---

## Appendix: Related Skills for Popular Libraries

If you're using these libraries, install the corresponding Skills to enhance your AI coding assistant:

### React / Next.js Ecosystem

| Library | Related Skills | Install Command |
|---------|---------------|-----------------|
| React | `react-best-practices`, `react-patterns`, `composition-patterns` | `npx skills add vercel-labs/agent-skills --skill react-best-practices` |
| Next.js | `next-best-practices`, `next-cache-components`, `nextjs-app-router-patterns` | `npx skills add vercel-labs/agent-skills` |
| TanStack Query | `tanstack-query` | `npx skills find tanstack-query` |
| Zustand | `zustand-state-management` | `npx skills find zustand` |
| React Hook Form + Zod | `react-hook-form-zod` | `npx skills find react-hook-form-zod` |

### Vue / Nuxt Ecosystem

| Library | Related Skills | Install Command |
|---------|---------------|-----------------|
| Vue | `vue-best-practices`, `vue` | `npx skills find vue` |
| Nuxt | `nuxt`, `nuxt-ui`, `nuxt-modules`, `nuxt-content` | `npx skills find nuxt` |
| VueUse | `vueuse` | `npx skills find vueuse` |

### React Native / Expo

| Library | Related Skills | Install Command |
|---------|---------------|-----------------|
| React Native | `react-native-best-practices`, `react-native-architecture`, `react-native-design` | `npx skills add vercel-labs/agent-skills --skill react-native-best-practices` |
| Expo | `upgrading-expo`, `expo-deployment`, `expo-tailwind-setup`, `expo-api-routes`, `expo-cicd-workflows` | `npx skills add expo/agent-skills` |

### UI Component Libraries

| Library | Related Skills | Install Command |
|---------|---------------|-----------------|
| Tailwind CSS | `tailwind-css-patterns`, `tailwind-patterns`, `tailwind-v4-shadcn`, `tailwind-design-system` | `npx skills find tailwind` |
| shadcn/ui | `shadcn-ui`, `tailwind-v4-shadcn` | `npx skills find shadcn` |

### Backend & Database

| Library | Related Skills | Install Command |
|---------|---------------|-----------------|
| Supabase | `supabase-postgres-best-practices` | `npx skills find supabase` |
| FastAPI | `fastapi-templates` | `npx skills find fastapi` |
| NestJS | `nestjs-best-practices` | `npx skills find nestjs` |
| PostgreSQL | `postgresql-table-design`, `sql-optimization-patterns` | `npx skills find postgresql` |

### AI SDKs

| Library | Related Skills | Install Command |
|---------|---------------|-----------------|
| Vercel AI SDK | `ai-sdk` | `npx skills find ai-sdk` |
| LangChain | `langchain-architecture`, `rag-implementation` | `npx skills find langchain` |

### Authentication

| Library | Related Skills | Install Command |
|---------|---------------|-----------------|
| Better Auth | `better-auth-best-practices`, `nuxt-better-auth` | `npx skills find better-auth` |
| Auth (General) | `auth-implementation-patterns` | `npx skills find auth` |

### Tooling

| Library | Related Skills | Install Command |
|---------|---------------|-----------------|
| Turborepo | `turborepo`, `monorepo-management` | `npx skills find turborepo` |
| TypeScript | `typescript-advanced-types` | `npx skills find typescript` |
| Playwright | `webapp-testing`, `e2e-testing-patterns` | `npx skills find playwright` |

### Others

| Library | Related Skills | Install Command |
|---------|---------------|-----------------|
| Three.js | `threejs-fundamentals`, `threejs-animation`, `threejs-shaders`, `threejs-materials` | `npx skills find threejs` |
| Remotion | `remotion-best-practices` | `npx skills find remotion` |
| Obsidian | `obsidian-markdown`, `obsidian-bases` | `npx skills find obsidian` |
| SwiftUI | `swiftui-expert-skill` | `npx skills find swiftui` |

---

## Our Update

Speaking of how well AI understands libraries—this is exactly what we've been focusing on.

Using these Skills helps AI write better code for you—they provide best practices summarized by framework authors, so AI doesn't just "write code" but "writes good code".

This aligns with our vision: **helping developers make better technology choices in the AI era**.

---

*More information: [agentskills.io](https://agentskills.io) (official spec), [skills.sh](https://skills.sh) (Skills directory), [GitHub](https://github.com/vercel-labs/agent-skills) (Vercel Skills)*
