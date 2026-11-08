# Style: Frosted glass

Real frosted panes floating in 3D over vivid gradient orbs. Each pane blurs whatever is behind it at that depth (orbs, the background, another pane), so an orb is sharp where it sticks out past the glass and soft where it sits behind. The panes are slabs with thickness, a 1 px light border and a specular sheen that slides as they turn. Unlike dreamy-aura (blurred pastel blobs and a flat card), the glass here is a depth-ordered object. Everything is drawn in code.

## Look

- Night: `#0c0a24` to `#170f3a` diagonal, big screen-blended blobs in violet `#7a2bff`, blue `#2b6bff`, magenta `#ff2bd6`, cyan `#00d1ff` and a hot orange `#ff7a1a` (with a coral and magenta tail), pools of the night colour in two corners, a faint 72 px grid at 3.5 percent, dither noise at 5 percent, a dark vignette.
- Orbs: spheres with a 3-stop radial gradient (light, mid, dark), a bounce-coloured rim, a crisp white specular, and a soft screen-blended glow: pink `#ffd2f4 #ff4fc1 #6a1497`, blue `#c7f2ff #3aa0ff #1a2a8a`, cyan `#d6fbff #19c9ff #0b4f9a`, violet `#e8d6ff #8b4dff #2a1070`, orange `#ffe3b8 #ff8a2a #9a2f12`. The dark orb ("hardship") is `#7d70d8 #2c1b82 #0b0530`; the warm one ("ease") is `#fffbe6 #ffc15a #e8553a`.
- Glass: blurred and 150 percent saturated backdrop, a night tint at 16 percent, a white tint gradient (17 to 5 percent), frost grain at 22 percent, a diagonal sheen, a border that is brightest top left (70 percent) and a bright line along the real top edge. Behind the front face sits a back face and four side walls in pale blue so the pane has thickness.
- Type: sans (SF Pro Display or Avenir Next) 54 to 60 px white with a soft dark shadow; Arabic in Scheherazade New 116 px with a warm glow; a small pill chip with a coloured dot as a label; the citation in Menlo spaced capitals on its own small pane.

## Motion

- A camera yaw of about 4 degrees sways all the time; every orb also drifts in x, y and z on slow sines, so near and far things slide against each other.
- The hook pane scales in, and its yaw and pitch breathe. Then it turns away like a door (yaw to about 77 degrees, sliding left and back) while the verse pane swings in from the right the same way. Text lives on the pane plane and foreshortens with it.
- The blur radius falls from 46 to 15 px as the verse is written: the glass clears. The dark orb behind the pane sharpens with it.
- The warm orb travels from far behind the pane, across behind it (soft), round its top right corner and out in front of the glass (sharp), where it lights the pane edge. It never passes through the pane.
- The Arabic is written with the pen mask, right to left, body first and vowel marks fading in after the pass.

## How it explains

- Story device: One big frosted dashboard that the camera glides across panel by panel.
- Arrows and flow: Glowing gradient connector lines with travelling light dots.
- Labels and text: Glass pills as labels; big Inter 800 headlines.
- Numbers and counts: Big numbers that count up inside a glass card.
- Emphasis: The panel in focus re-frosts brighter while the others blur back.
- Scene change: The camera glides and zooms to the next panel; blobs drift behind it all.

## Build notes

- Everything in one 2D canvas, sorted far to near each frame by camera-space depth: orbs and panes in one list. A pane takes a snapshot of the canvas as it is at that moment, so it blurs exactly what is behind it, including earlier panes.
- Snapshot first, then draw the shadow. Drawing the shadow first puts a dark halo into the blurred backdrop.
- Blur at half resolution (`drawImage` the canvas into a 540 x 960 layer, then draw it back with `filter: blur(r/2) saturate(150%)`), then clip to the pane polygon. Full-resolution blur is too slow.
- A pane is a rounded rectangle sampled into 36 points, rotated (yaw, then pitch) in 3D and projected with a pinhole (`f = 1500`). The border and the clip use the projected polygon, so rounded corners are right under perspective. The side walls are quads between the front and back polygons.
- Put the text on the pane with `setTransform` from three projected corners (top left, top right, bottom left). It is an affine approximation of the perspective, and at yaw under 0.25 rad it is not visible.
- Pen reveal in pane space: clip a slanted polygon right to left inside that transform, draw the body (tashkeel stripped), then fade the full text in. Check the dot on the faa of the first word; the fatha above it can look like a second dot at small sizes.
- Gotcha: an orb must cross the pane plane outside the pane's footprint (here over its top right corner). Crossing inside the footprint pops it from blurred to sharp with no visible reason.
- Gotcha: sorting by centre depth is enough for orbs and panes that never intersect; plan the paths so they do not.
- Gotcha: a lone pill pane at y 1440 and the handle at 1500 crowd each other; fade the handle in after the pill has landed.
- Cost: about 80 ms a frame (one snapshot and blur per pane).

## Good for (examples, never limits)

Hardship that clears, clarity, a veil lifting, anything where "seeing through" is the idea (a verse about difficulty and ease, doubt and certainty), and calm modern states of mind.

## References

- `references/prompt-glassmorphism.md`. Ported from it: the layered `glass()` (shadow, blurred backdrop, tint, grain, sheen, gradient border, top highlight), the blob and orb background with dither, the chip pill and the glow. Added: true 3D panes with thickness and depth-sorted orbs.
- Related: `dreamy-aura.md` (blurred pastel blobs on a flat card).

## Working example

`assets/styles/frosted-glass.html`: a 10 s page (QURAN 94:5, "Some days you can only see the blur."). Read it for `pane()` and the depth sort; do not reuse its two-pane story as a template.
