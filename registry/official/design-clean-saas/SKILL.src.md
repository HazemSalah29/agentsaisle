---
name: design-clean-saas
description: Build or extend a clean, minimal startup or SaaS website (landing page, pricing, about, contact) using this skill's component kit and design tokens. Use when the user asks for a minimal, modern product or startup site, or adds pages to a site already using this kit. Do not use for animation-heavy portfolios, dashboards, docs sites or dark editorial styles.
disable-model-invocation: true
model: sonnet
effort: medium
allowed-tools: Read Write Edit Glob Grep Bash(node *) Bash(npx playwright *) Bash(pnpm *) Bash(npm run *)
---

# Clean SaaS

## Use when
- New product or startup site in this style, or new pages for a site that has `DESIGN.md` from this skill.

## Don't use when
- The project already follows another design system. Ask first.
- The user wants kinetic, animation-heavy or dark editorial pages.

## Steps
1. If `src/components/kit/` is missing, run `node <skill>/scripts/install-kit.mjs` and confirm the files it wrote. Install the packages it names.
2. Read `DESIGN.md` (tokens, components, rules). Read `references/components.md` only for components you'll use.
3. List the page's sections and map each to a kit component. If one is missing, extend the kit per `references/extending-the-kit.md`; never write one-off styled sections.
4. Write copy specific to the user's product; leave `[PLACEHOLDER]` for facts you don't have. Do not invent customers, ratings or numbers.
5. Keep it minimal: whitespace before decoration, one accent use per section, no gradients, glass or blobs, icons from `lucide-react` only.
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
