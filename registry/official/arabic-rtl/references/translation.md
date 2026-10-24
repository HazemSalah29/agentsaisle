# Translating UI text into Arabic

**Honest limit:** model translation is a draft. Write `translation-review.md` listing every string you are unsure about, and recommend that a native speaker reviews the file before production.

## Variety and tone

- UI text: Modern Standard Arabic (MSA), clear and short. Use the register of well-known apps in the target market.
- Marketing copy only: the dialect chosen in `i18n.config.json` (Egyptian, Gulf or Levantine). Never mix dialects in one screen.
- Keep tone consistent with the English source (formal or friendly).

## Glossary

`assets/glossary.ar.yaml` lists approved terms (`terms:` with `en`/`ar` pairs) and `brands:` that must stay as written. Arabic changes a word's form (definite, indefinite, possessive), so one term may list accepted forms separated by `|`. Use it; `translate-check` reports a violation when an English source string contains a glossary term but the Arabic lacks the approved translation, or when a brand name is translated. Never translate brand and product names, code identifiers, or URLs.

## Placeholders

Keep `{name}`, `{count}` and rich-text tags such as `<link>...</link>` exactly, in the same names. Do not translate the contents of braces. The checker reports renamed, missing or extra placeholders and tags.

## No concatenation

Arabic word order and agreement differ. Use whole sentences with placeholders.

- Bad: `t("hello") + " " + name`, or `{count} {t("items")}`.
- Good: `"greeting": "مرحبًا بعودتك، {name}!"`, `"items": "{count, plural, ...}"`.

`rtl-scan` flags concatenation and text next to an interpolation in JSX.

## Plurals

Provide all six categories for every counted message (see `numbers-dates.md`). Numbers 3 to 10 take the plural noun; 11 to 99 take the singular accusative (`many`); `two` has its own dual form.

## Gender

Arabic verbs and adjectives agree with the addressee's gender. Order of preference:

1. Rephrase to a neutral construction (nouns, passives, imperatives without gendered endings): "تم الحفظ" instead of a gendered "you saved".
2. If impossible, follow the config: masculine default, or ICU `select` on a gender value when the app knows it:
   `{gender, select, female {...} other {...}}`.
3. Flag it in `translation-review.md`.

## Length and layout

Arabic strings are often shorter in characters but taller; some UI strings grow. Never set fixed widths on text containers; use `min-w-0`, wrapping, and test with real strings. Truncate with CSS, not JavaScript.

## What to put in translation-review.md

For each uncertain key: the key, the English source, the Arabic draft, and why it is uncertain (idiom, gender, terminology, length). Keep it short; the owner or a native reviewer works through it.

## Process

1. Extract strings with `i18n-candidates.mjs` and move them to `messages/en.json`, file by file.
2. Translate to `messages/ar.json` using the glossary.
3. Run `translate-check.mjs`; fix errors; review warnings (identical-to-English values may be legitimate: brand names, "OK").
