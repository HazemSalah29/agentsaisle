# Style: Hidden-line wireframe

A vector-display night: a mesh landscape in true perspective with real hidden-line removal, phosphor cyan lines on deep navy, a wire crescent turning in the sky, and amber lights planted one by one along a winding route. The camera really flies the terrain, so ridges slide past and hide the lamps behind them. Everything is geometry drawn as lines in code.

## Look

- Night: sky gradient `#02051a`, `#081440`, `#0f2160` at the horizon, haze `(14,30,88)`, ground fill `(5,10,34)` mixing to haze with distance, 180 faint stars (never six-pointed: 2 px squares), a pale horizon haze line.
- Lines: phosphor cyan `(40,200,255)` brightening to `(210,250,255)` on high ground, 1.7 px near thinning to 0.5 px far, fading out with distance. Amber `#ffd36b` for everything that is a deed: the lanterns, the lit route, the tiles under it. A white scan row sweeps along the mesh.
- Lanterns: a small cube with a pyramid roof on a pole, drawn hidden-line (faces filled with the night, edges amber), a white flame inside with an additive amber halo.
- Moon: a pillow-thick wire crescent in cyan-white, hidden-line, with a soft cyan halo.
- HUD: dark translucent panels (`rgba(3,8,30,.88)`) with a cyan left bar, a 1.5 px border and corner ticks, Menlo type, a counter tag `DAY 07` in amber. The verse sits on one such panel: Arabic in Scheherazade New 86 px, near-white with a cyan glow; English in Menlo 38 px; citation in a tag.
- Finishing (all ported from the reference): bloom (half-resolution blur at 3.5 px, added back at 55 percent), scanlines (1 px at 14 percent every 3 px), vignette.

## Motion

- The mesh builds outward from the camera in the first 2 s, a bright scan row at the leading edge.
- The camera flies the valley at a steady pace, low, yawing to follow the route. A lantern is planted every 0.3 s far ahead, popping up on a spring with a ring expanding on the ground; the route behind each one lights, and the counter ticks. The steadiness is the point: small, regular, never skipped.
- At 6 s the camera rises and pulls back over the route (inOut, 2.5 s), pitching down, so the whole lit line is seen winding to the horizon, where the crescent hangs. Lanterns keep being planted until the end.
- The crescent swings about 55 degrees on its vertical axis all the time so its thickness shows without ever turning edge-on.
- The Arabic is written with the pen mask, one line at a time; the English lines rise one by one; the citation tag lands last.

## How it explains

- Story device: Learning as descent over a hidden-line landscape: the camera flies down the mesh to a basin.
- Arrows and flow: A dashed downhill vector that the camera follows, or an amber marker moving along the slope.
- Labels and text: Bracketed HUD tags that type on; mono labels at the corners.
- Numbers and counts: Big mono readouts that tick as the marker descends.
- Emphasis: An amber marker and a glow on the basin; scan row and bloom on the mesh.
- Scene change: The camera flies on over the mesh; no cuts, fog hides the far edge.

## Build notes

- The world is fixed and the grid is world-aligned: rows at multiples of `STEP` in z, columns snapped to `STEP` around the camera, so lines never swim as the camera moves.
- Hidden-line removal is the painter's algorithm: rows far to near, each quad filled with the fog colour first, then stroked. Inside a row, draw the cells from the outside in, so nearer cells cover farther ones.
- Everything that stands on the land (lanterns, the route line, the planting rings) is drawn inside the same loop, right after the row it stands in, so ridges in front hide it. Drawing them after the terrain pass breaks the hidden-line look.
- Terrain: ridged noise (`1 - |n|`, squared) plus fbm, damped inside a valley around `pathX(z) = 9 sin(.045 z) + 3.5 sin(.11 z + 1)`, plus walls rising with distance from the route. The route is a flat floor so lamps always stand on something readable.
- Camera: yaw then pitch, `F = 1100`, principal point `(540, 900)`; positive pitch looks down. Yaw to the route point 26 units ahead.
- Crescent without boolean ops: parametrise the lens between the outer circle and the bite (`rho2(a) = -d cos a + sqrt(rc^2 - d^2 sin^2 a)`), mesh it in two sheets (z = plus and minus a bell profile) that meet at the edge, and painter-sort the quads. A first try that dropped the sphere quads inside the cutter left a ragged wall.
- Bloom needs the canvas copied at half size; do not blur at full size.
- Gotcha: lanterns planted right in front of the camera fill the screen; keep the first plant 8 or more units ahead and the lantern scale under 0.8.
- Gotcha: the HUD tag's `align` needs a real right-aligned case, or a centred tag at x 1020 runs off the frame.
- Gotcha: put the verse panel below y 975 and keep the pitch at 0.5; with a higher pitch the horizon, the moon and the end of the route all leave the top of the frame.
- Cost: about 40 ms a frame.

## Good for (examples, never limits)

Journeys, the night, the unseen, steady effort, the long road (deeds kept up day after day, a path walked, hearts that find their way). The panel is small, so long Arabic needs a bigger panel.

## References

- `references/prompt-wireframe-terrain.md`. Ported from it: the yaw-and-pitch camera, the back-to-front fill-then-stroke terrain, fog, scan row, bloom, scanlines, vignette, `hudBox` and `hudTag`. Changed: world-aligned grid, objects drawn in the terrain loop, a real crescent mesh in place of the wire sphere.

## Working example

`assets/styles/wireframe-terrain.html`: a 10 s page (SAHIH AL-BUKHARI 6464, "One small light, then another."). Read it for the row loop and the camera; do not reuse its route story as a template.
