# Style: Isometric pastel

A small floating tile in true 30 degree isometric: flat three-tone faces, pastel blocks, one coral accent, long soft shadows. Things pop up one at a time on a springy overshoot, so it suits any idea that is built step by step. The camera glides and zooms; the projection never tilts. No figures.

## Look

- Ground: diagonal gradient `#f6efe8` to `#efeaf4` to `#e4e3f3`, a faint dot grid (3 px dots every 36 px, `rgba(120,110,170,.10)`), a soft white radial glow behind the tile, a few blurred white clouds drifting.
- Slab `#cfc6ea` over a soil layer `#b9addf`, floor `#fbf8f3` with a paving grid, mint grass `#d5efe1`, pond `#c9e6f4`.
- Blocks: mint `#cfeadf`, peach `#fbe3d3`, lavender `#d9d0f5`, butter `#fbeab5`, sky `#cfe3f7`. Accent coral `#ff6b5b` (lantern, finial, tags, dashes). Ink `#2d3058`.
- Face shading from one base colour: top = 42 percent toward white, left = 8 percent toward white, right = 28 percent toward `[92,88,150]`, edge highlight on the top and front ridges.
- Type: a rounded sans (Avenir Next here) in a white card with a soft shadow; Scheherazade New for the Arabic in ink; Menlo spaced capitals for the citation in coral.

## Motion

- The tile rises into frame (ease-out, 1.1 s) and then bobs a few pixels. Its long shadow fades in with it.
- Each block pops with `E.back` on its height (0.38 s), one every 0.44 s, with a wood click. A white pill tag ("day 3") pins to the newest block and leaves.
- Camera: focus point and scale lerp together (`ease inOut`) so it climbs the stairs with the newest block.
- After the climb, a coral dashed route with travelling lights follows the steps, and the last object lights (here a lantern with an expanding ring).

## How it explains

- Story device: One long isometric floor, objects in a chain the camera glides along.
- Arrows and flow: Curved dashed connectors; things ride a conveyor.
- Labels and text: White label tags pinned to objects, in plain sans.
- Numbers and counts: A counting billboard and a tag that rides the newest bar.
- Emphasis: A glowing outline on the object that matters.
- Scene change: The camera glides along the floor to the next machine; no cuts.

## Build notes

- Projection `P(x,y,z) = [cx + ((x-fx)-(y-fy))*cos30*s, cy + ((x-fx)+(y-fy))*0.5*s - (z-fz)*s]`. A sphere of radius r is a circle of radius `1.2247*r*s`; a floor circle is an ellipse `1.2247 r s` by `0.7071 r s`. Use these for trees, cylinders and domes, never a guessed ellipse.
- Dome: path = upper half of the big circle, then the front half of the base ellipse. Latitude rings are ellipses of radius `sqrt(1-k^2)`.
- Depth order: do not sort by x+y+z. Sort objects as boxes: A is drawn before B when `A.x1<=B.x0 || A.y1<=B.y0 || A.z1<=B.z0`, then a depth-first topological pass. Spheres use their bounding box.
- Contact AO: three widening strokes along the floor edges of a box, only when the box sits on z=0.
- Gotcha: `E.back(0)` is about 1e-16, not 0. A "not yet" test of `k<=0` drew a zero-height slab floating in the air for the whole reel. Test `k<=.001`.
- Gotcha: `parseInt('600 40px Avenir')` is 600. Read a font size with `/(\d+)px/` when fitting text to a width.
- Soft shadows: draw into the main canvas with `ctx.filter='blur(10px)'` at low alpha; no offscreen layer needed.

## Good for (examples, never limits)

Anything built a little at a time: regular small deeds, steps, a path, a habit.

## References

- `references/prompt-isometric.md`

## Working example

`assets/styles/isometric-pastel.html`: a 10 s page (SAHIH AL-BUKHARI 6464, "You do not have to climb it all today." then seven steps, a domed pavilion and a lit lantern).
