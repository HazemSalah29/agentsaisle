# Numbers, dates, currency, plurals

Always format with `Intl` and an explicit locale. Never build "EGP 100" or "24/10/2026" by hand.

## Set the digits explicitly

Defaults differ by region and runtime. Measured on Node 24 (ICU), same number `1234567.8`:

| Locale            | Result                         |
| ----------------- | ------------------------------ |
| `ar`              | `1,234,567.8` (Western digits) |
| `ar-EG`           | `١٬٢٣٤٬٥٦٧٫٨` (Arabic-Indic)   |
| `ar-SA`           | `١٬٢٣٤٬٥٦٧٫٨`                  |
| `ar-AE`           | `1,234,567.8`                  |
| `ar-MA`           | `1.234.567,8` (comma decimal)  |
| `ar-EG-u-nu-latn` | `1,234,567.8`                  |
| `ar-EG-u-nu-arab` | `١٬٢٣٤٬٥٦٧٫٨`                  |

So the bare `ar` is not safe: other runtimes and browsers may differ. Add the numbering system from `i18n.config.json`:

```ts
const tag = (locale: string, digits: "latn" | "arab") =>
  locale === "ar" ? `ar-EG-u-nu-${digits}` : locale;
```

Pick the regional base (`ar-EG`, `ar-SA`, `ar-AE`, `ar-MA`) from the product's market: it changes separators and date order. Keep one helper and use it everywhere, including next-intl's `formats` and `useFormatter`.

```ts
new Intl.NumberFormat("ar-EG-u-nu-latn").format(1234.5); // 1,234.5
new Intl.NumberFormat("ar-EG-u-nu-latn", { style: "percent" }).format(0.25); // 25%
```

## Currency

```ts
new Intl.NumberFormat("ar-EG-u-nu-latn", { style: "currency", currency: "EGP" }).format(1234.5);
// 1,234.50 ج.م.   (Intl wraps the result in invisible direction marks: copy output from code, not from this page)
```

Use the product's currency code. Do not strip or re-add the symbol. Prices inside Arabic sentences go in an LTR isolate when they are Latin-formatted (see `bidi.md`).

## Dates and times

```ts
new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "long" }).format(date); // 24 أكتوبر 2026
new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" }).format(date); // ٢٤ أكتوبر ٢٠٢٦
new Intl.RelativeTimeFormat("ar-EG-u-nu-latn").format(-3, "day"); // قبل 3 أيام
new Intl.ListFormat("ar", { type: "conjunction" }).format(["أ", "ب", "ج"]); // أ وب وج
```

Pass `timeZone` explicitly for server rendering to avoid hydration mismatches. `toLocaleString()`, `toLocaleDateString()` and `new Intl.NumberFormat()` without a locale are flagged by `rtl-scan` (`locale-format`).

## Hijri (optional)

Add a calendar extension: `ar-SA-u-ca-islamic-umalqura-nu-latn`. Measured on Node 24: `2026-10-24` renders `13 جمادى الأولى 1448 هـ` with `islamic-umalqura` and `14 جمادى الأولى 1448 هـ` with plain `islamic` (the calendars differ by a day: they are different calculation methods). Saudi Arabia officially uses Umm al-Qura. `Intl.supportedValuesOf("calendar")` on that runtime lists `islamic`, `islamic-civil`, `islamic-rgsa`, `islamic-tbla`, `islamic-umalqura`. TODO(verify) in each target browser; show Hijri only as a secondary display, never as the stored value (store ISO 8601 UTC).

## Plurals: six categories

`new Intl.PluralRules("ar").resolvedOptions().pluralCategories` returns `zero, one, two, few, many, other`. Measured selection: 0 is `zero`, 1 `one`, 2 `two`, 3 to 10 `few`, 11 to 99 `many`, 100 to 102 `other`, and fractions `other`.

ICU message covering all six (next-intl uses ICU MessageFormat):

```json
"items": "{count, plural, zero {لا توجد عناصر} one {عنصر واحد} two {عنصران} few {# عناصر} many {# عنصرًا} other {# عنصر}}"
```

`translate-check.mjs` fails an Arabic plural that lacks a category; `=0`, `=1` and `=2` count for `zero`, `one` and `two`. English needs only `one` and `other`.

## Inside sentences

Phone numbers, order IDs, codes, and Latin-formatted prices embedded in an Arabic sentence: wrap in `<bdi>` or `dir="ltr"` isolates (see `bidi.md`). Do not mix digit systems on one screen: pick one per `i18n.config.json`.
