# Style: pastel cinema

Soft pastel colours lit like a film.

## Look

- Palette (sampled): sky `#DAE6E8`, sea `#C1D4D4`, sand `#ECDFC3`, blush `#F0DDDD`, lavender `#DDD9E4`, cream `#EEE5DA`, sage `#D9E1CC`, gold `#C5A870`, ink `#5A4A2C`. Navy `#1E2A44` only as a small accent.
- One warm key light (a low sun or a lamp) in a soft pastel world. Atmospheric haze in layers: far hills and trees fade into the sky.
- Light shafts through an opening, with dust drifting inside them. A pool of light on the floor.
- Depth: a sharp middle, a large blurred object close to the camera, a cool lavender multiply in the corners, warm soft-light bounce near the source.
- Type: Arabic in Scheherazade New, ink brown. English in Cormorant Garamond italic, 52 px. Citation in Manrope 700, spaced capitals, dark gold. Text sits on a soft glow on the wall, never on a card.
- Grain about 7 % and a warm vignette on every frame.

## Motion

- A slow push-in (scale 1.00 to 1.04 over the shot), centred low.
- Dust drifts up and sideways in the shafts; the shafts sway a little.
- A flame flickers; the sun rises a few pixels.
- Text arrives in steps: Arabic, then English, then the citation, each fading in over about 1 s.

## How it explains

- Story device: one lit place per beat (a room, a courtyard, a shore); the light tells you where to look.
- Arrows and flow: the light shafts and the direction of the dust.
- Labels and text: centred near the top, on the wall's glow.
- Numbers and counts: a row of lit objects (lamps, fruit, windows), not digits.
- Emphasis: the key light swells on the thing that matters; the rest falls into haze.
- Scene change: walk the camera through the opening into the next place, or let the haze rise and clear.

## Build notes

- One canvas. Draw back to front: sky, sun glow, hills with blur, haze band, the wall with the opening cut out (`evenodd`), reveal depth, floor, shafts (`screen`, `blur`), objects, the blurred foreground object, the corner multiply, then grain and vignette.
- All randomness is seeded; grain uses `floor(t*24)` as its seed.
- Sound: a birds or breeze bed (`bed.txt`), a soft `bong` on the first reveal, a quiet `drop` on each text step.
- Working page: `assets/styles/pastel-cinema.html`.

## Good for (examples, never limits)

Qur'an stories told through places (Maryam's room, a town by the sea, a garden), calm reflections, provision and mercy. Any topic can use it.
