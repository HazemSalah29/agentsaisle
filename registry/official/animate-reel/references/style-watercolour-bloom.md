# Style: Watercolour bloom

Soft washes of paint spread across cold-press paper and flowers open on their stems. Calm, warm and gentle, a little girly without being pink: dusty rose, lilac, butter and sage on cream, with plum ink for the words.

## Look

- Paper `#f6efe3` with a fine grain (feTurbulence, multiply, 55% opacity).
- Paints: dusty rose `#d9a1a8`, lilac `#b9a6d3`, butter `#f1dc9b`, sage `#a9bc9a`, deeper rose `#c7838f` for petal contrast. Plum ink `#4a2f4f` for Arabic and English, `#5b4a5e` for the lead-in lines.
- Type: Georgia italic 64 px for story lines, Georgia roman 56 px for the quoted English, Scheherazade New 120 px for Arabic, small Menlo spaced capitals for the citation and handle.
- Every wash has a soft bleed halo, three stacked layers and a darker pigment ring at its edge. No hard shapes, no outlines on petals.

## Motion

- A wash spreads with an ease-out cube, so it rushes then slows like paint wicking into paper. Background washes keep drifting about 14 px so the page is never still.
- Stems grow first (1 s), then the petals open one after another about 0.07 of the bloom time apart, then a butter centre fills.
- Heads sway a few pixels with a sine. Text rises 26 px with a fade.
- Key Arabic is written with a right-to-left mask edge (pen reveal) over 1.8 s.

## How it explains

- Story device: A bloom that opens: washes spread, stems grow, petals open one by one, then the centre fills.
- Arrows and flow: A brush stroke with pooled edges, or a vine that grows toward the flower.
- Labels and text: Georgia italic story lines in plum ink rise in, Arabic written with a pen reveal.
- Numbers and counts: Petals open one at a time, so the count is the number of petals.
- Emphasis: A deeper rose pigment ring on one petal, or the butter centre filling last.
- Scene change: Background washes keep drifting; text rises in and out, so the page never cuts.

## Build notes

- One 2D canvas, redrawn from scratch each frame, so `frame(t)` stays a pure function. Text stays as DOM above it.
- Fill the canvas with the paper colour first, then set `globalCompositeOperation='multiply'` for washes. Multiply on a transparent canvas does nothing, because it multiplies only against canvas pixels.
- Outline wobble: radius times `1 + .13 sin(3a+seed) + .09 sin(5a+seed*2.1) + .05 sin(9a+seed*3.7)`. Use a different seed per layer so the layers do not line up.
- Petals are the same wash function with an elongated ellipse and a rotation, not a new shape.
- Gotcha: keep flower heads below about y 1450 and text above it. Heads bigger than 175 px reach the handle line.
- Gotcha: stems drawn after the flowers look like sticks on top; draw them first.
- Cost is small: about 20 polygons of 56 points per frame.

## Good for (examples, never limits)

Mercy, patience, hope after hardship, gratitude, gentle reminders, anything meant to feel like a hug.

## References

- https://helpx.adobe.com/bg/after-effects/how-to/watercolor-bleeding.html - bleeding paint and its pooled edge (from search, not opened)
- https://www.framer.com/marketplace/components/flowers-bloom/ - stems grow, then open into watercolour flowers with paper texture (from search, not opened)
- https://elements.envato.com/botanical-micro-elements-M5S3WC5 - animated watercolour leaves and blossoms (from search, not opened)
- https://patternbank.com/dinasimba2009/designs/779401465-soft-pastel-watercolor-floral-bloom - pastel overlapping blooms (from search, not opened)

## Working example

`assets/styles/watercolour-bloom.html`: a 10 s page (QURAN 94:5). Read it for the wash and petal functions; do not reuse its layout as a template.
