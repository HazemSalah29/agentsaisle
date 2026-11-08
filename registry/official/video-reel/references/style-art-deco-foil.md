# Style: Art Deco foil

A 1920s poster in black lacquer and stamped gold foil. Everything gold is one mask that is composited through a brushed foil texture with a bevel, so it reads as metal pressed into the page. Symmetric stepped arches, a sunburst that fans open, halo arcs, a hanging lamp, a stepped double border with corner fans. No skyscraper and no servers: the architecture is a nested arch with a lamp under it.

## Look

- Lacquer ground: radial `#2a2013` to `#0f0c08` to `#050403`. Lacquer grain 0.035 and vignette 0.45 last.
- Foil: a diagonal gradient (`#6b4a16 #c99a3e #f6e2a0 #fff3c8 #c08f36 #8a6220 #c99a3e #e0b653 #a67a2a #d6a948 #6e4c16`) with row-brushed noise, built once. Dim rays are flat `#c08a34`. Cream accents `#efe3c4`.
- Frame: stepped double border (inset 20 and 30), quarter-fan corners, diamond studs at the side centres.
- Arches: four nested semicircular arches (half widths 300 250 200 150) with capitals at the springing line, small ticks and a diamond at each crown, a stepped plinth, two fluted pilasters with fan crowns.
- Type: Copperplate caps on a black lacquer plaque with a gold hairline and diamond studs (the hook), Futura caps in cream for the English, Scheherazade New stamped in foil for the Arabic and Copperplate for the citation.

## Motion

- 0 to 1.8 s: the border inscribes itself (dash), the arches rise tier by tier, the plinth and pilasters grow, corner fans open, the hook plaque is stamped letter by letter. All of it is dim gold: the dark before the light.
- Around 4.0 s (the line about ease): the lamp ignites in cream with a bloom, the halo arcs close from both ends, the sunburst opens, every gold part brightens to full foil. Arabic is written with the pen in foil.
- After that: a single slow glint sweeps across the foil, pilaster lamps twinkle at 5 steps a second. The last lines hold still.

## How it explains

- Story device: A gilded picture-palace sequence, one beat per gold-framed scene.
- Arrows and flow: Stepped chevron arrows in foil gold.
- Labels and text: Cream name plaques on a gold rail, plain caps.
- Numbers and counts: An odometer rolls the digits; a sunburst gauge fills.
- Emphasis: A spotlight ring or a beacon glint on the key word.
- Scene change: Closing and opening gold elevator doors hide the cut.

## Build notes

- Draw all gold into a mask canvas `M` (white shapes). Composite: foil base + moving glint, `destination-in` the mask, then a dark offset copy (+1.5, +2.5), the foil, and a light offset copy with `screen` for the bevel. Keep the foil base in a cache; only the glint gradient changes per frame.
- Dim and bright gold are the same mask drawn at `globalAlpha` .3 versus 1.
- Gotcha: the gradient stops decide where text lands. A bright stop under the Arabic made the foil read white. Keep the area under the text on mid golds and keep the bright stops narrow.
- Gotcha: do not name a helper `frame`; it overwrites `window.frame`. Use `borderFrame`.
- The reference's beacon is an 8-point star: replace it with a round jewel or a lamp flame so nothing reads as a badge or a logo.
- Gotcha (font): check the Arabic dots on a full-size crop with a pixel count (see the note in nouveau-card).

## Good for (examples, never limits)

Hardship then ease, light after darkness, dawn, a verse about a lamp, a gate or a threshold, anything that "opens".

## References

- `references/prompt-art-deco.md`

## Working example

`assets/styles/art-deco-foil.html`: a 10 s page (QURAN 94:5, "SOME NIGHTS FEEL ENDLESS."). Canvas 2D with five full-size layers; one foil composite per frame.
