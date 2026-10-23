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
- New portfolio or studio site in this style, or new pages for a site that has `DESIGN.md` from this skill.

## Don't use when
- The project already follows another design system. Ask first.

## Steps
1. If `src/components/kit/` is missing, run `node <skill>/scripts/install-kit.mjs` and confirm the files it wrote.
2. Read `DESIGN.md` (tokens, components, rules). Read `references/components.md` only for components you'll use.
3. List the page's sections and map each to a kit component. If one is missing, extend the kit per `references/extending-the-kit.md`; never write one-off styled sections.
4. Write copy specific to the user's content; leave `[PLACEHOLDER]` for facts you don't have.
5. Animate only with kit components and motion tokens; transform and opacity only.
6. Run `node <skill>/scripts/design-lint.mjs`, then the project's checks. Fix until clean.
7. Run `node <skill>/scripts/screenshot.mjs`; look at the desktop and phone shots; fix visual issues.

## Budget
<!-- include: _shared/read-budget.md -->
- Don't read kit source unless extending it; `DESIGN.md` documents each component's props.

## Output
- Changed files list, new kit components (if any), screenshot paths, check results. No recap of code.

## Done when
- design-lint passes, project checks pass, perf budget passes.
- Screenshots reviewed at 1440 px and 390 px.
- With reduced motion enabled, content is fully visible and readable.
