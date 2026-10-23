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
- Design: a "HUD" system modeled on getartcraft.com/apps (replaced the original grocery/paper concept; BUILD_BRIEF section 7 now describes it): sticky hairline-cell header with inverted hover, sharp corners, 1px hairlines, numbered "Aisle 00" sections, uppercase mono labels (labels, nav and badges only), signal-orange accent `#EE4F12` (light) / `#FF5A1F` (dark) plus per-aisle ink colors, warm-gray light and near-black dark. Fonts: Archivo (display), Instrument Serif (one italic phrase), IBM Plex Sans (body), Geist Mono. Tokens live in `apps/web/app/globals.css`; `tokens.test.ts` enforces WCAG AA. Never copy their assets, logo or copy. `/design` shows every component.

- Web data flow: `apps/web/lib/registry.ts` imports `public/registry.json` (copied from `registry/dist` by `scripts/copy-registry.mts` in predev, prebuild, pretypecheck and pretest). GitHub stars, dates and SKILL.md are fetched at build/ISR time and must never fail the build. Catalog search/filter/sort is pure code in `lib/search.ts`; filter state round-trips through the URL (`lib/filter-url.ts`).
- Tests: Vitest per package (web uses `vitest.config.ts` for JSX); Playwright smoke tests in `apps/web/e2e` run against `next start` on port 3100 after `pnpm build` (`pnpm --filter @agentsaisle/web test:e2e`).

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
