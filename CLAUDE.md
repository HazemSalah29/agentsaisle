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
- Profiles: `registry/profiles.yaml` holds starter bundles (`aisle init --profile <id>`) and the picker's questions; the build fails if it names a skill that doesn't exist, and both ship inside `registry.json` (`profiles`, `questions`; optional with defaults so old caches parse). The website's `/profiles` picker builds bundles with `lib/bundle.ts`.
- Community submissions: `/submit` generates the YAML (`lib/yaml-entry.ts`; always quotes `sha`, `version`, `ref`) and links to a prefilled GitHub new-file page. CI (`.github/workflows/validate-registry.yml`, `registry/validate.ts`, `pnpm registry:validate`) checks each changed entry: schema, file name, unique name, repo public, commits exist, SKILL.md frontmatter and name, undeclared `scripts/`, `verified` only by the owner. It also runs on pushes to `m5-test-**` branches. The validator only reads text from GitHub; it never runs submitted code.
- Shipping: the site deploys from `main` to Vercel (project root `apps/web`, settings in `apps/web/vercel.json`, env `GITHUB_TOKEN`; the public URL comes from `SITE_URL` or Vercel's production address). Official versions are pinned by git tag `<name>@<version>`; the registry build resolves tags locally, then via the GitHub API, and fails in CI/Vercel rather than pinning HEAD, so **push the tag before merging a new official skill**. The CLI (`@agentsaisle/cli`, version in `packages/cli/package.json`) defaults to `https://agentsaisle-vercel.vercel.app/registry.json`; publish manually with `npm publish --access public` from `packages/cli` (or push a `cli-vX.Y.Z` tag with an `NPM_TOKEN` secret set).

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

- Skill tooling (V2): `registry/_shared/*.md` are shared fragments (`house-rules.md` becomes `houseRules` in `registry.json` for `aisle init`). A skill may keep `SKILL.src.md` with `<!-- include: _shared/x.md -->` markers; `pnpm skills:build` writes the committed `SKILL.md` and `pnpm skills:check` (also in the registry build and `pnpm lint`) fails if it is stale. `pnpm lint:skills` enforces the house standard (`registry/lint-skills.ts`); the legacy exemption mechanism still exists but its list in `registry/lint-skills.config.json` is empty because every skill now meets the standard. Skills with `niche: core` (the core kit) keep short names; every other skill is named `<niche>-<task>`. Generated `SKILL.md` and `SKILL.src.md` are excluded from Prettier so the generated file stays byte-identical to its source. The CLI never installs `evals/`, `preview/`, the root `README.md` or `SKILL.src.md`.

- Milestone 8 state: 12 skills exist (baseline `code-quality`, `web-performance`, `web-security`; core kit `plan`, `implement`, `explore`, `review`, `edit`, `commit` at 1.1.0; new core `verify`, `handoff`, `budget`). **They are untested**: no eval harness exists yet (deliberately deferred to avoid API spend), so there is no `tested` block, no numbers and no performance claims anywhere, and under V2's gate rule they stay on `stage` and are not merged to `main`. Skill scripts are plain Node ES modules with unit tests in `registry/skill-tests/` (outside the skill folders so tests are never installed); every script must start itself through `realpathSync` (a symlinked folder otherwise makes it silently do nothing, covered by a regression test). Verified official skills list their scripts at install without asking; community and unverified skills still ask. New versions need their git tags pushed before a branch builds on Vercel.

- Milestone 9 state: `design-motion-portfolio` (version 0.1.0, draft, untested like the other new skills) has its full kit in `registry/official/design-motion-portfolio/assets/kit/` (17 components, tokens, motion tokens), `scripts/install-kit.mjs`, `design-lint.mjs`, `screenshot.mjs`, `assets/DESIGN.md`, two references and `preview/*.jpg`. The screenshots were captured from a throwaway demo site (Lowtide Studio) that was deleted at the owner's request; it is recoverable from git history at commit 62f105c (`demos/motion-portfolio`), including the 42 component tests (the token tests moved to `registry/skill-tests/`). Script tests live in `registry/skill-tests/`. Lighthouse on that demo (mobile, measured before deletion): performance 95 to 97, accessibility 98 to 100; first-load JS is about 190 kB gzip, so `install-kit` writes `perf.config.json` with a 220 kB budget. The kit uses `LazyMotion` and loads Lenis after first paint. Skill pages show `demo.screenshots` from `preview/` (copied to `apps/web/public/previews/` by `copy-registry.mts`; the linter checks the files exist). Tailwind spacing is an 8 px scale in this kit (`w-40` is 320 px). The tag `design-motion-portfolio@0.1.0` is **not pushed yet**; push it before `stage` builds on Vercel.

- Milestone 10 state: `design-clean-saas` (0.1.0, draft, untested) has the 17-component minimal kit (plus `FadeUp`, tokens, `validate.ts`, stub server actions in `actions.ts`) in `registry/official/design-clean-saas/assets/kit/`, adapted copies of the three scripts (`design-lint` adds gradient, glass, blob, icon-set, shadow, radius, palette and animation-library rules), `DESIGN.md`, two references and 16 `preview/*.jpg`. There is no demo workspace: the screenshots came from a throwaway Next.js site built outside the repo with `install-kit` (a fresh-project test: 4 pages, design-lint clean, build ok, JS 136 kB gzip per route so `install-kit` writes a 160 kB `perf.config.json`; Lighthouse mobile 99 performance, 100 accessibility, 96 best practices, 100 SEO; reduced motion leaves nothing hidden). No component render tests exist for either design kit (they need React); token, script, validation and action tests live in `registry/skill-tests/`. The kit has no animation dependency; the only dependency a user installs is `lucide-react`. The tag `design-clean-saas@0.1.0` is **not pushed yet**.

- Milestone 13 state (no paid evals): seven new untested 0.1.0 skills (`db-schema`, `db-migrate`, `db-optimize-query`, `db-seed`, `test-write`, `test-fix`, `debug-trace`), each with deterministic text-only scripts and tests in `registry/skill-tests/`. `registry/aisles.yaml` groups niches into aisles (Baseline, Web design, Frontend, Database, Testing and debugging, Media = coming later); the build requires every official niche to sit in exactly one aisle. `registry/elsewhere.yaml` lists 13 other-author skills (link out, license shown, never installed or copied); they were checked against the public repos and `pnpm registry:validate-elsewhere` repeats that check on demand (network, never part of the build). Two repos were dropped for having no license (remotion-dev/skills, vercel-labs web-design-guidelines). Kits are profiles with an `aisle` field (`motion-portfolio-site`, `clean-saas-site`; install with `aisle init --profile`). The site has `/aisles` and `/aisles/[id]`, and an "Untested" badge on official skills without a `tested` block (skill page note included). The `--allow-external` flag from the V2 brief is deferred. New skill tags (`db-schema@0.1.0` and the other six) must be pushed before `stage` builds on Vercel.

## Branches

`main` is the deployed branch (Vercel production, `/registry.json`); never push to it directly. Develop on `stage`, use `test` for testing, and merge `stage` into `main` with a pull request so CI runs first.

## V2: curated skills (`V2_BRIEF.md` is the spec; BUILD_BRIEF rules still apply)

V2 turns the catalog into deep, opinionated, measured skills: a baseline layer (`code-quality`, `web-performance`, `web-security`, core kit, house rules), two design skills with real component kits (`design-motion-portfolio`, `design-clean-saas`), media skills (`image-logo`, `video-explainer`, `video-cartoon-episode`, `video-slapstick-chase`), database/testing/debugging skills, preview pages with measured numbers, and an "Elsewhere" shelf of other authors' public skills. Milestones 7 to 14, in order, one per session, each starting in plan mode.

- **IP:** never copy another author's code, components, copy, images or layout into an official skill. The two inspiration sites are commercial templates; capture the genre with original work only. Third-party skills may be listed and linked, never copied. Media skills refuse to recreate copyrighted or trademarked characters, logos or real people's likeness and offer original ones instead.
- **Honesty:** no skill guarantees a first-try result; media skills minimize regeneration and say so. Every number on the site comes from the eval harness, never hand-written.
- **House standard:** `SKILL.md` at most 150 lines (Use when, Don't use when, Steps, Budget, Output, Done when); `references/` one level deep; `scripts/` deterministic and never fetching remote code; `evals/`, `preview/` and `README.md` are not installed; names are `<niche>-<task>`; style and expensive media skills set `disable-model-invocation: true`; shared rules come from `registry/_shared/*.md` through `<!-- include: _shared/x.md -->` markers; `skill.meta.yaml` carries niche, kind (saver or quality), tier, tested, permissions and demo.
- **Gates:** saver skills need median token savings of 30% or more with success at least baseline; quality skills need success above baseline with tokens within +10%; both need a blind comparison against the best public alternative and trigger and safety tests. A skill that fails a gate does not ship.
- **Process:** ask before adding any dependency, paid API call or provider; check official docs for current library and provider APIs and write `TODO(verify)` where unsure; show intermediate results early in creative milestones (9, 10, 12); run evals with a Console API key from the environment and print the cost.

## Audit + arabic-rtl (`AUDIT_RTL_BRIEF.md` is the spec; BUILD_BRIEF and V2 rules still apply)

Part A: `aisle audit`, a static security scanner (`packages/audit/`, MIT, pure functions, no network). Part B: the `arabic-rtl` skill (+ `rtl-check` companion). Milestones A1 to A4 and B1 to B3, one per session, each starting in plan mode; order A1, A2, B1, B2, A3, B3, A4.

- **Never execute, import or `require` anything from an audited skill**, including in tests. Read as text only. Extraction is hardened (no absolute paths, `..`, symlinks; caps 20 MB archive, 2,000 files, 2 MB per file).
- **Honesty:** an audit reduces risk, it cannot prove safety. Every report and page carries: "Automated checks found no known risky patterns. This is not a guarantee of safety."
- Rule IDs `AA-S/P/I/X/E/N/K/U`; each rule has one malicious (inert: `example.com`/`example.invalid`, fake paths, labeled test data) and one benign fixture. Zero false criticals on registry skills and benign fixtures. Grade A to F (F = any critical). Critical findings are not author-suppressible; suppressions need a reason of 15+ chars and are always listed.
- `Report`/`Finding` zod types live in `packages/registry-schema`. Exit codes: 0 clean, 1 findings at or above `--fail-on` (default high), 2 audit couldn't run. `aisle add` audits before install: critical blocks (needs `--force` plus typed skill name; `--yes` never bypasses), high asks, `--no-audit` warns.
- U03/U04 must ignore ZWNJ/ZWJ next to Arabic letters and bidi marks inside Arabic runs; `arabic-rtl` must grade A. Never put bidi control characters in code; use markup and CSS.
- `--deep` (A4): nonce-fenced untrusted data, zod-validated JSON, findings only added (`source: "deep"`), cost printed first.
- `arabic-rtl`: `kind: quality`, `disable-model-invocation: true`, Next.js App Router + Tailwind first; scripts are Node >= 18, no network, read-only unless `--write`, output capped at 40 lines; codemod is dry-run by default and idempotent; decisions saved once in `i18n.config.json`. Translation is a draft: write `translation-review.md`, recommend native review; owner spot-checks before numbers are published.
- Ask before: dependencies, any paid API call, publishing the GitHub Action or npm, deploying. Verify next-intl, Tailwind logical utilities, Intl calendars, Claude Code skill syntax and SARIF against current docs, else `TODO(verify)` and tell the owner. Show scan/codemod output on the fixture in B1 before writing skill text.
- Decisions so far (A1): `AA-S08` (extra rule, not in the brief) reports an invalid `.aisleaudit.yaml` (medium; the whole file is ignored) or an attempt to suppress a critical finding (low), so it is stored in reports. `aisle add` audits installed files only; `aisle audit`, registry CI and the Action scan every file (`includeUninstalled`), and oversized non-executable media are skipped with a note instead of aborting (A2). `AA-P02` stays strict (write + interpreter shell without `disable-model-invocation`). A3 adds an `inventory` object (tools, scripts, urls, domains) to `Report` for the skill page; `AA-P06`/`AA-N03` stay as info findings. `AA-P04` syntax was verified against the Claude Code skills docs (2026-10-24).
- Decisions (A2): `aisle audit` ships `pretty` and `json` only (`sarif`/`markdown` exit 2 until A3; `--deep` exits 2 until A4). The guard (`packages/cli/src/guard.ts`) runs in `add`, `update` and `init` with `--force` and `--no-audit`; critical needs `--force` plus the typed name (`ctx.typed`, never answered by `--yes`, fails without a TTY). `@agentsaisle/audit` is a workspace devDependency inlined by tsup, and CI builds `@agentsaisle/audit...` before lint. Extraction (`downloadSkill`) now rejects absolute paths, `..`, hardlinks and devices, caps 20 MB archive / 2,000 files / 2 MB per file (plus a 256 MB unpacked bomb guard); symlinks are extracted only for the audit (`links: "keep"`) and stripped before install. `AA-S09` (info) notes oversized media in a local folder; remote archives with a file over 2 MB are refused at extraction. Local audit targets must look like paths (`./`, `/`, `~`).
