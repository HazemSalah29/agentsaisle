# Style: Impasto (palette knife)

**Production readiness:** needs work (the room, the raking light, the grey-to-colour knife sweep and the one coloured flame hold up; a big code-built figure still reads as stacked boards, because knife strokes have square ends: keep figures small, or solve the figure first)

A moving oil painting laid with a palette knife: big flat planes of thick paint with a ridge where the blade pressed, lit by a raking light so every ridge shows. Clear like a children's book at phone size, tactile at full size. Adapted from an MIT-licensed palette-knife engine. The engine is copied into `assets/impasto/` (`impasto.js` renderer, `plate.js` reference to strokes, `LICENSE`). Working page: `assets/styles/impasto.html` (a man prays before fajr in a grey room, the flame is the one colour, then the knife re-lays colour from the window and he bows).

## Look

- **Value first.** Draw each set as a flat, value-planned illustration in Canvas 2D (`new Ref(W, H, .5)`, `ref.fill(path, colour, {dir, maxR, group})`), with at least 3 clear values, then `paintRef(ref, {seed, rev})` turns it into knife strokes once, coarse to fine. If the flat drawing does not read at 480 px wide, no brushwork saves it.
- **Stroke direction per shape:** `dir: 90` vertical for walls, `0` horizontal for floors, skies and water. `maxR` small (5 to 12) for frames and edges, big (36 to 40) for walls. Strokes never cross a `group`, so silhouettes stay crisp.
- **Underpainting** under the strokes (`E.texture(ref.ctx.canvas)`, `E.under(...)`), so no canvas shows through as outlines.
- **Light:** `E.finish({light: [-.75, -.45, .6], ...})` rakes from the side; warm light against cool shadow. Brightest, purest colour only on the story's subject.
- **Palette of the working page:** walls `#7a5a44` to `#2e211c`, floor `#6a4630` to `#3a271c`, window sky `#26407e` to `#f2c27a`, prayer mat `#8a2c2a`, thobe `#e6dcc6`, kufi `#f6f1e4`, flame `#ffb347` to `#fff0b8`. Pick each reel's palette from its story.
- **No film grain** (it eats the knife edges). Render at 2x (`ss: 2`, the default).
- **Text:** crisp 2D text on its own canvas above the painting, never painted strokes for small letters. Baskerville cream with a soft dark glow.

## Motion

- **Static paint is static.** Only what the story moves moves: a figure, a flame, dust, light. Moving things are rebuilt every frame with **fixed seeds** (`seed` on every `Strokes.push`: the default seed uses `Math.random` and breaks `frame(t)`).
- **Colour re-laid by the knife** (the medium's own move): draw the world with `grey: 1` and `reveal: <time>`, give each stroke a `rev` delay (for example its distance from the window divided by 650 px a second), and the knife sweeps colour back stroke by stroke.
- **The one coloured thing:** the world in grey, one object (a flame, a mat, a gift) drawn with `grey: 0`.
- **Camera:** the engine takes `cam: {x, y, zoom}`; clamp `x` and `y` so the world edge never shows (look.md, Camera and timing).
- **Small living details:** a lamp flame (`KNIFE` with taper, length on two sines), dust drifting up in the window light (`DAB`, low alpha).

## How it explains

- Story device: one room or one place, painted once; the change happens in colour and light, not in cuts.
- Turn: grey to colour, swept by the knife from where the light comes in.
- Feeling: the raking light drops low at the peak so every ridge catches it.
- Labels and text: crisp text on calm paint, at the top or in a dark plane.

## Gaps before a full reel

- **Figures.** At about 470 px tall, the knife's square ends make a thobe read as boards and a head read as a cut log. Use figures under about 300 px tall, seen from a distance, or build a better figure first: many narrow tapered strokes, `bend`, low `hgt` (0.3 to 0.5), and no round `DAB` joints.
- **Speed.** `paintRef` on a full 1080x1920 plate takes a moment at load; keep one plate per place.
- **Only one room is proven.** No outdoor place, no second scene, no scene change has been tried.
