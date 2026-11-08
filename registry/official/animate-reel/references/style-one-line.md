# Style: one line

Craft borrowed from the MIT "ink-line" style in the cv2 repo (one brush line that never lifts and quietly turns into the next thing). Here the line is drawn light on a dark night ground, and it is the only motif: the whole reel is one stroke that becomes the next thing. It is not sumi-e-wash (no paper, no wash, no ink bleed) and not line-art-story (no rooms, no poses, no panels, no swapped drawings). Nothing is ever redrawn or crossfaded: the same stroke is pulled into a new shape.

## Look

- Ground: deep night blue `#0d121a`, a soft lift to `#1a2433` in the middle, a dark vignette at the edges. A seeded film grain at about 7 % and a few dozen faint stars for texture on every frame.
- The line: warm off-white `#efe8d8`, about 9 px, a ribbon that swells and thins like a brush and starts thin. A wide low-opacity halo under it (two stacked translucent strokes, never a blur).
- One accent: amber `#f0b35a`, spent only on what is lit: a night that was kept, the bud at the end, the key line of the caption.
- The pen tip is a small bright bead with a soft halo while it draws.
- Type: Baskerville serif for captions (66 to 84 px), Avenir Next 600 spaced capitals for the citation and handle (40 px). Soft dark backing glow behind every caption block.
- Almost empty frame. The line and a few lit dots are all there is. No people, no panels, no frames, no logo or seal.

## Motion

- The line never lifts and never cuts. It is one polyline built once, and the pen reveals it by arc length. Each shape (a crescent, a peak, a row of arches, a stem and leaves) is just the next stretch of the same path.
- The camera follows the pen with a short look-ahead (average the tip position over a window of about 1.2 s), then pulls back at the end to show the whole life at once.
- Each stretch has its own time window. Speed is mostly linear with a little ease, so the pen never stops dead at a join (it slows slightly).
- Lit dots sit on the line: the moment the tip passes a mark, a dot glows on over 0.35 s. The big deed's dot is lit once, then cools to a dim cream ring; the small nights stay lit and add up.
- A tiny line boil: the edge wobbles about 1 px and re-rolls every second frame (15 fps feel on a 30 fps page).
- A closing beat: the stem curls into a small bud that lights amber.

Easing (numbers)
- draw (pen along the path): 65 % linear plus 35 % smoothstep per stretch, so speed is never zero at a join.
- stretch lengths: crescent 1.4 s outline plus 0.6 s return, tail to ground 0.8 s, big peak 1.8 s, each small arch 0.3 s, stem 0.45 s, each leaf 0.35 s, bud curl 0.45 s.
- lit dot: ease-out cubic, 0.35 s. Cooling of the big deed's dot: ease-out cubic, 0.7 s, starting 0.5 s after it lit.
- camera follow: moving average of the tip over -0.6 to +0.6 s, look-ahead of 100 px fading in 2.5 to 3.5 s.
- pull back: in-out cubic, 2.2 s, zoom 1 to 0.58.
- caption in: ease-out cubic, 0.6 s with a 14 px rise. Caption out: ease-out cubic, 0.45 s.

## How it explains

- Story device: one thing becoming the next, drawn by the same stroke. A night becomes a ground, the ground rises into the biggest deed, falls back, then carries on as small even steps, then stands up as a sprout. The picture is the lesson: the tall peak is brief, the small steps are what grow.
- Arrows and flow: the line itself is the arrow. Direction is the pen.
- Labels and text: short captions only, 64 px and up. The lit dots count the nights without a number.
- Numbers and counts: lit dots in a row (seven here), each lit as the pen passes.
- Emphasis: amber only. One thing is amber at a time per idea.
- Scene change: there is none. Where another recipe cuts, this one turns the line: crescent into ground, ground into peak, arches into stem.

## Build notes

- Build the path once at load from small helpers (`bez`, `arc`, a sine bump), push marks for every point that should light, then resample to a fixed 4 px step. `frame(t)` only reads it, so it stays a pure function of `t`.
- Time to arc length: give every stretch a window `[t0, t1]` and the arc length it covers; map time inside it with a mix of linear and smoothstep. Windows must touch, so the pen never rests.
- Draw the visible part as a ribbon polygon (offset each point along its normal by half the width) plus two wide translucent polylines for the halo. Add a seeded wobble: `hash(i, floor(t*15))`, never `Math.random`.
- Find when a mark lights by scanning `tipS(t)` once at load, not per frame.
- Pull back by scaling the world about the ground line and blending the camera towards the centre of the whole drawing. Keep line width in world units so it thins gently, never below about 4 px.
- Do not use a global named `top`, `name`, `status` or `length` for path variables: `const top` fails with a redeclaration error and the page never becomes ready.
- No blur or depth of field, anywhere (the user rejected it). Glow is radial gradients and stacked translucent strokes.
- Sound: sparse. A soft `tap` as the first caption lands, one `plink` as the big deed lights, one `tap` as the small nights begin, one `plink` as the bud lights. No sound for drawing.

## Good for (examples, never limits)

Any hadith or ayah about one thing becoming another or one deed carried through time: a seed to a tree, a drop to a river, a night to a dawn, a small steady deed against a big one-off effort (Bukhari 6464). Good for calm, reflective reels.

## Working example

`assets/styles/one-line.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464): a crescent night turns into one tall peak, falls back, carries on as seven small lit nights, and stands up as a sprout with a lit bud. Read it for the techniques; do not reuse its path as a template, because each reel's story needs its own shapes.
