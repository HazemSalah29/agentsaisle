# Style: Deep-sea glow

The midnight zone: near-black water, marine snow streaming past as the camera sinks, and nothing lit but living light. A jellyfish whose nerve net switches on node by node, a chain of glowing bells lit segment by segment, a rainbow comb jelly. The words form out of gathering plankton. Calm and reverent, and no faces anywhere.

## Look

- Water: gradient from `#0c2c4a` to `#010609`, a hazy noise layer added on top, faint light shafts and a surface shimmer that fade as the camera sinks.
- Light is always additive (`lighter`): cyan `[80,232,255]`, teal `[40,230,195]`, blue `[70,140,255]`, violet `[150,120,255]`, magenta `[255,80,205]` and amber for small accents. Type glows ice `[190,250,255]`.
- Marine snow in three parallax layers (600, 250 and 34 soft bokeh discs); the near layer is out of focus.
- Type: Baskerville italic 80 px for the hook, glowing (wide halo plus a bright core), Baskerville 54 px for the English, Menlo spaced capitals in teal for the citation. Arabic in Scheherazade New 112 px, glowing ice.
- Finish on every frame: vignette (0.6, `0,0,4`) and film grain.

## Motion

- The camera sinks: snow streams up in streaks that settle to a drift over about 2.6 s.
- The hook gathers out of plankton (text sampled to points, points fly in on curved paths, edge points bright), holds crisp, then scatters again.
- The jelly wakes: nerve nodes flicker alight one by one, rim lights chase round the bell, light beads run down the tentacles, pulses travel along the net. The siphonophore chain lights bell by bell.
- Arabic is written on with the pen mask right to left, with a glowing nib.
- When "ease" lands, a bloom of plankton opens out from the jelly with one thin ring.

## How it explains

- Story device: A descent through the dark water, each depth one idea.
- Arrows and flow: Glowing currents and drifting plankton trails carry things from place to place.
- Labels and text: Soft glowing captions; small spaced mono labels.
- Numbers and counts: Counts as a chain of lights that grows, or a bloom-burst when it peaks.
- Emphasis: A brighter pulse or a lure of light draws the eye to the key spot.
- Scene change: The camera sinks to a new depth, or a plankton bloom sweeps across and clears.

## Build notes

- All creatures are drawn in code with `lighter` blending and radial-gradient sprites (`soft` and `core`); sprites are cached per colour.
- Far, out-of-focus animals are drawn once into a small canvas, blurred, and reused as sprites. Cheap depth of field.
- Plankton text: sample the text to points once, keep edge points bright. `gather(p)` runs backwards for the dissolve, so one function does both.
- Grain: the reference rewrites every pixel; here a seeded 256 px noise tile is laid on with `lighter` at a different offset each frame. Same look, about a tenth of the cost.
- Gotcha, Arabic layers: for the "marks last" pass the body layer has the tashkeel stripped. Stripping sukun, shadda or fathatan changes the advance widths and the two layers drift apart, giving doubled letters. Strip only fatha, damma, kasra and the tanween kasra and damma (`/[ٌ-ِ]/g`), and cross-fade body to full text.
- Gotcha: a dark backing glow drawn with `fillRect` of a radial gradient is cut off in hard edges if the rect is smaller than the gradient. Fill the whole canvas.
- No eyes: drop the reference's anglerfish. Keep creatures to jellies, chains and comb jellies.
- Hexagram check: the comb jelly and plankton are round sprites; nothing star shaped is used.

## Good for (examples, never limits)

Hardship that still holds light, being at the bottom, hope appearing in the dark, "with hardship comes ease". Soft sounds only (plinks, glass, one bell).

## References

- `references/prompt-deep-sea.md`.

## Working example

`assets/styles/deep-sea-glow.html`: a 10 s page (QURAN 94:5). "Some days you sink." gathers from plankton, a jelly and a bell chain light, the Arabic is written, a bloom opens on "ease".
