# Style: Dreamy aura

The Pinterest "aura" look in motion: big blurred pastel blobs on cream, a frosted glass card, a serif, a fine grain. The blobs are restless at first and settle as the verse lands, so the colour itself shows the calm.

## Look

- Cream `#fbf4ea`. Blobs: dusty rose `#eab2b8`, lilac `#c9b8e8`, butter `#f6e7a8`, sage `#bcd0b5`. Never more than four hues.
- Glass card: `rgba(255,255,255,.3)`, 1.5 px white border, 64 px radius, `backdrop-filter: blur(26px)`, a soft lilac shadow.
- Type: Georgia italic 64 px for the lead-in, Scheherazade New 96 px for Arabic, Georgia 50 px for the English, plum `#4a3548`, Menlo spaced capitals for the citation and handle.
- Grain on top (feTurbulence, multiply, 45%).

## Motion

- A calm value goes 0 to 1 around the key moment. At 0 the blobs are small, orbit fast and tight; at 1 they are wide, slow and soft, and a warm butter glow rises behind the card.
- The card rises 40 px with a fade. Arabic is written word by word, right to left, each word with its own pen reveal.
- Text rises about 24 px with a fade. Nothing snaps.

## How it explains

- Story device: One calm value goes from 0 to 1 and the whole scene relaxes with it.
- Arrows and flow: None; the blobs drifting wider and slower is the flow.
- Labels and text: Georgia italic lead-in, Arabic written word by word, plain English under.
- Numbers and counts: Rarely used; keep to one number at most, large and soft.
- Emphasis: A warm butter glow rises behind the card at the key moment.
- Scene change: The card rises into place with a fade; blobs carry across, nothing snaps.

## Build notes

- No CSS blur needed: a canvas radial gradient with alpha stops (1, .45, 0) is already blurred and is cheap to redraw per frame.
- Keep text on the glass card, not on the moving blobs; the hue and brightness shift under it otherwise.
- `backdrop-filter` works in the capture Chrome and frosts the canvas behind it.
- Split Arabic by words only, joined with a space, never by letters. Each word is `display:inline-block` so it can be clipped on its own.
- Gotcha: a child of the card needs its own colour, because only `.t` elements set it.
- Gotcha: the card needs about 700 px of height for a two-line Arabic verse plus a two-line English line.

## Good for (examples, never limits)

Peace of heart, dhikr, anxiety, sleep, du'a, any verse about a state of mind.

## References

- https://wallpapers.com/aura-background - pastel aura collection (from search, not opened)
- https://www.superdesign.dev/styles/aurora - blurred blobs, glass panels, thin serifs, three or four hues (from search, not opened)
- https://dribbble.com/EveryWeekendDesign/shots - organic glass backgrounds (from search, not opened)
- https://www.canva.com/es_ar/plantillas/s/aura/ - Pinterest-style aura pins (from search, not opened)

## Working example

`assets/styles/dreamy-aura.html`: a 10 s page (QURAN 13:28). Read it for the calm value and word-by-word pen reveal; do not reuse its layout as a template.
