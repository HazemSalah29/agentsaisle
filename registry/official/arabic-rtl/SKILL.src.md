---
name: arabic-rtl
description: Add full Arabic and right-to-left support to a web app (Next.js App Router and Tailwind first), covering locale routing, dir, logical CSS, mirroring, Arabic typography, numbers, dates, plurals, mixed-direction text, forms, translation and visual QA. Use when the user asks to add Arabic, RTL, or localize an app for Arabic speakers. Don't use for translating a single document.
disable-model-invocation: true
model: sonnet
effort: high
allowed-tools: Read Write Edit Glob Grep Bash(node *) Bash(npx playwright *) Bash(pnpm *) Bash(npm run *) Bash(npm install *)
---

# Arabic + RTL

## Use when

- Adding Arabic to an existing app, or making an Arabic-first app RTL-correct.

## Don't use when

- One-off text translation, or apps without a web UI.
- The app is not Next.js or Tailwind: read `references/other-frameworks.md` first and tell the user what the scripts will not cover.

## Steps

1. Run `node <skill>/scripts/i18n-config.mjs --check`. If `i18n.config.json` is missing, ask only the decisions in `references/decisions.md` that the user has not answered, then run it with `--init` and the answers.
2. Detect the stack: framework, Next.js and Tailwind versions, any existing i18n library. Read only the references you need.
3. Setup (no i18n yet): follow `references/i18n-nextjs.md`. Set `lang` and `dir` on `<html>`. Copy `assets/fonts.ts`, `assets/LocaleSwitcher.tsx` and `assets/DirectionalIcon.tsx`. Start `messages/` from `assets/messages/*.json` and `assets/glossary.ar.yaml`.
4. Run `node <skill>/scripts/rtl-codemod.mjs` (dry run). Review the summary, then run it with `--write`. Fix the classes it lists for manual review by hand.
5. Run `node <skill>/scripts/rtl-scan.mjs`. Fix every `error`; review `warn`s. Fix physical CSS it reports by hand.
   - If a script prints `NOTE: skipped ... (a design kit folder)`, the layout classes and strings of a kit copied into the project (`src/components/kit`) were not checked. Tell the user in one line, then run steps 4, 5 and 7 again with `--include-kit`.
6. Mirroring: wrap directional icons in `DirectionalIcon` per `references/mirroring.md`.
7. Strings: run `node <skill>/scripts/i18n-candidates.mjs` (it also lists copy passed as props, object values and ternaries). Move strings to `messages/en.json` file by file, then translate into `messages/ar.json` with the glossary and `references/translation.md`. Write `translation-review.md` for uncertain strings.
8. Numbers, dates, currency and plurals per `references/numbers-dates.md`; isolate mixed-direction text per `references/bidi.md`; fix forms per `references/forms.md`.
9. Run `node <skill>/scripts/translate-check.mjs`, the project's build and checks, then `node <skill>/scripts/screenshot-rtl.mjs` against the running app. View the en and ar shots side by side at both widths and fix what you see (`references/qa-checklist.md`).
10. Tell the user that `rtl-check` can keep new code RTL-safe, and that a native speaker should review the translations.

## Budget

<!-- include: _shared/read-budget.md -->

- Let the scripts find problems; do not read every file looking for physical classes.
- Never run a script with `--write` without a clean dry run first.

## Output

- Config used, files changed (count and notable ones), scan counts before and after, untranslated or uncertain strings, screenshot paths, and the translation-review reminder.

## Done when

- rtl-scan reports 0 errors. translate-check passes. The build and project checks pass.
- en and ar screenshots were reviewed at 1440 px and 390 px, with no horizontal overflow in ar.
- The Arabic font loads, no letter-spacing is applied to Arabic, and plural messages cover all six categories.
