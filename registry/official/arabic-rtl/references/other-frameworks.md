# Other frameworks and plain HTML

The scripts target JavaScript and TypeScript sources with Tailwind classes. For anything else, the principles in `logical-css.md`, `mirroring.md`, `bidi.md` and `typography.md` still apply.

## Plain HTML and CSS

1. `<html lang="ar" dir="rtl">` on Arabic pages. Serve separate files or routes per language (`/ar/`), with `hreflang` links.
2. Replace physical properties with logical ones (table in `logical-css.md`). `rtl-scan` reads `.css`, `.scss` and `.pcss` and reports physical properties; apply the fixes by hand (the codemod only rewrites Tailwind classes).
3. Flex and grid already follow `dir`; remove manual reversals.
4. Load an Arabic font with `@font-face` or Google Fonts, restricted to the `arabic` subset where possible, and reset `letter-spacing` under `:lang(ar)`.
5. Use `Intl` in scripts as in `numbers-dates.md`.

Without Tailwind, a stylesheet-only fallback for older code is `[dir="rtl"] .card { margin-right: 1rem; }`, but logical properties are preferred because they need no per-direction rules.

## Vue and Nuxt (later)

Planned: `@nuxtjs/i18n` locale `dir` property, `useLocaleHead` for `lang` and `dir`. TODO(verify) against current docs before adding a recipe. Tailwind logical classes work the same.

## React Native (later)

React Native has `I18nManager.forceRTL(true)` and start/end style props (`marginStart`, `paddingEnd`, `start`, `end`). It requires an app restart after changing direction. TODO(verify) the current API and Expo guidance before writing a recipe.

## Other React frameworks (Vite, Remix)

Same as Next.js without next-intl specifics: set `lang`/`dir` on the root element from the active locale, use `react-intl` or `i18next` with ICU or plural rules for all six Arabic categories, and run the scripts unchanged. TODO(verify): the plural syntax each library uses (i18next uses `_zero`, `_one`, `_two`, `_few`, `_many`, `_other` keys, not ICU).

## What the scripts do not cover

CSS Modules/SCSS physical shorthand like `margin: 0 8px 0 0` (the scan misses four-value shorthand), images of text, PDFs, email templates, charts, and canvas drawing.
