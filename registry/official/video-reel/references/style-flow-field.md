# Style: Flow field

Thousands of hairline streamlines traced through a curl-noise field that parts around an unseen core, in additive colour on dark paper. First the field is a tangle, then it combs itself smooth and the lines flow around the core in calm braids. The tangle turning to order is the whole story. No figures.

## Look

- Ground: radial `#16182A` to `#08090E`. Core: a near-black disc `#1A1C28` to `#06070A` with a warm halo, a dark contact ring, an ivory hairline rim `#F3E6C8`.
- Palette by streamline identity, nine stops: `#123A4A #1C6F78 #5FB3A6 #CDE3CF #F3E6C8 #EDBB73 #DE7A52 #A8384E #5A1E44`. Each line is 1 px at 12 to 16 percent alpha, added, so overlaps glow.
- Bright sparks (22 px tails) ride about 110 of the lines.
- Type: Baskerville italic 68 px ivory for the lines, Scheherazade New 150 px in amber `#EDBB73` for the Arabic, Baskerville 60 px, Menlo spaced capitals for the citation.
- Finish: vignette and film grain.

## Motion

- The core ring draws on, then lines are released in a wave from top to bottom and grow outward from their seed points.
- Turbulence runs high (340) then drops to 34 between 3.0 and 5.4 s: the field visibly combs into order and the braids hug the core.
- Sparks ride the currents the whole time, so a held frame never freezes.
- Text types on, the Arabic is written with the pen.

## How it explains

- Story device: The idea is a flow field with a dark core; particles carry the story.
- Arrows and flow: Particle streams that spiral in; a coral counter-current for the return path.
- Labels and text: Hairline Space Mono captions and small labelled particles.
- Numbers and counts: Counts as a tally of particles settling into order.
- Emphasis: A coral particle or a push-in of the camera on one carried item.
- Scene change: The camera pushes in and the field re-combs; no cuts.

## Build notes

- Stream function on a grid (6 px here): potential flow around a cylinder plus fbm noise that fades near the core. Velocity is the curl of it, so lines never cross or end inside the field. Flow runs top to bottom for portrait.
- Trace each seed both ways with fixed-length steps (3.2 px), bucket lines by colour, stroke each bucket as one path. Skip seeds inside the core.
- Dense and quiet bands come from rejecting seeds with a noise mask (`rng() > .1 + dens^2 * 1.45`).
- Bloom: draw the line layer at a quarter size with a 3 px blur and add it back at 60 percent under the sharp layer.
- Cost: about 100 ms a frame at 1080x1920. Use seed count and `STEPS` to trade speed for density.
- Gotcha: fill the whole canvas with the dark backing gradients, or the rectangle edges show.
- Gotcha, Arabic layers: strip only `[ٌ-ِ]` for the body layer (see deep-sea-glow).

## Good for (examples, never limits)

Gentleness, rushing against care, order after tangle, things that flow around what cannot be moved. Calm, no deep hits.

## References

- `references/prompt-flow-field.md`.

## Working example

`assets/styles/flow-field.html`: a 10 s page (QURAN 18:19). "Rush, and it all tangles." then the field combs smooth around the core and the single word is written.
