---
name: web-performance
description: Keep a Next.js site fast while building or changing pages, components, images, fonts and animation, and check each route's JavaScript against a budget. Use when adding or editing pages, media or motion in a Next.js App Router project, or when asked to speed a site up. Do not use for backend-only work, non-Next.js stacks or visual design decisions.
model: sonnet
effort: medium
allowed-tools: Read Grep Glob Edit Write Bash(node *) Bash(npm run *) Bash(pnpm *) Bash(yarn *) Bash(bun *)
---

# Web performance

## Use when
- You add or change pages, components, images, fonts or animation in a Next.js App Router project.
- The user asks to make a page faster, smaller or smoother.
- A build is about to be called done.

## Don't use when
- The work is backend-only, or the project does not use Next.js.
- The question is about how something should look, not how fast it is.

## Targets
- Largest Contentful Paint under 2.5 s, Cumulative Layout Shift under 0.1, Interaction to Next Paint under 200 ms.
- First-load JavaScript per route within the budget in `perf.config.json` (default 180 kB gzip). Create that file to set `budgetKb`, per-route limits in `routes`, or routes to skip in `ignore`.

## Rules
1. **Server Components by default.** Add `"use client"` only to the small leaf that needs state or browser APIs, never to a whole page for convenience.
2. **Images through `next/image`** with dimensions and a correct `sizes`; `priority` only on the largest above-the-fold image. See `references/images-fonts.md`.
3. **Fonts through `next/font`**, two families at most, only the weights in use.
4. **Animate only `transform` and `opacity`.** Reserve space so nothing shifts. See `references/animation-performance.md`.
5. **Lazy-load below the fold:** `next/dynamic` for heavy client components, lazy images and iframes, `preload="none"` video with a poster.
6. **No request waterfalls.** Start independent fetches together (`Promise.all`) and stream slow parts with Suspense instead of blocking the page on them.
7. **Mind every dependency.** Before adding a client-side library, check what it costs; prefer a native API or a smaller library. Import only the functions you use.
8. **Memoize only measured hot paths.** `useMemo` and `memo` everywhere add cost and noise.

## Steps
1. Read the page or component you are changing and its imports; search for similar patterns before inventing one.
2. Apply the rules. Open a reference file only for the area you touch (motion, or images and fonts).
3. Build for production with the project's build script.
4. Run `node <this skill's folder>/scripts/perf-budget.mjs`. It reads the build output and prints only routes over budget.
5. If a route is over budget, find what it pulls in (client components, heavy imports), fix the biggest one first, rebuild and run the check again.

## Budget
<!-- include: _shared/read-budget.md -->
- Never read files inside `.next/` yourself; the script summarizes them.

## Output
- Changed files, and the result line from the budget check, for example `perf-budget: 9 routes within budget (180 kB gzip)`.
- Any rule you broke on purpose, with the reason.

## Done when
- `perf-budget.mjs` exits 0 on a fresh production build.
- Images have dimensions and the hero image has `priority`; fonts come from `next/font`.
- Nothing you added animates `width`, `height`, `top` or `left`, and reduced-motion users get no movement.
