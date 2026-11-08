# Style: cinematic

**Production readiness:** needs work (the demo's camera drift and light movement are close to invisible across 3 s; type is small for a phone; only one skyline setting proven)

A film-like world built from flat layers: sky, silhouettes, ground, light. Strong for the unseen (the grave, the night, the hereafter).

## Look

- Layers, back to front: a gradient sky (dusk violet to amber, or deep night blue), stars, a crescent moon with glow, silhouettes (trees, tombstones, minarets, a city skyline), the ground, then a cut-away under the ground if the story goes there.
- Figures are flat glowing white silhouettes, no faces.
- Light carries meaning: blue pillars for angels, a warm shaft from above, green rays for Paradise, red-orange for the Fire. The palette shifts with the mood of each beat.
- Type: a serif, white, centred near the top, 44-52 px. Arabic in gold. The reference small and spaced. A tiny handle at the bottom of every frame.

## Motion

- Weight: heavy and slow. Moving things (a figure's lantern, a door of light) use `zeta` 0.85 to 1, no bounce. Light swells with an ease-in-out, never a pop.
- Camera: every scene has one, never a locked frame. Push in 5 to 8 percent, a slow pan along the skyline, a crane up to the sky, with near layers moving faster than far ones. It never shakes, never whips for no reason, and never uses a depth blur: depth is sharp layers, a near dark frame, a haze band.
- Entering: things are revealed by light reaching them (a shaft lands on a tombstone, a window warms), or by rising into a layer from below the horizon. Leaving: they sink into darkness as the light moves away. Nothing fades in at full flat opacity.
- Transformations: the grade shifts (violet dusk to deep night, a warm shaft to a cold one) over about 1 s; a point of light grows into a pillar; a single window becomes a city of windows.
- Transitions: 1) a slow crane or pan carries the camera to the next place in the same world, 2) the light dims to near black and the next place rises into the same gradient, 3) a whip pan of two scenes side by side only for a big change, with a directional blur drawn only while it moves.
- Timing feel: slow and grave. A move is 0.8 to 1.2 s, light changes take 1 to 2 s, dust drifts at about 10 px a second. Text arrives with a masked rise, never a fade.
- Never moves: the stars (except a slow twinkle), the silhouettes' shapes, and the grain's strength; the vignette stays put.

## How it explains

- Story device: One continuous scene told by light and sky, changing mood beat by beat.
- Arrows and flow: Shafts and pillars of light show the direction of travel.
- Labels and text: A centred serif line near the top; Arabic in gold.
- Numbers and counts: Numbers are rare; show a count as a row of lit things, not digits.
- Emphasis: Light swells, flickers or sweeps onto the thing that matters.
- Scene change: The grade crossfades over about a second while the camera keeps drifting.

## Build notes

- Sky: CSS gradients on stacked divs; crossfade by opacity.
- Silhouettes: SVG paths filled near-black; parallax by `translateX` scaled per layer.
- Glow: radial gradients and `filter: blur()`. Light shafts: a tall gradient rectangle with `mix-blend-mode: screen`.
- Grain: canvas noise redrawn from a seed of `floor(t * 12)`, 5-8 % opacity.
- Sound: low `bong` on reveals, `drop` on text, a low wind or night bed carries more weight here (never a hum).

## Good for (examples, never limits)

The grave, the night prayer, the Day of Judgement, stories of the Prophets told through places and light only (chain.md rule 7: no prophet or companion is ever drawn, not even as a silhouette). Can feel heavy for light, everyday topics.

## Working example

`assets/styles/cinematic.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
