# Style: line-art story

**Production readiness:** needs work (the world is a small frame in the top half with empty space below; figures swap poses with no in-betweens; no depth or camera)

Daily life drawn in warm hairlines: a room, a bed, a lamp, a window, a person. Clear, gentle, easy to follow over a long reel. The same lines also draw wide places and objects with no people: a cave, hills, a city, a rolling coin (walyatalattaf reel, 2026-10-23, olive palette).

## Look

- Ground: near-black warm `#100d0a`.
- Lines: warm off-white `#e9e2d4`, 2-3 px, round caps. No fills except glows.
- One accent: lamp orange `#e58a3a`, for what is live (a lamp, knots, a lit window, the key words of the caption).
- Scenes sit inside thin framed panels with a small mono label in the corner ("WITH TAHAJJUD", "WITHOUT").
- A small clock dial beside the caption shows the time passing; the caption is a short sans line (Avenir Next) with the key phrase in orange. A tiny handle at the bottom.
- Later beats can drop the panel and go full frame: a mosque, an arched door, a moon.
- A place can be the whole scene: a landscape drawn on in line art, a dawn glow, windows that light one by one.

## Motion

- Weight: figures are light line drawings, so `zeta` 0.8 to 1 on the pose change, no bounce. Small objects (knots, stars, a coin) can use `zeta` 0.5 as they drop and settle.
- Camera: a locked, fixed view is the base. A slow push-in toward the thing that matters is allowed, and a pan from room to room follows the line of the wall. It never shakes and never tilts.
- Enter: a line draws itself on (dash offset), then its fill or glow arrives after. Leave: the line fades while it shortens, so the drawing seems to be rubbed out, not cut.
- Natural transformations: the window sky going night blue to dawn orange, the clock hand turning, a figure moving through a few poses with a short crossfade, a lamp glow breathing, a room redrawn as a street by lines morphing.
- Transitions: a wipe along the floor line where the next place draws itself in; the window becomes the next scene; the clock runs on and the room changes with the time.
- Timing feel: even and gentle, about 0.5 to 0.8 s per change, readable at a glance. Hold each pose at least 0.6 s.
- What never moves: the floor line, the furniture, the type. Only the thing the story is about, the light and the hands of the clock.
- Limit to know: add in-between poses, use the full 9:16 height (the sample leaves the lower half empty), and give the room a second plane of depth before it carries a long reel.

## How it explains

- Story device: A small story in line art: two lives compared, with a clock showing the time.
- Arrows and flow: Thin curved lines or a lamp-orange trail that guides the eye.
- Labels and text: A short Avenir Next caption; mono labels in the corner of each panel.
- Numbers and counts: A clock hand turns and a small tally fills.
- Emphasis: Lamp orange on whatever is live: lamp, window, key words.
- Scene change: Crossfade between a few poses; the panel drops and goes full frame.

## Build notes

- Draw everything as SVG paths with `vector-effect: non-scaling-stroke`. Keep figures to about 6 strokes each (head circle, body, arms, legs).
- Poses: one `<g>` per pose; crossfade by opacity.
- Glow: radial gradient circles in the accent at 20-40 % opacity.
- Sound: `tick` for the clock, `plink` for something lighting, `tap` for captions.

## Good for (examples, never limits)

Daily acts, routines, two ways of living, any hadith about time of day. Stories set in a place (a cave, a city, a journey).

## Working example

`assets/styles/line-art-story.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
