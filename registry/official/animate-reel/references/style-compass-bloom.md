# Style: compass bloom (Islamic star pattern construction)

**Production readiness:** needs work (the proven scene is a small panel and a grid of tiny stars that read as small on a phone; hairlines at 40 percent on indigo are faint; no camera; one idea, one construction)

Seen in the geometric-construction tradition: how a master draws an Islamic star pattern with only a compass and a ruler, one circle first, then radii, a polygon, and the star. Craft sources are Kaplan's star-pattern work and the Bridges math-art papers (see References). Slow, exact, calm: the viewer watches order appear from one circle.

## Look

- Ground: deep indigo `#0a0e28`.
- Construction lines: cream `#efe6cf` hairlines, 1.5 px, about 40 % opacity.
- The star: gold `#e0b552`, 3 px (2 px in small tiles), with a soft gold fill at 16 % once it locks.
- Caption in Baskerville, cream, with the key phrase in gold italic. Small Menlo labels in gold ("DONE ONCE", "ONE TILE A DAY", "DAY 07") in thin framed panels. Tiny handle at the bottom.

## Motion

- Weight: exact and weightless, like drawing with a compass. Strokes draw on with an ease-in-out (`zeta` 1); only the star lock gets a tiny settle (`zeta` 0.8, 3 percent scale) and the tiles click in with `zeta` 0.7.
- Camera: a flat plan view. It pushes into the construction as it draws (the circle fills the frame, then pulls back to show the star) and slides over to the next tile. It never tilts, rotates or goes into perspective.
- Entering: lines draw themselves (`pathLength` dash offset), one stroke after the next, in construction order: circle, radii, polygon, chords. Leaving: strokes retract in reverse, or fade to a ghost that stays as the reference.
- Transformations: cream hairline to gold as the shape locks, a soft fill lights on the lock, a polygon becomes a star, a star becomes a tile in a repeating pattern, gold diamonds appear in the gaps.
- Transitions: 1) the big star slides up and ghosts out while the grid takes the frame, 2) the whole pattern keeps repeating outward until it tiles the screen and becomes the new ground, 3) the construction runs backwards to one circle, and a new construction starts from it.
- Timing feel: patient and mathematical. The hero build is about 3 to 4 s, small tiles 0.4 s each with a beat of 0.32 s between them, and every stroke starts as the last one finishes.
- Never moves: the grid spacing, the ground, the ghost star. Nothing wobbles or boils; a line is either drawing or still.

## How it explains

- Story device: One pattern is constructed once, then repeated small to show daily habit.
- Arrows and flow: Construction hairlines (radii, chords) lead the eye; no arrowheads.
- Labels and text: Baskerville caption, gold italic key phrase; tiny Menlo labels in thin framed panels.
- Numbers and counts: A day counter in a framed panel ticks as each tile is built.
- Emphasis: Gold takes over from the cream hairlines the moment the shape locks.
- Scene change: The big star slides up and ghosts out; the tile grid takes the screen below.

## Build notes

- One function `bloom(cx,cy,R,u,gm,hw,gw)` draws every stage from a single progress `u` (0..1). Reuse it for the big star and every tile.
- Self-drawing strokes: `pathLength="1"`, `stroke-dasharray="1 1"`, `stroke-dashoffset=1-p`. Skip the path when p is 0 (round caps leave dots).
- Star {8/3}: join vertex i to vertex i+3 on an 8-gon. Octagon vertices at `(i*45-90)` degrees.
- Pure SVG, 100 % `frame(t)` driven, no random. 300 frames render in about 100 s with other builders running; 15 small tiles are cheap.
- Sound: `tick` per drawn line (quiet), `plink` then `bell` on the lock, `thud` when the big star stops, `tick` per tile, `bell2` at the end.
- Keep the top panel's star on screen as a ghost; it is the contrast.

## Good for (examples, never limits)

Tawheed, order in creation, step lists, consistency over intensity, anything "built piece by piece".

## References

- Kaplan, star patterns: mi.sanu.ac.rs/vismath/kaplan (unverified)
- Bridges 2025 paper: archive.bridgesmathart.org/2025/bridges2025-255.html (unverified)
- Girih tiles, Science 2007 (Lu and Steinhardt): peterlu.org (unverified)

## Working example

`assets/styles/compass-bloom.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
