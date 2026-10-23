# Agent Aisle V2 — Curated Skills Build Brief for Claude Code

## How to use this file

1. Put this file in the root of the existing `agent-aisle` repo as `V2_BRIEF.md`, next to `BUILD_BRIEF.md` and `CLAUDE.md`.
2. Open a **new** Claude Code session in VS Code and paste:
   > Read V2_BRIEF.md fully, then CLAUDE.md. Add a short "V2" section to CLAUDE.md summarizing the new rules (house skill standard, IP rules, milestone order). Then start Milestone 7 only, in plan mode: show me the plan before writing code.
3. One milestone per session. After each: review, test it yourself, commit, then open a new session and say "Read V2_BRIEF.md and CLAUDE.md, then start Milestone N."
4. Milestones 9, 10 and 12 contain creative work. Expect to give feedback and iterate on the look and outputs. That is normal and is where quality comes from.

---

## 1. What V2 adds

V1 shipped the store, the CLI and a few generic skills. V2 turns Agent Aisle into a **curated catalog**: deep, opinionated skills for specific jobs, each measured, demoed and maintained.

V2 delivers:

- **A baseline layer** every project gets: clean code, performance and security standards, plus house rules and the core kit.
- **Two complete website design skills**, each shipping a real reusable component library the agent must build every page from:
  - `design-motion-portfolio`: animation-heavy, dark, editorial portfolio style.
  - `design-clean-saas`: minimal, light, startup landing-page style.
- **Media skills** built to minimize regeneration: `image-logo`, `video-explainer`, `video-cartoon-episode`, `video-slapstick-chase`.
- **A first wave of other niches**: database, testing, debugging.
- **Preview pages**: live demo sites, screenshots, measured numbers and permission labels for every official skill.
- **An "Elsewhere" shelf** listing well-known public skills from other authors, shown after official ones.

## 2. Ground rules for V2 (read before writing any skill)

### 2.1 Intellectual property

- **Never copy another author's code, components, copy, images or exact layout into an official skill.** The two sites that inspired the design skills are commercial templates: one credits "Template By Designesia", the other is a "Premium Bootstrap 5 Landing Page Template" by MarkeyThemes sold via Envato. Their licenses do not allow redistribution. Our skills capture the **genre** (animation-heavy portfolio; minimal SaaS landing) with **original** components, tokens and copy.
- Third-party skills (Anthropic, Vercel, obra, Trail of Bits, Remotion, etc.) may be **listed and linked**, never copied into official skills. "Inspired by" credits go in the skill's README when an idea is borrowed.
- **Media skills must refuse to recreate copyrighted or trademarked characters, logos or real people's likeness.** `video-slapstick-chase` makes original cat-and-mouse-style chase cartoons with original characters; if a user names an existing franchise character, the skill explains it will create an original character in that spirit instead.

### 2.2 Honesty about outcomes

- No skill can guarantee a perfect result on the first try, especially generative image and video. Media skills are designed to **minimize regeneration** (spec first, cheap previews before expensive generation, locked references, automated checks), and their pages state this plainly.
- Every number shown on the site comes from the eval harness. No hand-written claims.

### 2.3 House skill standard (applies to every official skill)

```
<skill-name>/
├── SKILL.md            # ≤150 lines: Use when · Don't use when · Steps · Budget · Output · Done when
├── references/         # loaded on demand, one level deep
├── assets/             # templates, component kits, tokens
├── scripts/            # deterministic helpers; never fetch remote code
├── evals/tasks.yaml    # benchmark tasks with checks          (not installed)
├── preview/            # generated demos + results            (not installed)
├── README.md           # human docs, credits                  (not installed)
└── skill.meta.yaml
```

- Names follow `<niche>-<task>`.
- Style skills (`design-*`) and expensive media skills set `disable-model-invocation: true`, so users invoke them explicitly.
- Shared rules come from `registry/_shared/*.md` via `<!-- include: _shared/x.md -->` markers, compiled into self-contained folders at build time.
- `skill.meta.yaml` gains: `niche`, `kind` (`saver` | `quality`), `tier`, `tested` (model, date, tasks, token_savings_median, success_rate, baseline_success_rate, preferred_in_blind_test), `permissions` (tools, writes_files, runs_scripts, network, needs_api_keys), `demo` (live URL, screenshots).

### 2.4 Quality gates (a skill ships only if it passes)

| Gate | Saver skills | Quality skills |
| --- | --- | --- |
| A: beats baseline | Median token savings ≥ 30%, success ≥ baseline | Success > baseline, tokens ≤ +10% |
| B: blind comparison vs best public alternative | Preferred ≥ 50% (ties count) | Preferred ≥ 60% |
| C: trigger + safety | Loads on ≥ 90% of matching prompts, 0 of 20 unrelated; every script read | Same |

Design and media skills are `quality` skills. Baseline, core-kit, database and testing skills are mostly `saver` skills.

---

## 3. The baseline layer

### 3.1 House rules (always on)

`aisle init` writes a block of about 300 tokens between `<!-- agent-aisle:start -->` and `<!-- agent-aisle:end -->` markers into `CLAUDE.md` (or `AGENTS.md` for other agents). Re-running it replaces only that block. Content:

- Search before reading; read line ranges; cap files read per step.
- Change only what the task needs; no drive-by refactors.
- State assumptions in one line instead of guessing silently.
- No recaps of work the user can see; short final summaries.
- Run the project's checks before saying "done".
- If a `DESIGN.md` exists, every UI change follows it.

### 3.2 Baseline skills (new, official)

Write original rule sets. You may study public skills such as Vercel's `react-best-practices` and `web-design-guidelines`, Trail of Bits' security skills and the Karpathy-style guidelines for coverage, but do not copy their text.

**`code-quality`** — `kind: saver`, model-invoked, sonnet, medium effort
- Rules, ordered by impact: naming, function size, single responsibility, no dead code, typed boundaries (zod at I/O), error handling (no swallowed errors), no magic numbers, consistent file structure, tests for logic.
- `scripts/check.mjs`: runs the project's lint, typecheck and tests; prints only failures (max 40 lines).
- Done when: check script passes with zero new warnings.

**`web-performance`** — `kind: saver`, model-invoked, sonnet, medium effort
- Rules: Core Web Vitals targets (LCP < 2.5 s, CLS < 0.1, INP < 200 ms); `next/image` with sizes; fonts via `next/font`; no layout shift from animations; animate only `transform` and `opacity`; lazy-load below-the-fold media; JS budget per route; server components by default; avoid request waterfalls; memoize only measured hot paths.
- `scripts/perf-budget.mjs`: reads the Next.js build output and fails if any route's first-load JS exceeds the budget in `perf.config.json` (default 180 kB gzip).
- `references/animation-performance.md`, `references/images-fonts.md`.

**`web-security`** — `kind: saver`, model-invoked, sonnet, high effort
- Rules: validate all input server-side; parameterized queries; auth checks in server actions and route handlers; no secrets in client bundles (`NEXT_PUBLIC_` audit); CSP and security headers; safe redirects; sanitize user HTML; rate-limit auth endpoints; dependency hygiene.
- `scripts/secrets-scan.mjs`: a regex scan of the diff for common key patterns. `scripts/headers-check.mjs`: verifies `next.config` headers.
- Runs `npm audit --omit=dev` and reports high/critical only.

### 3.3 Core kit refresh

Keep V1's `plan`, `implement`, `explore`, `review`, `edit`, `commit`; rewrite each to the house standard. Add:
- `verify`: runs `code-quality`'s check script plus the perf budget; failures only.
- `handoff`: writes `.agent-aisle/handoff.md` (≤ 40 lines: goal, done, next, open questions) so a fresh session resumes cheaply.
- `budget`: slash-command-only strict mode (tighter read caps, terse output).

---

## 4. Design skills

Both design skills work the same way. Only the look differs.

### 4.1 How "always comply with the design" is enforced

1. **Scaffold once.** On first run, `scripts/install-kit.mjs` copies the skill's component kit from `assets/kit/` into the user's project at `src/components/kit/`, copies `tokens.css` and the Tailwind theme extension, and writes a `DESIGN.md` at the project root. `DESIGN.md` summarizes the system and states the rules. The house-rules block in `CLAUDE.md` points to it, so the rules apply in every future session, even when the skill is not loaded.
2. **Compose, don't invent.** SKILL.md steps: pages are built only from kit components and layout primitives. If a needed component doesn't exist, **extend the kit** (new file in `src/components/kit/`, following `references/extending-the-kit.md`, using tokens only), never a one-off styled section.
3. **Lint the design.** `scripts/design-lint.mjs` scans `src/` (excluding `kit/`) and fails on:
   - raw hex/rgb/hsl colors (tokens only)
   - Tailwind arbitrary values like `w-[437px]` or `text-[#123]` (scale only)
   - inline `style=` attributes outside kit files
   - font families not in tokens
   - animation durations/easings not from the motion tokens
   - section-level markup that doesn't import from `kit/`
   Output: file, line, rule, fix hint. Max 40 lines.
4. **Visual check.** `scripts/screenshot.mjs` (Playwright) captures every route at 1440 px and 390 px into `.agent-aisle/screens/` so the agent can look at its own result before saying done.
5. **Done when:** design-lint passes, `code-quality` check passes, perf budget passes, screenshots taken and reviewed, reduced-motion mode verified.

### 4.2 Target stack for both kits

Next.js (App Router) + React + TypeScript + Tailwind CSS. Animation: `motion` (the Framer Motion library's current package) for component animation and `lenis` for smooth scroll. Verify current package names and APIs from their docs before writing code. No other animation libraries unless I approve. Every animated component must respect `prefers-reduced-motion` with a static or simple-fade fallback.

### 4.3 `design-motion-portfolio` (animation-heavy)

**Genre:** a personal or studio portfolio where motion is the identity: dark, editorial, oversized type, kinetic reveals, smooth inertial scroll. Inspired by the genre of creative-agency portfolios, with entirely original components.

**Tokens (starting point; refine in Milestone 9):**
- Color: near-black ground, warm off-white ink, one vivid accent, two neutral greys. Light-on-dark only.
- Type: one condensed or high-contrast display face for huge headlines (clamp 56–180 px), one clean grotesk for body. Load via `next/font`.
- Motion scale: durations `fast 200ms`, `base 450ms`, `slow 900ms`, `epic 1400ms`; easings `out-expo`, `in-out-quart`; stagger `40ms` per word, `80ms` per item.
- Spacing: 8 px scale; section padding 120–200 px desktop.

**Kit components (all original, all accept tokens only):**

| Component | Behavior |
| --- | --- |
| `SiteShell` | Lenis smooth scroll, route transitions, optional custom cursor (off on touch and reduced motion) |
| `NavOverlay` | Full-screen menu with staggered link reveal; "available for work" pill |
| `HeroKinetic` | Headline split into lines/words, masked rise-in; portrait/media with clip-path reveal |
| `RevealText` | Reusable line/word reveal on scroll |
| `StatCounter` | Number counts up once on enter; respects reduced motion |
| `Marquee` | Infinite, pausable on hover, direction and speed props |
| `ServiceList` | Large numbered rows; hover shows a floating image following the cursor |
| `WorkGallery` | Pinned section with horizontal scroll of projects; mobile falls back to vertical stack |
| `ProjectCard` | Image with parallax inside frame, meta (client, year, category) |
| `BlogGrid` | Cards with image zoom on hover |
| `MagneticButton` | CTA that subtly follows the cursor |
| `ContactCTA` | Giant "Let's talk" link with underline sweep |
| `Footer` | Socials, back-to-top with smooth scroll |
| `Section`, `Container`, `Grid` | Layout primitives |

**Demo site** (`demos/motion-portfolio/`, deployed to Vercel): Home, About, Work, Work detail, Blog, Contact, with original placeholder copy and royalty-free or generated imagery. Used for previews, screenshots and evals.

**SKILL.md outline:** see Appendix A for the full draft.

### 4.4 `design-clean-saas` (minimal)

**Genre:** a clean startup/SaaS landing page: light ground, generous whitespace, one brand color, quiet confidence. Inspired by the genre of minimal startup templates, with entirely original components.

**Tokens:**
- Color: white/very light ground, near-black text, one brand color with 50–900 scale, neutral greys, success/warning only for UI states.
- Type: one geometric or humanist sans for everything, tight headline tracking; scale 14/16/18/24/32/48/64.
- Radius `lg 12px`, `2xl 20px`; borders 1 px neutral-200; shadows: one soft level only.
- Motion: only `fade-up 300ms` on enter and `150ms` hover transitions. No parallax, no smooth-scroll library.

**Kit components:**

| Component | Notes |
| --- | --- |
| `Navbar` | Logo, links, primary CTA; collapses to sheet on mobile; sticky with border on scroll |
| `Hero` | Eyebrow, headline, subtext, 2 CTAs, optional rating badges, product image |
| `LogoCloud` | Monochrome partner logos |
| `StatsBar` | 3–4 figures with labels |
| `FeatureGrid` | 3- or 6-up icon cards |
| `FeatureSplit` | Text + image, alternating |
| `ServiceCards` | Card grid with icon, title, text, link |
| `Testimonials` | Cards with avatar, name, role, rating, quote |
| `Team` | Profile cards |
| `PricingTable` | 2–3 tiers, monthly/yearly toggle, "popular" tag |
| `FAQ` | Accessible accordion |
| `ContactForm` | Labeled inputs, validation states, server action stub |
| `Newsletter` | Inline email capture |
| `Footer` | 4 link columns, legal links |
| `Section`, `Container`, `Grid` | Layout primitives |

**Demo site** (`demos/clean-saas/`, deployed): a fictional product landing page plus Pricing, About and Contact pages.

**SKILL.md:** same structure as Appendix A, with "minimal" rules: whitespace before decoration; max one accent use per section; no gradients, glassmorphism or decorative blobs; icons from one set only (`lucide-react`).

---

## 5. Media skills

### 5.1 The anti-reroll method (shared by all media skills)

Put this method in `registry/_shared/media-method.md` and include it in every media skill:

1. **Spec intake.** Before generating anything, fill a written spec (`brief.yaml`) and show it to the user: subject, style, palette, aspect ratio, duration, must-haves, must-nots. Ask only for missing fields. Most rerolls come from unclear requests.
2. **Lock references.** Generate or collect reference assets first: style frame, character sheet (front/side/back, expressions), palette. Every later generation reuses them.
3. **Cheapest preview first.** Text storyboard, then still keyframes, then animatic, then final render. The user approves each stage before the expensive one.
4. **Short units.** Generate per shot (2–6 s) rather than one long clip; regenerate only the failing shot.
5. **Deterministic where possible.** Prefer code-rendered output (SVG, Remotion) when the style allows; it reproduces exactly. Fix seeds where a provider supports them.
6. **Automated check.** `scripts/check-frames.mjs` extracts frames with ffmpeg; the agent inspects them against the spec and references. Max 2 automatic retries per shot, then ask the user.
7. **Log everything.** Prompts, seeds, references and provider settings go in `production.json`, so any shot can be reproduced.

**Providers.** Generative steps go through `scripts/providers/` adapters selected by env vars (`AISLE_IMAGE_PROVIDER`, `AISLE_VIDEO_PROVIDER` and the provider's own key). Start with one image and one video provider; verify current API names, parameters and pricing from official docs and leave `TODO(verify)` where unsure. Users bring their own API keys. `skill.meta.yaml` sets `permissions.needs_api_keys` and `network: true`, shown on the skill page.

### 5.2 `image-logo`

- **Default mode, vector:** builds the logo as hand-written SVG (wordmark, monogram, geometric mark). This is deterministic, editable and exact. Steps: brief intake, then 3 distinct concepts as SVG on one comparison sheet, the user picks one, 2 refinement rounds max, then export.
- **Optional mode, raster concepts:** for illustrative marks, generate concept images via the provider, then redraw the chosen one as SVG.
- `scripts/export.mjs`: from the final SVG, exports favicon (16/32/48 ICO + SVG), app icons (180/192/512 PNG), social avatar (400/1024 PNG, safe for circular crop), light/dark variants, and a one-page usage sheet (clear space, minimum size, colors).
- `references/logo-principles.md`: legibility at 16 px, one idea per mark, optical balance, contrast checks.
- Refuses to imitate existing brands' logos.

### 5.3 `video-explainer`

- Code-rendered motion graphics with **Remotion** (React videos): product explainers, launch videos, data stories, social clips.
- Uses a kit of scene components (`TitleCard`, `KineticHeadline`, `ScreenshotPan`, `BarRace`, `CaptionTrack`, `LogoOutro`) with tokens like the design skills.
- Steps: brief, script with timings, scene list, `npx remotion studio` preview, render.
- Requires Node.js and ffmpeg. Note Remotion's license terms for companies on the skill page (verify current terms).
- Can coexist with Remotion's own official skills; our skill adds the brief method and scene kit and should reference Remotion's docs, not duplicate them.

### 5.4 `video-cartoon-episode`

Produces a short original 2D cartoon episode (30 s – 3 min).

- **Mode `vector` (default, near-zero rerolls):** characters built as layered SVG "puppets" (head, body, limbs, mouth shapes) animated in Remotion with keyframed poses, cut-out style like many TV cartoons. Backgrounds as SVG or generated stills. Fully reproducible.
- **Mode `generative` (richer look, rerolls possible):** character sheets and keyframes generated as images first, approved by the user, then per-shot image-to-video generation using those keyframes, assembled with ffmpeg.
- **Pipeline:** logline → beat sheet → script (dialogue optional) → character sheets → storyboard (one still per shot) → animatic (stills + timing + temp audio) → shots → assembly → titles and credits.
- Optional voice via a TTS provider adapter; optional music from a royalty-free library the user supplies.
- `assets/rigs/`: 2 original starter character rigs and a rig template with documentation.
- `references/cartoon-timing.md`: anticipation, squash and stretch, holds, smears, comic timing in frames at 24 fps.

### 5.5 `video-slapstick-chase`

A **genre preset** on top of `video-cartoon-episode`: classic slapstick chase cartoons in the cat-and-mouse tradition, with **original** characters.

- `references/gag-library.md`: 40 original gag structures (setup → escalation → reversal → payoff), chase geography patterns, cause-and-effect chains, timing in frames.
- `assets/rigs/`: two original rival characters (a large pursuer and a small clever target) with exaggerated pose sets: run cycle, skid stop, double take, flattened, stars-around-head.
- Episode template: cold open, 3 escalating chase set pieces, reversal, button gag.
- Music cues: orchestral-style mickey-mousing notes per action (user supplies or generates music; the skill outputs a cue sheet).
- Guardrail: if the user asks for a specific franchise's characters, create original characters with a similar dynamic and explain why.

---

## 6. Other niches in V2 (wave 1 completion)

Same house standard and gates. Lighter specs; flesh out in Milestone 13.

| Skill | Kind | Core idea |
| --- | --- | --- |
| `db-schema` | saver | Design normalized schema + indexes from requirements; outputs migration + ER summary |
| `db-migrate` | saver | Safe migrations: plan, reversible SQL, data backfill, lock-time warnings; engine notes in `references/` (Postgres, MySQL, SQLite, MongoDB) |
| `db-optimize-query` | saver | Run `EXPLAIN`, find missing indexes and N+1s, before/after timings via script |
| `db-seed` | saver | Realistic seed data via script, deterministic with a seed |
| `test-write` | saver | Tests for changed code only; picks the project's framework; runs them |
| `test-fix` | saver | Fix failing tests from trimmed output; never weakens assertions without asking |
| `debug-trace` | saver | Hypothesis-driven debugging: reproduce, isolate, verify root cause, minimal fix, regression test |

---

## 7. Website changes

1. **Aisles (niche pages):** `/aisles/[niche]` for web design, frontend, baseline, database, testing, media. Each shows official skills first, then Verified, Community, then Elsewhere.
2. **Skill page v2:** promise line; use when / don't use when; **Live demo** button (design skills); screenshot gallery (desktop and phone); with-vs-without comparison for saver skills (token meter); numbers card (model, date, tasks); permissions label (tools, writes files, runs scripts, network, needs API keys); 3 copyable example prompts; file tree; rendered SKILL.md; version history.
3. **Kits:** curated bundles with one install command, e.g. *Motion portfolio site* = `design-motion-portfolio code-quality web-performance web-security verify`, *Clean SaaS site*, *Cartoon studio* = `video-cartoon-episode video-slapstick-chase image-logo`.
4. **Elsewhere shelf:** external listings (link out, author, license, no install through our CLI unless the repo is a valid skill and the user passes `--allow-external`). Seed it with these well-known collections. **Verify each repo, path and license exists before listing**; drop any that don't:
   - `anthropics/skills` (frontend-design, webapp-testing, skill-creator)
   - `vercel-labs/agent-skills` (web-design-guidelines, react-best-practices, composition-patterns)
   - `obra/superpowers` (systematic-debugging, test-driven-development, brainstorming)
   - `mattpocock/skills` (handoff, grill-me)
   - `trailofbits/skills` (security analysis)
   - `remotion-dev/skills` (Remotion best practices)
   - Supabase's agent skills (Postgres best practices)
   - `JuliusBrussee/caveman` (token-efficient output)
5. **Methodology page** (`/methodology`): how evals run, gates, what numbers mean, limitations. Must exist before any numbers are shown.

## 8. Eval harness and previews v2

- Extend `evals/run.py` (or port to TypeScript if it was already ported) with: `saver` and `quality` modes; blind comparison (two outputs, randomized labels, judged by a separate model call with a rubric, plus my manual spot checks); trigger tests (20 matching prompts, 20 unrelated).
- `pnpm preview <skill>`: runs 3 demo prompts headless in a sandboxed copy of a fixture project, records transcript and token counts, screenshots UI output at 1440 and 390 px with Playwright, writes to `preview/`, labeled with version, model and date.
- Media skill evals: rubric-based (spec adherence, consistency with references, retries used). Track **average regenerations per shot**; that number goes on the skill page.
- Run evals with a Claude Console API key from env, never a subscription session. Print the cost per run and the total.

## 9. Milestones

Do these in order. Each stops for my review. Use plan mode at the start of each.

**Milestone 7 — Foundations.**
- `registry/_shared/` fragments and the include compiler in the registry build.
- House-standard linter (`pnpm lint:skills`): section order, line limits, name format, meta fields.
- CLI: skip `evals/`, `preview/` and `README.md` on install; `aisle init` writes the house-rules block idempotently.
- Registry schema: new meta fields.

*Done when:* existing skills compile through the new pipeline; `pnpm lint:skills` passes; `aisle init` run twice leaves one block.

**Milestone 8 — Baseline and core kit.** `code-quality`, `web-performance`, `web-security`; refresh core kit; add `verify`, `handoff`, `budget`. Eval each on 10 tasks (full 30 later).
*Done when:* all pass `lint:skills`; each script has unit tests; eval report produced.

**Milestone 9 — `design-motion-portfolio`.**
- Build the kit in `registry/official/design-motion-portfolio/assets/kit/` and the demo site in `demos/motion-portfolio/`, using the kit only.
- Write `install-kit`, `design-lint` and `screenshot` scripts, and the SKILL.md (Appendix A).
- **Stop after tokens + 3 components + hero page for my design approval** before building the rest.

*Done when:* demo deployed; Lighthouse performance ≥ 85 and accessibility ≥ 95 on the demo; reduced-motion works; a fresh test project builds 3 new pages with the skill and design-lint passes with no manual fixes.

**Milestone 10 — `design-clean-saas`.** Same as Milestone 9 with the minimal kit. Lighthouse ≥ 95 performance.
*Done when:* same criteria.

**Milestone 11 — Evals v2 and previews.** Blind comparison, trigger tests, `pnpm preview`, new skill page blocks, Live demo links, methodology page.
*Done when:* skill pages for the two design skills and baseline skills show real screenshots and numbers.

**Milestone 12 — Media skills.** Shared media method; provider adapters (one image, one video provider); `image-logo` (vector mode first); `video-explainer`; `video-cartoon-episode` (vector mode first, then generative); `video-slapstick-chase`. Produce one sample output each for previews: a logo sheet, a 20 s explainer and a 45 s cartoon short.
*Done when:* samples produced with average regenerations per shot recorded; IP guardrail tested with 5 prompts naming famous characters (all must produce original characters).

**Milestone 13 — Wave 1 niches and Elsewhere.** Database, testing and debugging skills; aisles pages; Elsewhere shelf (verified entries only); kits.
*Done when:* every listed official skill passes its gates or is hidden behind a "coming soon" label.

**Milestone 14 — Launch V2.** Full 30-task evals for all official skills, publish numbers, update README and docs, publish CLI minor version (ask me first), deploy.

## 10. Rules for Claude Code while working on V2

Everything in `BUILD_BRIEF.md` section 10 still applies, plus:

- Follow section 2 (IP, honesty, house standard, gates) without exception.
- Never fetch, copy or reproduce code or assets from the inspiration sites or third-party skills into our repo.
- When unsure of a library's or provider's current API, check its official docs; if you can't, write `TODO(verify)` and tell me.
- Ask before adding any dependency, any paid API call, or any provider.
- Keep every SKILL.md ≤ 150 lines; move detail to `references/`.
- Creative milestones (9, 10, 12): show me intermediate results early (tokens, first components, first storyboard) rather than finishing everything first.

---

## Appendix A — Draft SKILL.md: `design-motion-portfolio`

Use as the starting point in Milestone 9; refine after evals.

```markdown
---
name: design-motion-portfolio
description: Build or extend an animation-heavy, dark, editorial portfolio website (kinetic type, smooth scroll, scroll reveals) using this skill's component kit and design tokens. Use when the user asks for a motion-rich portfolio, studio or personal site in this style, or adds pages to a site already using this kit. Do not use for dashboards, docs sites, or minimal/corporate styles.
disable-model-invocation: true
model: sonnet
effort: medium
allowed-tools: Read Write Edit Glob Grep Bash(node *) Bash(npx playwright *) Bash(pnpm *) Bash(npm run *)
---

# Motion portfolio

## Use when
- New portfolio/studio site in this style, or new pages for a site that has `DESIGN.md` from this skill.

## Don't use when
- The project already follows another design system. Ask first.

## Steps
1. If `src/components/kit/` is missing, run `node <skill>/scripts/install-kit.mjs` and confirm the files it wrote.
2. Read `DESIGN.md` (tokens, components, rules). Read `references/components.md` only for components you'll use.
3. List the page's sections and map each to a kit component. If one is missing, extend the kit per `references/extending-the-kit.md`; never write one-off styled sections.
4. Write copy specific to the user's content; leave `[PLACEHOLDER]` for facts you don't have.
5. Animate only with kit components and motion tokens; transform/opacity only.
6. Run `node <skill>/scripts/design-lint.mjs`, then the project's checks. Fix until clean.
7. Run `node <skill>/scripts/screenshot.mjs`; look at desktop and phone shots; fix visual issues.

## Budget
<!-- include: _shared/read-budget.md -->
- Don't read kit source unless extending it; `DESIGN.md` documents each component's props.

## Output
- Changed files list, new kit components (if any), screenshot paths, check results. No recap of code.

## Done when
- design-lint passes, project checks pass, perf budget passes.
- Screenshots reviewed at 1440 px and 390 px.
- With reduced motion enabled, content is fully visible and readable.
```

## Appendix B — Draft SKILL.md: `video-cartoon-episode`

```markdown
---
name: video-cartoon-episode
description: Produce a short original 2D cartoon episode (30 s to 3 min) through a staged pipeline (brief, script, character sheets, storyboard, animatic, render) that minimizes regeneration. Use when the user asks for a cartoon, animated short or episode. Do not use for live-action, product explainers (use video-explainer) or recreating existing franchise characters.
disable-model-invocation: true
model: sonnet
effort: high
allowed-tools: Read Write Edit Glob Grep Bash(node *) Bash(npx remotion *) Bash(ffmpeg *)
---

# Cartoon episode

## Use when
- An original animated short or episode, with or without dialogue.

## Don't use when
- The user wants existing copyrighted characters: offer original characters with a similar spirit instead.

## Steps
<!-- include: _shared/media-method.md -->
1. Fill `brief.yaml` (logline, length, tone, characters, setting, mode: vector|generative, aspect ratio). Ask only for missing fields; show it for approval.
2. Write the beat sheet, then the script with a shot list (2-6 s per shot). Approval.
3. Character sheets: vector mode, build rigs from `assets/rigs/template`; generative mode, generate sheets and get approval before anything else.
4. Storyboard: one still per shot. Approval.
5. Animatic: stills on the timeline with timing and temp audio; render low-res. Approval.
6. Produce shots. Vector mode: animate rigs in Remotion using `references/cartoon-timing.md`. Generative mode: image-to-video per shot from approved keyframes.
7. Run `node <skill>/scripts/check-frames.mjs`; inspect frames against sheets and spec. Retry a failing shot at most twice, then ask.
8. Assemble, add titles and credits, render final. Write `production.json`.

## Budget
<!-- include: _shared/read-budget.md -->
- Never regenerate approved stages unless the user asks.

## Output
- Path to the final video, `production.json`, shots regenerated count, anything the user should review.

## Done when
- Final render plays end to end, matches the approved storyboard, and the user has the files.
```
