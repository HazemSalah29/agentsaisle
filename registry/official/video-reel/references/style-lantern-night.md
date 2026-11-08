# Style: Lantern night

**Production readiness:** needs work (one lantern on a flat sky; the drifting soft discs are a blur-style depth that look.md rejects; no second place, no near frame or far plane)

One warm lantern hanging in a dark blue night, soft out-of-focus lights drifting behind it, and a few small moths of light circling the flame. Seen as a stock-motion and photography genre (floating lanterns, temple lanterns, bokeh at dusk; see References), rebuilt here from canvas gradients. Quiet, intimate, a little devotional.

## Look

- Ground: a vertical gradient from `#070d1f` through `#0d1b3a` to `#080f22`. Never pure black; the blue is what makes the amber read as warm.
- Lantern: dark metal ribs `#150f20` over a glass body that glows from pale flame `#ffe3a8` through amber `#ffb347` to a deep rust edge. A hanging cord from off the top edge.
- Bokeh: about 48 discs, 30-115 px radius, amber / ember / pale gold with one violet in seven. Each disc has a brighter rim than centre (the rim is what reads as bokeh, not a flat circle).
- Moths of light: 7 specks with short fading trails, orbiting the lantern.
- Type: Baskerville cream `#f6e9cf` for hook lines (one line in gold `#ffd98a`), Scheherazade New in pale flame with a warm glow for the Arabic, Menlo spaced capitals for the citation in amber.

## Motion

- Weight: the lantern hangs on a cord, so it swings like a pendulum (about 0.03 rad, damped, `zeta` 0.15 to 0.3 at the pivot) and settles. Light things (moths, sparks) use `zeta` 0.5, and text uses `zeta` 1.
- Camera: a slow drift or push toward the flame, a few percent over a beat. It can rise to follow smoke or sparks, and it travels with the light from one lantern to the next. It never whips, and it never rack-focuses (no depth-of-field).
- Enter: the lantern is dim, a tap or a match, then the flame catches and `L` ramps over about 1.1 s while the whole sky warms with it. Moths drift in from the dark edge. Leave: the flame gutters and fades, and the sky cools back to blue.
- Natural transformations: dark to lit, one flame lighting a second lantern, a lantern shrinking to a distant point of light, light spilling into a window.
- Transitions: the flame brightens until the frame is warm and the next scene resolves out of that glow; the camera follows a rising spark up to a new scene; a lantern is blown out and the next place lights from its own source.
- Timing feel: quiet and slow. Flicker is a sum of three sines at unrelated rates (13, 23.7, 7.3 rad/s), never one sine. Holds are long (1 to 2 s).
- What never moves: the horizon, the stars and the type. The glow breathes, but the lantern's position is settled between swings.
- Limit to know: replace the soft discs with sharp planes (a near dark frame with a gold rim, a far haze band) and give the world more than one object before it carries a long reel. Cinema night in look.md shows how.

## How it explains

- Story device: A lantern lit in the night; the warmth of the sky follows the flame.
- Arrows and flow: None; moths of light and drifting bokeh carry the eye.
- Labels and text: Baskerville cream hook lines; Arabic written right to left in pale flame.
- Numbers and counts: Rarely used; keep to one number if the story needs it.
- Emphasis: The flame flares or a moth settles on the key word.
- Scene change: The light warms the whole sky; one line fades out as the next rises in.

## Build notes

- One canvas for the whole scene, text in DOM above it. `frame(t)` redraws everything from `t` and a seeded hash `H`; no state is carried.
- Bokeh and halos use `globalCompositeOperation='lighter'`. Draw the lantern body first, then the ribs over it, then the additive halo last, otherwise the ribs look pasted on.
- Gotcha: the Arabic uses a CSS `mask-image` for the right-to-left write-on. A mask clips the `text-shadow` glow to the element box and leaves a visible lighter rectangle after the reveal. Set the mask to `none` once the reveal finishes.
- Gotcha: bokeh at full alpha competes with the text. Keep disc alpha under about 0.22 and let the vignette darken the edges.
- Keep the lantern above y 850 so the text block (y 880-1450) sits on calm sky.
- Not built: dots and vowel marks written last (the full pen-stroke recipe). The mask edge is the simple version.

## Good for (examples, never limits)

Remembrance, comfort, nights, fear and calm, hope, the Qur'an 13:28 type of verse, anything about a small light in a heavy dark.

## References

- https://elements.envato.com/glowing-lanterns-background-RPE3T8A - warm lanterns on deep blue (from search, not opened)
- https://elements.envato.com/temple-lantern-lights-GMNEA73 - irregular warm flicker (from search, not opened)
- https://elements.envato.com/dream-light-5AL7U29 - floating lanterns, soft bokeh behind (from search, not opened)
- https://dribbble.com/Wutip/tags/bokeh - bokeh and light-leak backgrounds as a motion genre (opened, text only)
- Pinterest search for lantern night bokeh: fetch blocked, nothing seen

## Working example

`assets/styles/lantern-night.html`: a 10 s page in this style with QURAN 13:28. Read it for the techniques; do not reuse its layout as a template.

The methods of the strongest reel in this family are written up in [look.md, "Cinema night"](look.md).
