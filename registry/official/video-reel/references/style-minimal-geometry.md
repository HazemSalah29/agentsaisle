# Style: minimal geometry

Ideas told with a handful of plain shapes on black. Calm, clever, very readable at thumbnail size.

## Look

- Ground: pure black `#000`. Ink: white. No accent colour; brightness is the accent (a glowing white ball).
- Type: a light geometric sans (Avenir Next, Poppins), lowercase, small (34-40 px), centred. One caption line above the shape, an optional second line below it.
- Shapes: 2-3 px white strokes, no fill, or solid white for "the thing that matters". Dotted strokes for "not yet" or "possible".

## Motion

- A shape draws itself (`stroke-dasharray` from full length to 0), then morphs into the next idea: circle to square to triangle to line.
- "You" is a small white ball with a soft glow. It rolls, falls, orbits, gets caught in a shape.
- A small hand-cursor icon drags, taps and draws things, as if someone is explaining on a whiteboard.
- One shape on screen at a time. Cut on the caption change.

## How it explains

- Story device: One white shape at a time on black, morphing from idea to idea, with a glowing ball as the person.
- Arrows and flow: A drawn line that traces itself with a small hand cursor, ending in a plain open arrowhead.
- Labels and text: One lowercase caption line above the shape; nothing else on screen.
- Numbers and counts: Count with dots or short ticks that appear one by one on the shape.
- Emphasis: Brightness is the emphasis: one solid white shape or a glow among thin outlines.
- Scene change: Cut on the caption change; the old shape redraws backwards, the new one draws itself.

## Build notes

- SVG in one `<svg viewBox="0 0 1080 1920">`. Morph between shapes by drawing all as paths with the same number of points and interpolating the points, or crossfade with a scale.
- Glow: a white circle plus a blurred copy (`filter: blur(18px)`) at 60 % opacity.
- Sound: `plink` when the ball lands, `tap` on each caption change, soft `tick` when a dotted line appears.

## Good for (examples, never limits)

Abstract ideas: habits, intention, how small acts compound, before/after of the heart.

## Working example

`assets/styles/minimal-geometry.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
