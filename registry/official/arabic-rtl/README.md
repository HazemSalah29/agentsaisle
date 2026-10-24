# arabic-rtl

Adds full Arabic and right-to-left support to a Next.js (App Router) + Tailwind app: locale routing, `dir`, logical CSS, mirroring, Arabic typography, numbers, dates, plurals, mixed-direction text, forms, translation and visual QA. Run it on purpose with `/arabic-rtl` in Claude Code. A lighter companion, `rtl-check`, keeps new code RTL-safe afterwards.

## What is in the folder

- `SKILL.md`: the steps the agent follows. `references/`: the detail, read only when needed.
- `scripts/`: deterministic helpers (Node 18+, no network, read-only unless `--write`): `i18n-config`, `rtl-scan`, `rtl-codemod`, `i18n-candidates`, `translate-check`, `screenshot-rtl`.
- `assets/`: starter messages (216 UI strings, English and Arabic), glossary, font setup, `LocaleSwitcher`, `DirectionalIcon`.
- `preview/`: English and Arabic screenshots of a demo site (a four-page "Fieldnote" site built from the `design-clean-saas` kit and converted by following `SKILL.md`). Shown on the skill page; not installed.
- `evals/`: a deliberately broken fixture app and message files used by the tests. Not installed.

## Honest limits

- The Arabic starter strings are a machine-written Modern Standard Arabic draft. A native speaker should review them (and the app's own strings) before production. The skill writes `translation-review.md` for strings it is unsure about.
- The codemod rewrites Tailwind classes only. Physical CSS properties are reported, not rewritten. It needs Tailwind 3.3 or newer.
- Unverified details are marked `TODO(verify)` in the references.
- No eval numbers exist, so the skill page shows screenshots only. The demo was converted by following the steps by hand, not by an unattended agent run.
- A design kit copied into the project (`src/components/kit`) is skipped by default; the scripts print a NOTE with counts and `--include-kit` includes it. The demo needed it: the kit held the layout classes and about 25 UI strings, and its server actions return message keys so errors can be translated.
- Screenshots scroll the page first so reveal-on-scroll sections are visible.

## Strings the owner should spot-check first

Plural forms in `plural.*` (the `many` and `few` agreement), `plural.daysLeft`, `plural.unread`, `validation.minLength` / `maxLength` (the number agreement), `forms.charactersLeft`, and the gendered wording in `auth.welcomeBack`.

## Testing it yourself

Copy `evals/fixture-app` to a scratch folder, install `next`, `react`, `next-intl`, `lucide-react`, `clsx` and `tailwindcss`, and run `/arabic-rtl` in a fresh Claude Code session. All "Done when" checks in `SKILL.md` should pass without manual code fixes.
