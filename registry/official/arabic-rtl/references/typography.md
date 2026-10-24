# Arabic typography

## Fonts

Google Fonts with Arabic support, all open licensed:

| Font                 | Use                                                   |
| -------------------- | ----------------------------------------------------- |
| IBM Plex Sans Arabic | UI and body; default choice, pairs with IBM Plex Sans |
| Noto Sans Arabic     | broad coverage; neutral UI                            |
| Noto Naskh Arabic    | long reading (articles, docs)                         |
| Cairo                | friendly headings and marketing                       |
| Tajawal              | compact UI, good at small sizes                       |
| Readex Pro           | modern, with Latin built in                           |
| Almarai              | clean UI, limited weights                             |

Pair with a Latin face of similar weight and x-height (IBM Plex Sans Arabic with IBM Plex Sans; Noto Sans Arabic with Noto Sans). Mismatched x-heights make mixed lines look uneven.

Load only the weights you use (usually 400 and 600 or 700) and the `arabic` plus `latin` subsets. With `next/font`:

```ts
import { IBM_Plex_Sans_Arabic, IBM_Plex_Sans } from "next/font/google";
export const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-arabic",
});
export const latin = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-latin",
});
```

```css
:root {
  --font-body: var(--font-latin), system-ui, sans-serif;
}
:lang(ar) {
  --font-body: var(--font-arabic), var(--font-latin), system-ui, sans-serif;
}
body {
  font-family: var(--font-body);
}
```

TODO(verify): the exact export names and available weights in the installed `next/font/google` list.

## Rules

- **Never apply letter-spacing (tracking) to Arabic.** Letters connect; spacing breaks the joins. Reset it:

  ```css
  :lang(ar) {
    letter-spacing: normal;
  }
  :lang(ar) * {
    letter-spacing: normal;
  }
  ```

  `rtl-scan` accepts this global reset and then stops reporting `tracking-*` classes.

- **No `uppercase` and no `italic`** for Arabic: neither exists. Emphasize with weight or color. Do not apply `font-style: italic`; browsers synthesize a slanted, ugly fake.
- **Line height** around 1.6 to 1.8 for body text; Arabic has tall ascenders and marks above and below. Headings 1.3 to 1.5.
- **Size**: Arabic often reads better 1 to 2 px larger than Latin at the same nominal size. Do not go below 14 px for body text.
- **Weights**: very light weights (100 to 300) lose the thin joins. Prefer 400 and up.
- **Justification**: avoid `text-align: justify` for Arabic unless using kashida-aware `text-justify: inter-character` (TODO(verify) browser support).
- **Truncation**: `text-overflow: ellipsis` works; do not cut strings by character count in JavaScript (it can split joined letters or diacritics).
- **Diacritics (tashkeel)**: keep them if present in translated text; do not strip.
- **Line breaks**: no hyphenation; let words wrap whole.
- **Tabular figures**: use `font-variant-numeric: tabular-nums` for price columns.

## Mixed Arabic and Latin

Set `lang="ar"` on the document and `lang="en"` on embedded English runs so the browser picks the right font and shaping. See `bidi.md` for direction.
