# Style: Ink in water (domain-warped dye)

**Production readiness:** demo only (one soft blob; cannot draw objects, places or people; no camera or scene range)

A dark teal pool with amber and rose dye blooming and curling through it, drawn by one WebGL fragment shader (nested fbm domain warp, time inside the warp). Technique from Inigo Quilez's warp article and The Book of Shaders ch. 13; the look is the common "ink drop" screensaver aesthetic, grain and a thin serif on top. No named reel; from the nature family scout notes.

## Look

- Deep blue-teal water (#03121a to #083a44), never pure black. Dye in amber (#f2a033) shading to rose (#d94870).
- Soft, smoky edges with curling filaments, not hard blobs. Film grain over everything.
- Type: Baskerville, cream, centred near the top, 52 px. Second line in amber italic. Small spaced handle at the bottom.

## Motion

- Weight: dye has no spring. Growth is `1 - exp(-age * k)` (fast then slow), the equivalent of `zeta` 1, never a bounce. Type that rides on it enters with `zeta` 1.
- Camera: a slow push or a slow drift across the pool, a few percent over the whole beat. It never whips, never cuts hard, and never rotates.
- Enter: a drop appears at a point and blooms outward, its edge fraying as the warp field carries it. Leave: it thins by decay (`exp(-age * 0.55)`) until almost nothing, or a bigger bloom swallows it.
- Natural transformations: one colour bleeding into another where two drops meet, a bloom pulling into a filament, a pool filling with tint by persistence (many small drops that barely decay, each adding colour).
- Transitions: the old bloom thins while a new drop starts at a new point (the dye is the cut); a bloom grows until it floods the frame and the next scene is the clear water that follows; a filament drags across and carries the eye to the next place.
- Timing feel: slow and smoky. A bloom needs 1.5 to 2.5 s to read, and a held bloom keeps curling on `t`, never frozen.
- What never moves: the type (settled, in place), the handle, the vignette. Grain is the only fast thing.
- Limit to know: dye is soft, so it carries mood, spread, mixing and filling. Put hard objects, places and people in a different style, or lay a sharp silhouette over the dye.

## How it explains

- Story device: Dye dropped into water: each drop is one idea, each bloom a result.
- Arrows and flow: A curling filament or a current that carries the dye along.
- Labels and text: Baskerville in cream near the top; the second line in amber italic.
- Numbers and counts: The pool filling with colour is the count; no digits.
- Emphasis: A bright amber drop right on the key word.
- Scene change: The dye blooms and thins out, and a new drop starts a new beat.

## Build notes

- Shader: `q = fbm(p*2.6 + t*.05)`, `r = fbm(p*2.6 + 3q + t*.07)`, `f = fbm(p*2.2 + 3.2r)`. Drop mask is `smoothstep(rad, rad*.25, dist)` where `dist` is warped by `r` and `q`, scaled by growth, so the edge frays as it spreads. Colour mixes amber to rose by `r.x`.
- Pass drops as a `uniform vec4 D[10]` (x, y, age, weight) computed in JS from `t`, so `frame(t)` stays pure. Hash noise only, no Math.random.
- Several panels from one shader: branch on pixel region, and use `gl.scissor` plus one draw per panel with its own uniforms. Clear the whole canvas first each frame, because `preserveDrawingBuffer: true` keeps old pixels.
- Four fbm octaves, three warp layers, full 1080x1920: about 1 s per frame while 17 other builders were rendering (300 frames in about 5 min with encode). Under the 3 s limit, so no downscale was needed. If a slower machine hits it, render at half size and CSS-scale the canvas.
- Text is DOM over the canvas with a dark text-shadow; scene A has a radial vignette so the drop does not fight the type.
- Sound: `bong` at the start and at the scene cut, `drop` as the dye lands, `plink` per daily drop, `bell` at the resolve.

## Good for (examples, never limits)

Knowledge or good deeds spreading, a small act colouring a whole life, sin spreading and repentance clearing it, ideas about steady versus one-off effort.

## References

- https://iquilezles.org/articles/warp (domain warping; unverified, from scout notes)
- https://thebookofshaders.com/13/ (fbm; unverified)
- gamedev.net shaderlab "domain warped noise" thread (unverified)

## Working example

`assets/styles/ink-in-water.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
