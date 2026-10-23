# Agent Aisle

A store for Agent Skills (SKILL.md folders for Claude Code, Codex, Cursor, etc.): a website, a CLI (`aisle`) and a registry. Full spec: `BUILD_BRIEF.md` (source of truth; re-read the relevant section before each milestone).

## Stack (fixed, do not substitute)

- Monorepo: pnpm workspaces + Turborepo
- Web: Next.js (App Router, latest stable), React, TypeScript strict, Tailwind
- CLI: Node + TypeScript, `tsup` bundle, `commander`, `@clack/prompts`, `tar`
- Validation: `zod` schemas shared by web, CLI and CI
- Tests: Vitest (packages), Playwright (few web smoke tests)
- Hosting: Vercel (site), npm `@agentsaisle/cli` (bin: `aisle`), GitHub (registry + our skills)

## Layout

```
apps/web/                  Next.js site
packages/cli/              the `aisle` command
packages/registry-schema/  zod schemas + types shared by all
registry/official/         our skills (<name>/SKILL.md + skill.meta.yaml)
registry/community/        one YAML per community skill (pointer to GitHub, pinned SHA)
registry/build.ts          compiles everything into dist/registry.json
.github/workflows/         CI: validate registry, test, publish
```

## Key design points

- `registry.json` (served at `/registry.json`) is the single source of truth for site and CLI.
- Community versions are pinned to full commit SHAs; official versions come from git tags `<name>@<version>`.
- CLI install: resolve name@version -> SHA, download codeload tarball, extract only the skill path to temp, validate SKILL.md frontmatter, warn on `scripts/` / `runs_scripts`, confirm overwrite, move into place, update `aisle-lock.json`. Cache registry 10 min. Cross-platform (use `path`, `os.homedir()`, no shell commands).
- Claude Code skill paths: project `.claude/skills/<name>/`, global `~/.claude/skills/<name>/`. Other agents' paths live in one config map with `TODO(verify)` where unsure.
- Site: static generation + hourly ISR; GitHub stars optional via `GITHUB_TOKEN` (build must succeed without it); client-side search; render SKILL.md with `react-markdown` + `rehype-sanitize`, never raw HTML.
- Design (before any UI work): grocery-aisle concept: product-label cards, receipt for bundles, warm paper tones, one accent color, distinctive display face (no Inter/Roboto/Arial), monospace for commands, small motion respecting `prefers-reduced-motion`. Avoid purple-blue gradients, glassmorphism, generic 3-card hero, emoji icons, centered-everything. Build design system first and show one page before the rest.

## Rules

- Plan mode at the start of each milestone; wait for approval. Work one milestone at a time and stop after it with a summary (built, tested, decisions needed).
- Small commits, one logical change each, clear messages.
- Write tests alongside code.
- No dependencies beyond the stack without asking.
- No secrets in code; use `.env.local` and document vars in `.env.example`.
- Never execute code from downloaded skills (CLI or CI).
- Ask before: publishing to npm, deploying, changing the stack, deleting files I didn't create.
- If the brief is wrong (path, flag, API), say so and propose a fix; don't work around it silently.

## Milestones

1 Foundation · 2 CLI core · 3 Design system · 4 Website pages · 5 Profiles + submit · 6 Ship
