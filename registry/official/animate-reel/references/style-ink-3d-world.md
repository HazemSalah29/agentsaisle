# Style: ink-3d-world

**Production readiness:** demo only (one still per look proven, 2026-11-03: Khalid on the ridge over Makkah, golden and light; motion, text over it and full-reel render speed not tried yet)

Our own 2D characters (the faceless rider and horse from the Khalid series, `assets/rider.js`) standing as lit cards inside a real three.js world with black ink outlines. The user's pick (2026-11-03): "character is better in our style and the world is better in the 2nd". World method ported from mromidev/claude-animated-shorts (MIT, `references/THIRD-PARTY.md`); their lens blur and their bean-head characters are left out.

## Looks (colours are tunable any time)

**The win of this style is the 3D world: the buildings, the terrain, the ink lines and the camera moving through real space. The colours are the easy part** (the user, 2026-11-03: "colours are easy but the win is the buildings"). Both looks share the same world; only the `LOOKS` table at the top of the page changes. Tune any colour, light or grade number per reel, or add a new look to the table. Never treat a palette as part of the style.

- `golden` (default): backlit low sun at dusk, violet shade, peach horizon, black ink, saturated grade. Still: Khalid on the ridge, 2026-11-03.
- `light`: the Khalid series light cinematic look: pale blue to cream sky, soft day light, brown ink `#3F3424`, Part 3's `grainVignette` grade (lavender corners, warm brown edge, 7 % grain). Keeps a series that started in light cinematic consistent.
- Pick one with `?look=light` in the URL or `window.REEL_LOOK = 'light'` in a script before the module.

## Look

- World: real 3D geometry in metres (terrain, mud-brick houses, rocks, palms, the Kaaba as a dark cube), every surface painted with soft noise so no fill is flat.
- Ink: screen-space lines on the world only: depth jumps (near side, 4.6 px at 6 m to 2.6 px at 120 m) and normal creases (from 35 degrees, concave folds 0.7), near-black `#060507`, tinted toward the fog far away. Cards, sky and glow are never inked.
- Light: one frozen sun per shot. Two-tone shading: lit and shade colours from the look (golden: warm [1.55, 1.08, 0.66] and violet-blue [0.40, 0.39, 0.68]; light: [1.12, 1.06, 0.95] and [0.84, 0.82, 0.88]), real sun shadows (4096 map, 5x5 PCF).
- Sky: gradient by elevation, peach horizon `#ffcf8e` to coral, lilac and violet, thin streak clouds, a soft sun disc.
- Depth: fog = horizon colour (55 to 540 m), a sharp near rock at a frame edge. Never lens blur (look.md: depth is layers, not blur).
- Characters: `drawRiderCard(t, o)` draws our rider on a 1200x900 canvas; the card stands in the world facing the camera, tinted by the scene, with a soft contact shadow under the hooves. Faceless always; never a prophet; a female figure only fully covered.
- Gold: only for meaning (the demo: the opened letter, an additive glow plus rising motes).
- Grade: Khronos PBR Neutral tone map, then per look: `golden` saturation 1.1, a lavender-warm vignette and 4.5 % grain; `light` Part 3's grainVignette. Both are in `gradeMat` (`uMode`).
- Watermark on the screen canvas, outside the camera.

## Motion

- Camera: every hold creeps in (the demo pushes about 7 % over 6 s); cut on big jumps, glide the rest over 18 to 40 frames with smootherstep; impact kicks flip sign each frame and die over 7 frames.
- The rider card can be redrawn per frame (cape wave, horse gait from `horse(ph, stand)`), or drawn once for a still hold.
- Never moves: the sun inside one shot (it is frozen per shot, so shadows never crawl).

## How it explains

- Story device: our rider in a real place the camera can travel through (a ridge, a street, the valley).
- Labels and text: Part 3's caption and label functions on the screen canvas.
- Emphasis: gold light on the one object that matters.
- Scene change: move the camera inside the same world, or a crossfade of 6 to 8 frames when the place changes.

## Build notes

- Page: `assets/styles/ink-3d-world.html`. three.js r186 from `assets/vendor/three` through an import map; `../stick-rig.js` then `../rider.js` as plain scripts before the module.
- Passes per frame: sun depth, world colour with sky, world normals + depth, ink mask, ink composite, cards on top (no depth test, so keep world objects out from in front of a card), grade to screen.
- Layout: terrain is `hgt(x, z)`; place anything with `y = hgt(x, z)`. Card size for a horse: 5.36 x 4.0 m, centre at ground + 2.0 - 0.134.
- Captured with `capture.mjs` like any reel page (`window.frame(t)`, `window.ready`).
