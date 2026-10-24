# RTL QA checklist

Run the scripts first; use this list for what they cannot see. Review en and ar screenshots side by side at 1440 px and 390 px.

## Automatic (must pass)

- [ ] `rtl-scan`: 0 errors; warnings reviewed.
- [ ] `translate-check`: passes (no missing keys, placeholder mismatches or missing plural categories).
- [ ] `screenshot-rtl`: no horizontal overflow in `ar`.
- [ ] Project build, lint and tests pass.

## Document

- [ ] `<html lang="ar" dir="rtl">` on Arabic pages; `lang="en"` on embedded English runs.
- [ ] `hreflang` alternates and a translated `<title>` and meta description.
- [ ] Language switcher keeps the current page and shows each language in its own name (العربية, English).

## Layout

- [ ] Sidebar, drawers, menus, dropdowns open from the start side.
- [ ] Directional icons are flipped; logos, media controls, checkmarks and clocks are not (`mirroring.md`).
- [ ] Carousels: first slide on the start side; swipe and arrow keys move the right way.
- [ ] Progress bars and sliders fill from the start side.
- [ ] Absolutely positioned decorations and tooltips attach to the correct side.
- [ ] Scrollbars appear on the correct side (browser default).

## Text

- [ ] Arabic font loads (check the network panel); no fallback glyph boxes.
- [ ] No letter-spacing on Arabic; no uppercase or italic.
- [ ] Line height comfortable; diacritics not clipped.
- [ ] No fixed-width text containers; no truncated labels in buttons or tabs.
- [ ] Mixed text (names, URLs, codes) isolated with `<bdi>` / `dir`; parentheses on the right side.

## Data

- [ ] Digits consistent with the config on every screen, including charts and tables.
- [ ] Prices via `Intl` with currency code; dates and relative times via `Intl`.
- [ ] Plurals correct for 0, 1, 2, 3, 11 and 100.
- [ ] Sorting uses `Intl.Collator("ar")` where lists are alphabetical.

## Forms

- [ ] Email, URL, phone, password and code fields are LTR and start-aligned.
- [ ] Icons inside inputs sit on the correct side and do not overlap text.
- [ ] Validation messages translated and placed correctly; arabic-indic digits accepted on input.

## Content

- [ ] `translation-review.md` written; native-speaker review recommended.
- [ ] Images with embedded text have Arabic versions or are replaced.
- [ ] Emails, PDFs and error pages (404, 500) localized.

## Accessibility

- [ ] Screen reader announces Arabic with the right voice (`lang` set).
- [ ] Focus order follows reading order; focus rings visible on the mirrored layout.
- [ ] `aria-label`s translated.
