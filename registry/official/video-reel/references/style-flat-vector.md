# Style: flat vector explainer (faceless)

The explainer-channel look (Kurzgesagt-style): rounded flat shapes, saturated colour on deep indigo, faceless capsule people, everything popping in with a little overshoot. Seen on science explainer channels; the notes for this family were mostly from model knowledge, so treat the sources below as unverified craft notes. Do not copy any channel's actual characters.

## Look

- Ground: indigo gradient `#34329a` to `#1f1e6a`, with slow drifting specks in teal, yellow and coral.
- Palette of 3-4 saturated colours: yellow `#ffc21f`, teal `#18c5ae`, coral `#ff6a5b`, plus indigo greys for "spent" things.
- Every shape has three tones: base, a lighter top highlight (a smaller shape inset up-left) and a hard dark shadow offset down-right (6, 10 px), no blur.
- People are capsules: a body pill, a ball head, two arm pills, two small feet. No face, no features.
- Panels are rounded slabs (`rx 44`) with their own hard shadow and a small caps label at the bottom.
- Text: Avenir Next 800, white, with a hard 6 px dark text-shadow; key phrase in yellow.

## Motion

- Everything pops in with easeOutBack (`1 + c3*(x-1)^3 + c1*(x-1)^2`), staggered 0.3-0.5 s.
- Gentle loops fill dead time: figures bob with `sin(t*5)`, hearts rock a few degrees, specks drift.
- A spent object dims to grey-indigo and shrinks a little; a continuing one keeps popping and a connecting bar grows.
- Panels slide up 60 px while fading in.
- Path morphs (same point count, lerp) fit here for a heart turning into a block; not used in the sample.

## How it explains

- Story device: Bold flat shapes with hard shadows act the idea out; no faces.
- Arrows and flow: Bars and links that grow between shapes; straight chunky arrows.
- Labels and text: Avenir Next 800, white with a hard shadow; key phrase in yellow.
- Numbers and counts: Counts as stacked blocks or a growing bar.
- Emphasis: A pop with overshoot; spent things dim to grey-indigo.
- Scene change: Panels slide up 60 px while fading in; the old panel shrinks away.

## Build notes

- Helpers `circ`, `cap` (capsule), `heart` each emit shadow, base and highlight in one `<g>` with a scale, so a pop is one number.
- Faceless pose set is tiny: stand, lift (arms tilted up), lie (body rotated flat). Swap by condition, no crossfade needed.
- Pure SVG, innerHTML each frame: 300 frames rendered in about 2 min; cost is low.
- Specks use a seeded PRNG and `sin`/`cos` of t, so `frame(t)` stays pure.
- The prophet salutation glyph needs Scheherazade New (`assets/ScheherazadeNew-Regular.ttf`, copied next to the page, relative `@font-face`); Avenir Next draws it tiny.
- Keep text above the panels; panels carry no text beyond the small label.

## Good for (examples, never limits)

Abstract ideas shown as objects: spread of giving, a deed continuing vs stopping, growth, charity, community, a heart. Good for "small and steady vs big and once" comparisons.

## References

- Skillshare Kurzgesagt course (craft notes on flat shapes and palette), found in the scout notes.
- Kurzgesagt YouTube channel (motion language, pops and loops), unverified.
- easings.net easeOutBack formula, unverified for this recipe.

## Working example

`assets/styles/flat-vector.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template. It loads `ScheherazadeNew-Regular.ttf` from its own folder.
