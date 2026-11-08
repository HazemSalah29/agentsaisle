# Style: Stained glass

A pointed-arch window of coloured glass held in black lead lines. The lead never moves. Only the light does: a sun climbs the window from the lower left, each pane ignites as it passes, and the verse is lit on a dark glass panel in the middle. Geometric and floral only, no figures.

## Look

- Ground: night `#0d0b1a`. Stone frame `#2a2630`. Lead `#15110e`, 9 px lines, round joins.
- Glass: ruby `#b3263a`, amber `#e8a33a`, cobalt `#1e4fa3`, emerald `#1f7a56`. Unlit panes are the same colour mixed 84 percent toward the night.
- Light `#fff1c9` for flares, the verse and dust. Gold `#e8a33a` for the citation and the glow behind the Arabic.
- Panes: a harlequin grid of diamonds (150 x 180) clipped to the arch, plus a 12-fold rose (centre jewel, 12 sector panes, 24 small triangles) in the upper half.
- Verse panel: a dark glass rounded rectangle with a lead border and a thin gold hairline that warms as the light arrives.
- Type: Scheherazade New for Arabic (100 px, light colour with a blurred amber copy behind it), Baskerville for English (56 px), Menlo spaced capitals for the citation.

## Motion

- Light front: `front(t)` sweeps along `u = x*.6 + (1500-y)*.8`. A pane's `lit` is `ease((front - u(pane)) / 260)`. Its colour goes from the dim mix to full glass.
- Flare: while a pane is half lit (`lit*(1-lit)*4`) it takes a little `#fff1c9`, so the front reads as a bright edge.
- Bloom: lit panes are drawn again blurred (26 px) with `mix-blend-mode: screen`, behind the lead.
- After the window is lit, a soft light band keeps sliding across (`exp(-((u - sweep)/220)^2)`), so the glass is never still. Dust motes drift up through the lit area.
- The Arabic is written on with the pen mask, right to left, in light ink. English lines rise in one by one. The final read holds.

## How it explains

- Story device: A cathedral window lit by a moving light front: panes warm into colour and the verse glows last.
- Arrows and flow: A band of light that sweeps along the leads in one direction.
- Labels and text: Light-ink Arabic written on a dark glass panel with a blurred amber copy behind it; the English rises line by line.
- Numbers and counts: The twelve-fold rose lights petal by petal; the lit panes are the count.
- Emphasis: A pane flares white while the front crosses it; the verse panel warms with a gold hairline.
- Scene change: The window never cuts; the light band keeps sliding and dust drifts up through it.

## Build notes

- Build the pane list once (polygons never move). Rebuild the SVG string each frame from `t`.
- Draw panes with the lead as the `stroke` of one group, so every shared edge is a clean line. Draw the rose ring and arch outline on top, wider.
- Mix colours in JS (`mix(hexA, hexB, k)` returning `rgb()`); it is cheaper and clearer than CSS filters for 300 panes.
- A static `feTurbulence` rect with a stretched `baseFrequency` (`.012 .05`) at 28 percent gives the wavy mottle of hand-blown glass. Clip it to the arch.
- Gotcha: put the verse panel on top of the glass, not into it. Text over coloured glass is unreadable at any contrast.
- Gotcha: Scheherazade New's marks rise high at big sizes. At 124 px the tashkeel collided with the English line below. 100 px with 85 px between Arabic and English is the clean setting.
- Gotcha: `lit` must be clamped by `ease()` or panes behind the front go negative and flicker.

## Good for (examples, never limits)

Light after darkness, guidance, hardship and ease, hope, a verse about light or hearts being opened.

## References

- https://sundayscreens.com/visuals/p/stainedglass - looping glass with light that glows and dims behind it (from search, not opened)
- https://www.researchsquare.com/article/rs-17285/v1 - lead lines stay fixed across frames (from search, not opened)
- https://makezine.com/?p=487519 - colour shifting behind a fixed geometric panel (from search, not opened)

## Working example

`assets/styles/stained-glass.html`: a 10 s page (QURAN 94:5, "Some days the glass is dark." then the light arrives). Read it for the techniques; do not reuse its layout as a template.
