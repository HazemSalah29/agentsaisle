# Style: qalam sketch (one scene drawn live, then it grows)

A reed pen (qalam) sketches one scene on dark paper while the story is told: first what is hard, then what changes. Pastel strokes, hatch fill, and one world that keeps growing until the end.

## Look

- Ground: dark olive-black `#161b14` with a static paper tooth (seeded once, never per frame).
- Pastel inks: cream `#efe3c8` for lines, bark `#a07a55`, sand `#c8734a` hatch, sage `#8fae7e` leaves, sky `#7fb4c9` water, gold `#e3b766` for the nib and key words.
- Each stroke is three passes of one path: a main line and two thin offset copies at 35 %, so it reads like pastel on paper.
- Hatch fill: short diagonal strokes (seeded once), clipped to the region and revealed by a growing clip.
- Captions: Baskerville in cream at the top, the key phrase gold italic. Citation in Menlo caps.

## Motion

- The qalam (gold nib, brown shaft, tilted 28 degrees) rides the tip of whatever is being drawn. It hides when nothing is drawing.
- Hard part first (bare ground, cracks, a dry branch), then the Arabic is written with the same pen, then the change sketches in (water, leaves, a flower).
- One scene the whole time. The camera can travel inside it, but no cut to a new picture.
- Leaves and flowers sway a few degrees once they land, so holds never go still.

## How it explains

- Story device: One scene sketched live with a qalam: hard part first, then the Arabic, then the change.
- Arrows and flow: A pencil-like line the nib draws between things, with a small arrowhead at the end.
- Labels and text: Cream serif captions on top, the key phrase in gold italic, citation in small caps.
- Numbers and counts: Hatching that grows in a region to show amount, or small tick strokes drawn one by one.
- Emphasis: The key word turns gold italic; the nib rides the tip of what is being drawn.
- Scene change: No cut: one scene the whole time; the camera travels inside it, and a drawing sketches in over the old one.

## Build notes

- Draw strokes with `stroke-dasharray` and `stroke-dashoffset` from `getTotalLength()`, each with a time window. The pen position is `getPointAtLength(L*p)`, so `frame(t)` stays pure.
- Arabic: one pass per line with a full-height band, body text with tashkeel stripped, then the full text. Cross-fade the body out while the full text fades in: the stripped string shapes a little differently in Scheherazade, and two layers at full strength made ف read like ق and doubled the dots (found building this sample).
- Keep the hatch sparse (24 x 30 px grid, 38 % opacity). Denser hatch reads as a brown block.
- Sound: a soft `tap` as each stroke starts, `key` ticks while the Arabic writes, a `bell` when the change begins, small `plink`s panned with each leaf. Bed: breeze or desert-wind.

## Good for (examples, never limits)

Stories with a before and after in one place: hardship then ease, a dry land and rain, Maryam and the palm, a seed that grows, the cave and the spider's web.

## Working example

`assets/styles/qalam-sketch.html`: a 10 s page in this style (Qur'an 94:5). Read it for the techniques; do not reuse its layout as a template. It loads `../ScheherazadeNew-Regular.ttf`.
