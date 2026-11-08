# Style: layered paper diorama

**Production readiness:** needs work (no camera moves through the layers, so depth only shows in a slow hill drift; text strips flatten to grey while they fade; stop-motion 12 fps is only partly applied; scene range beyond a night hill stage is unproven)

Stacked paper cut-out layers with soft shadows, grain and slightly wobbly cut edges, like a shadow box built from coloured card. Seen as a trend in paper-cutout animation (Jake Bartlett's Skillshare paper cutout class, Ben Marriott's paper cutout pack, atlabs paper-cutout notes). Warm, tactile, calm.

## Look

- Night sheet `#1f3f46` as the back wall, a cream paper crescent and a few diamond stars.
- Five hill layers in teal `#2f5d62`, sage `#6f9a85`, mustard `#e0a93b`, terracotta `#c8553d`, deep red `#7a2f27`, each with its own shadow so they read as stacked card.
- Text sits on torn cream or mustard paper strips, slightly rotated, Baskerville in ink brown `#3a2a22`. A mono handle at the bottom.
- Props are paper too: a three-ring paper sun, flowers made of a stem strip, a leaf and two circles.
- A full-frame grain overlay (multiply) ties it into one sheet.

## Motion

- Weight: card is light but not floaty. Strips and tiles land with `zeta` 0.6 to 0.75 (one small settle, a 2 to 4 px overshoot), the shadow tightening as they land. A big sheet (a sun, a hill) lands heavier at `zeta` 0.85 and slides in with a shadow that grows.
- Time is quantised to 12 fps (`q(t)`) for props and strips, so it reads as stop-motion. Camera and parallax stay smooth, because a real rig moves smoothly.
- Camera: a slow dolly through the layers, near layers moving fastest (about 1.0), middle 0.5, far 0.2, with a little slide and push. It can pan to the next set. It never tilts, never rotates, never uses a depth blur; depth is sharp cards with growing shadows.
- Entering: strips drop in from 40 px below or slide from a side, props pop up from behind a hill edge. Leaving: strips drop out downward with a shorter ease-in, props are pulled back behind a layer.
- Transformations: a card layer slides away to reveal another behind it, a strip is replaced by a bigger one with a shadow that deepens, a prop is swapped on a hand-moved frame (cut, not morph).
- Transitions: 1) a paper layer lifts and slides off to reveal the next set behind it, 2) the whole world slides sideways on the rig to a new stage while the hills keep parallaxing, 3) a curtain of hill strips rises from the bottom and covers the stage, then drops to show the next.
- Timing feel: stop-motion, each move is 6 to 10 stepped frames at 12 fps; holds are long (0.6 s or more) because the physical set is still. Stars twinkle slowly, flowers sway a few pixels on two-frame steps.
- Never moves: the grain, the back wall, and the shadow direction (always from the top left).

## How it explains

- Story device: A stage of stacked paper layers, like a small theatre; the idea plays out in front of the hills.
- Arrows and flow: A paper strip or a row of paper dots across the layers, with a small cut arrowhead.
- Labels and text: Words on a torn cream or mustard strip, slightly tilted, in a serif.
- Numbers and counts: Count by dropping one paper tile into a lane at a time.
- Emphasis: The key strip is the mustard one, bigger and dropped in last with a small overshoot.
- Scene change: Strips drop out and new ones come in; the hills only drift, so the world stays.

## Build notes

- Wobbly edges: `feTurbulence` (baseFrequency .02, seed fixed) feeding `feDisplacementMap` scale 9-12, then `feDropShadow` in the same filter. Three filters: small props (shadow 3 px), strips (5 px), big sheets (12 px).
- Apply the filter per shape group, not on the whole scene, or the displacement tears text.
- Text is drawn outside the filter so it stays crisp.
- Render cost: about 3.5 min for 300 frames with all the filters live (about 0.7 s per frame). Fine, but do not add more than 3 or 4 filtered groups per prop.
- Seeded PRNG for stars and hill shapes; no Math.random.
- Sound: `tap` on each strip, `slide` for the scene change, `thud` for the big sun, `tick` plus `plink` per daily flower.

## Good for (examples, never limits)

Nature, creation, journeys, patience, steady habits, nights, anything gentle.

## References

- https://www.skillshare.com (Jake Bartlett, paper cutout animation class) unverified
- https://gumroad.com (Ben Marriott, paper cutout pack) unverified
- https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap (edge wobble)

## Working example

`assets/styles/paper-diorama.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
