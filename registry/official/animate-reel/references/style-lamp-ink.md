# Style: lamp-ink

**Production readiness:** demo only (one room, one walk and one card proven at 12 s; no sound mix or voiceover tried; the figure only sits, stands and walks)

Feels like a quiet night-time cartoon: every line hand-inked, one lamp, a small faceless person in a big room. It is the proper version of `hand-drawn`: same boil and handwriting, but a real drawn world with light and depth.

## Look

- Ground: the world itself, inked: a room, a desert, a town street, a hillside, the sea (no plain flat page). The demo is a room; outdoors, draw the land and sky with the same strokes, hatching and wash, and let the moon, a lantern or the low sun be the visible light. No blurred backdrop, no depth or focus blur anywhere.
- Light: exactly one warm practical light you can see (lamp, candle, phone or window). Amber comes only from that source. The window is cool (`#1F2B52` glass, pale blue windows) and never warm.
- Ink: `#2B2724` for every line, variable width, tapered ends, fills sitting slightly off the line. No clean vector edges.
- Palette: the `lamplit` preset (`Ink.palettes.lamplit`), passed in with `Ink.setPalette(...)`. Change any key and the rest falls back to the preset.
- Finish: gouache wash, paper grain, soft vignette (`Ink.finish`), all options.
- Figure: blank white circle head, no eyes, ink stick body. It is the only pure white in the frame (`Ink.relightHead` after lighting). The beanie and scarf are an optional costume, off by default. Never a prophet.
- Type: hand lettering, cream on the dark ceiling with a hard ink offset shadow (no blur). Permanent Marker for numbers, Patrick Hand for lines. 100 px and up so it reads on a phone.
- Cards: cream paper with a paper texture, inked border, a scrap of tape, a flat offset shadow.

## Motion

- Boil: the whole drawing re-wobbles at 8 fps (`Ink.setBoil(t)` sets the wobble from `floor(t * 8)`). It never stops, so held frames stay alive. Amount 0.45 by default, 0 is still.
- Figure: poses are blended with `Ink.mixPose` (sit, rise, stand), the walk is `Ink.walkPose(phase)` with the phase tied to distance so feet land where the move ends. It breathes at rest.
- Camera: one slow eased push (about 10 percent over 12 s) on the world canvas with `camera.js`, plus a small pan toward where the figure is going. No rotation, no shake.
- Writing: lines appear word by word at 0.22 to 0.25 s a word (`Ink.handWords`), each word writes on letter by letter.
- Landing: a card drops in on a spring (`Motion.spring`, `zeta` 0.5), the number pops letter by letter, then the underline and the label write on.
- Never moves: the room, the paper finish, the text once written.

## How it explains

- Story device: a small person in a lit room acts the idea out (sitting, standing, walking to the thing that matters).
- Arrows and flow: not used; the walk and the light lead the eye.
- Labels and text: one handwritten line, word by word, plus a cream card.
- Numbers and counts: a number lettered by hand on a cream card that lands.
- Emphasis: hand underline on the card; the lamp light itself.
- Scene change: move the camera to another wall of the same room, or switch to a second room built with `Ink.roomShell`.

## Build notes

- Kit: `assets/ink/` (plain scripts, no modules, so it loads from `file://`). Order: `ink.js`, `finish.js`, `light.js`, `room3d.js`, `hand.js`, `figure.js`. Fonts in `assets/ink/fonts` (Google Fonts, OFL and Apache). Everything is on `window.Ink`.
- Pure frame: call `Ink.setBoil(t)` first, draw, call `Ink.finish` last on the world canvas. Every stroke takes an integer `seed` (hash noise, stateful rng is never used); give each its own so lines do not wobble in sync.
- Two canvases: the world canvas is the `camera.js` layer, a second canvas on top holds text and cards so they do not zoom.
- Order for a room: draw outside through the window, draw the room into a scratch layer (`Ink.roomShell`, `box`, `cylinder`, the figure), `Ink.lightPass` on the layer with `keepAlpha: true`, draw the layer, then emissive parts and `Ink.practical(...).emit`, then `Ink.relightHead`.
- Room scale: 1080x1920 is tall, so use a room about 4 m wide, camera `f` near 1000 and `cy` near 860. Items near the camera leave the frame fast; keep the action at depth 2.5 to 3.5 m. Keep the figure under 30 percent of frame height.
- Cost: a 138-frame clip captured in about 6 s on 4 tabs; the paper texture is built once.
- Sound: `key` per word for writing, `tap` for each footstep at low gain, `wood` for the chair, `thud` then `tap` when the card lands. No music.
- Lifting `hand-drawn`: replace its feTurbulence boil and its dark page with `Ink.setBoil`, `Ink.stroke` and a drawn room; keep its word-by-word timing.

## Good for (examples, never limits)

Any story in any place with a hand-made, personal feel: a caravan crossing dunes at dusk, a town at night, a person alone with a thought, a step-by-step act, numbers on hand-lettered cards.

## Working example

`assets/styles/lamp-ink.html`: a 12 s page in this style (sit, stand, walk to the window, a handwritten line, a cream number card). Read it for the techniques; do not reuse its room as a template.
