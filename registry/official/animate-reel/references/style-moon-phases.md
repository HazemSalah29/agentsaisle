# Style: Moon phases

**Production readiness:** demo only (one moon centred on a plain sky; the discs and bead are a fixed diagram; craters read as grey blobs; no places, objects or people)

A night sky with one large moon that grows from new to full, a row of eight small phase discs above it that light up as the cycle passes, a thin gold hairline that traces the orbit with a bead, stars, and a low horizon. Phase geometry follows the usual lit-half-plus-or-minus-an-ellipse construction (see the NASA loop in References). It fits the Hijri month naturally.

## Look

- Sky: gradient `#050a18` to `#0a1430` to `#0e1a3a`; about 150 stars `#dfe6ff`, 0.6-2 px, each twinkling at its own rate.
- Moon: cream `#f1ead2` with a gradient toward `#d9d0b2`, faint maria blotches, an unlit part in `#141c38` (earthshine) with a hairline rim, and a soft blue halo `#9fb0d8` that grows with the lit fraction.
- Phase row: 8 discs, passed phases at full brightness, future ones dim, the current one ringed in gold `#d6a84f`.
- Orbit hairline: gold ring around the moon, drawn up to the current phase, a glowing bead at its end.
- Horizon: a dark hill strip `#02050d` with a faint blue glow behind it.
- Type: Baskerville cream hook lines (second in `#9fb0d8`), Scheherazade New cream with a blue glow for the Arabic, gold Menlo for the citation.

## Motion

- Weight: celestial and calm. The moon is lit by a phase ease in-out (`zeta` 1), the bead on the ring uses the same curve, and the small phase discs light with a short pop. Nothing bounces.
- Camera: a very slow push toward the moon, or a slow vertical tilt from horizon to sky as it rises. It never whips, and it never moves faster than the phase.
- Enter: stars fade in over about 1.2 s, a thin crescent appears, the phase runs from new to full over about 4 s. Leave: the moon wanes, or the sky lightens toward dawn and the stars go.
- Natural transformations: new moon to full moon by a terminator moving across the disc, the moon rising from the horizon, the bead tracing the orbit, the sky warming at the horizon line.
- Transitions: the phase runs on until the moon fills the frame, then the next scene opens from its light; the moon sets and sunrise takes the same horizon; the camera tilts down from the moon to the place below it.
- Timing feel: patient, one slow gesture at a time. After full the moon breathes about 1 percent. Holds are 0.8 s or more.
- What never moves: the horizon line, the star field's positions, the type. Only the phase, the ring bead and a faint twinkle move.
- Limit to know: this is one idea (waxing, a month passing). Lay it over a real place or add a near frame and a second subject before a full story reel.

## How it explains

- Story device: The story is time: one moon moving through its phases while the idea changes with it.
- Arrows and flow: A gold orbit hairline that draws itself with a glowing bead at the tip, showing the way ahead.
- Labels and text: Cream serif hook lines over the sky, then the Arabic written in below.
- Numbers and counts: The row of eight phase discs is the counter: passed ones bright, future ones dim.
- Emphasis: A gold ring around the current phase disc, and the moon filling to full with a soft boom.
- Scene change: The sky never cuts; the hook fades, the moon's phase carries the change, then the Arabic arrives.

## Build notes

- Phase `p` in [0,1): 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. Waxing lights the right side. Lit path: a half circle on the lit side, then an ellipse of x-radius `abs(cos(2 pi p)) * r` back to the start; the ellipse direction flips at p = 0.25 (cos sign) so it bulges outward for gibbous and inward for crescent. `Path2D.ellipse` with the `anticlockwise` flag set from the sign of the cosine.
- Fill the lit path with a clipped gradient and draw the maria inside the same clip so they do not leak onto the dark part.
- Draw the horizon glow before the hills, otherwise a lighter rectangle shows on top of them.
- Keep the gold bead away from the text block: ring radius 270 leaves a gap above y 930.
- Gotcha: if Arabic uses a mask for the write-on, clear it when finished (it clips the glow).
- Keep stars clear of nothing in particular; they sit under the text at low alpha and do not hurt reading.

## Good for (examples, never limits)

Months, time passing, growth after hardship, patience (QURAN 94:5), Ramadan and Hijri dates, waiting for light.

## References

- https://svs.gsfc.nasa.gov/4310/ - NASA SVS Moon Phases Loop (Ernie Wright): full cycle, quarter and gibbous timing (opened)
- https://www.storyblocks.com/motion-graphics/search/moon-phases - looping moon-phase graphics, moon as progress indicator (from search, not opened)
- https://wallpapers.com/moon-aesthetic-pictures - phase rows on starry blue, gold line-art moons (from search, not opened)
- https://earthsky.org/?p=159794 - timelapse from thin crescent to full (from search, not opened)
- Pinterest search for moon phases night sky: fetch blocked, nothing seen

## Working example

`assets/styles/moon-phases.html`: a 10 s page in this style with QURAN 94:5. Read it for the techniques; do not reuse its layout as a template.
