# Style: Riso two-ink print

A risograph print brought to motion: two flat fluorescent inks (pink and blue) on cream stock, overlaps that multiply to a darker third colour, halftone dots for tone, a visible paper grain, and every ink jittering off register at a stepped 10 fps. Seen in Riso poster work (Hiromu Oka in It's Nice That) and in riso effect/animation write-ups (see References).

## Look

- Ground: cream `#f0e6d0` with a speckle grain overlay (multiply).
- Ink 1 pink `#ff4aa8`, ink 2 blue `#1b6fc4`. Nothing else. Overlaps go purple by `mix-blend-mode: multiply`.
- Type: Futura, heavy, flat, left aligned and big (92-118 px). Small Menlo labels in the ink colour, wide tracking.
- Tone only by halftone dots (discs whose dot radius falls off with distance), never gradients.
- Shapes: solid dot plus a halftone halo, dashed day cells, thick plain lines.

## Motion

- 10 fps stepped: all animation reads `tq = floor(t*10)/10`.
- Each ink gets its own seeded offset (about 4 px) every frame, so the layers shimmer against each other.
- Elements print in over 3 steps (opacity thirds plus a 16 px rise), pops go 1.35 to 1 in 3 steps, the hook wipes off right in steps.
- The big deed prints once, runs a short line and stops at an X. The small deed adds one blue dot per day until day 10.

## How it explains

- Story device: A two-ink poster that is printed in: pink and blue layers over cream, never more than two colours.
- Arrows and flow: A thick plain line or a dashed row of cells, printed in over three steps.
- Labels and text: Heavy flat Futura, left aligned and big; small mono labels in the ink colour.
- Numbers and counts: Dashed day cells that fill with a blue dot one per day, halftone dots for tone.
- Emphasis: Where pink and blue overlap they go purple; one word set in the pink ink.
- Scene change: Elements print in and wipe off right in steps at 10 fps; layers shimmer against each other.

## Build notes

- Two full-size SVGs, one per ink, each `mix-blend-mode: multiply`. Draw each ink's shapes only in its own SVG, so overlap is real.
- Misregistration: `translate` the whole ink group by `(h(f*3+k)-.5)*8`, with `h` a seeded integer hash.
- Halftone: generate circles in JS on a rotated grid (pink 15 deg, blue 45 deg), radius from a falloff function. A square grid clipped to a disc looks octagonal; accept it or use a finer spacing.
- Grain: one static `feTurbulence` + `feColorMatrix` alpha threshold rect, translated per frame. Cost is low (no per-frame filter change).
- A pink band placed over a blue dot gives the purple overprint that sells the look.
- Render cost was small (about 400 circles per frame).
- Gotcha: put labels where bands and halos will not run under them.

## Good for (examples, never limits)

Lists, daily habits, gratitude, charity, counting days, any contrast of two things.

## References

- https://www.itsnicethat.com (Hiromu Oka riso work) - flat two-ink layering and overprint (unverified, from search summary)
- https://www.williambottini.com (spinning heart riso animation) - stepped ink motion (unverified)
- https://effect.app (risograph effect notes) - grain and halftone treatment (unverified)

## Working example

`assets/styles/riso-print.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
