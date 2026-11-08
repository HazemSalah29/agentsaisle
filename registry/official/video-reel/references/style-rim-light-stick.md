# Style: Rim-light stick

Black stick figures with a thin glowing edge on the side facing the light, acting inside moody flat-shaded night or dusk sets: one strong light (a lamp, a window, a door, the moon), deep navy or mauve shadows, warm amber highlights, dust in the air, film grain and a vignette. Simple shapes, lit like a film. Ported from the aiTrends 2D Studio plugin (2026-10-30); the engine is `assets/stick-rig.js`.

## Look

- Figures: pure ink `#0e0b12` (far arm and leg `#2b2333`), round head, thick round-capped limbs. Each recurring person is known by ONE coloured garment or headwear, the same all reel (hoodie `#d64a33`, dress `#3a6ea5`, cap `#f2c21a`, and so on). Background people are plain ink.
- **Modesty first:** a woman appears only fully covered and modest: a loose garment to the feet, head covered, no body outline. The rig's `dress` (knee length) and bare `bun` or `ponytail` heads never stand for a woman. Use `top: 'abaya'` (loose to the ankles, drapes over the knees when seated or kneeling) with `head: 'khimar'` (covers head and chest to elbow height, no neck); `color` is the abaya, `color2` the khimar (a dusty pink khimar over a maroon abaya is one colourway, not a limit). Keep the khimar slim, hugging the face; a wide, thick drape looked heavy. Men in our own look: `top: 'thobe'` (ankle-length column robe, collar line, loose sleeves) with `head: 'kufi'` or `'turban'` (cap in `color2`); tested in sand with a brown cap, navy with a white cap, olive with a turban. The hoodie and beanie came from the source pack's example, not our look. Both outfits are the approved ones: men use the thobe, women the abaya with the thin khimar; never the hoodie, beanie, dress or bare hair for our characters.
- Rim light on every lit figure: `rim: {color: M.practical or M.rim, dir: [dx, dy]}`, `dir` pointing from the figure toward the light. The rim is what makes black on dark readable; never skip it.
- Sets: flat shapes and soft gradients, no outlines. 60 to 75% of the frame is dark mid-tone with 1 to 3 bright accents. Stand figures in front of the brightest area.
- Colours come from `mood(name)` (day, golden, dusk, night, storm, interiorWarm, interiorCool, void) and `S()`, so `setStyle('dusk' | 'midnight' | 'golden' | 'neon' | 'storybook')` re-themes the whole reel.
- Type: Baskerville cream for the story lines, Scheherazade New for Arabic, Menlo spaced capitals for the citation.

## Motion

- Every shot moves: a slow push (`z` 1.0 to 1.08), a drift of 20 to 90 px, or a pull-out for a reveal.
- Nobody is frozen: wrap standing or sitting poses in `breathe(pose, t, 1, seed)`; blend poses with `posesAt(t, [[0,'stand'],[1.4,'reach']])`; walk with `walkPose(t*2π*.9)` and move x at about 150 px per s per unit of scale.
- Faces change on the beat of the words (`expr`: neutral, smile, happy, joy, surprised, shocked, scared, worried, nervous, angry, determined, sad, cry, smirk, sleepy, thinking, confused, awe). Blink every 2.5 to 4 s with a different period per person.
- The narrator is never lip-synced.

## How it explains

- Story device: ordinary people act the story out: walking, waiting, giving, turning away.
- Feeling: a giant face close-up (`bigFace`, radius 280 to 360) for the moment it lands.
- Labels and text: one short line at a time, on calm sky.
- Numbers and counts: a glowing number, or objects in a row.
- Emphasis: a light turns on (a door, a window, a lamp); a freeze-frame with dust hanging in the air.
- Scene change: a hard cut between shots (the plugin's default), a dip to black for time passing.

## Shot list (use many across a reel)

1. Establishing wide: the place, small figures, a slow push.
2. Medium two-shot: two people facing each other, side view.
3. Over-the-shoulder: one person big and blurred in front (`blurLayer`), the other sharp.
4. Giant face close-up: `bigFace` over the set blurred and darkened (`blurLayer` + `veil`).
5. Insert: hands, a bowl, a door handle, a coin, big and simple.
6. Freeze-frame: the world stops, dust hangs, a cool tint, only the hero moves. Enter with a soft flash.
7. Top-down diagram: a table or a street seen from above with a dotted path.
8. Data card: a number the voice says appears as it is said.
9. Title card and end card on the same palette.

## Rules for this style

- Never draw a prophet in any form.
- A companion is drawn only faceless: `drawFigure({..., faceless: true})` (added in our port).
- Faces go only on made-up, ordinary people (video-reel-parable).
- The plugin's music generator is not ported; sound follows `references/sound.md`.

## Build notes

- Add `<script src="stick-rig.js"></script>` (copy `assets/stick-rig.js` into the reel folder, as with the font), then `const {...} = RIG`. Set `E.W=1080; E.H=1920; E.vertical=true; setStyle('dusk')` before drawing.
- One canvas, text in DOM above it. `frame(t)` clears and redraws everything from `t`; use `rng(seed)` and `t`, never `Math.random`.
- Ground line `GY = E.H*.68`, which keeps the figures above the captions and the Instagram buttons.
- Parallax: `layer(g, cam, depth, fn)` with sky .1 to .2, far buildings .4, the set 1.0, a blurred foreground 1.5 to 1.8.
- Effects in `RIG`: rain, drops, dust, snow, stars, fog, sun, moon, godRays, lightCone, pool, lensStreak, sparkle, lightning, speedLines, rings, skyline, hills, clouds, tree, pine, lampPost, windowFrame, facade, door, chair, stool, counter, screen, bed, clock, floorLines, crowd. Props for `drawFigure`: phone, ball, paper, cup, paddle, pointer, tablet, flashlight. Figure options: `x, y, s, facing, pose, rot, outfit {top, color, legs, head, headColor, face, kid}, expr, talk, blink, look, rim, dim, alpha, prop, shadow, trail, faceless`. Poses in `POSES`: stand, relaxed, talk, explain, point, pointUp, wave, cheer, handsOnHead, crossArms, think, shrug, holdFront, phone, reach, sad, facepalm, ready, crouch, sit, sitBack, kneel, lie, dive, kick, jump, fall.
- Gotcha: `facade`, `lampPost` and the other set pieces take `g` first: `facade(g, {...})`.
- Gotcha: the moon and lamps sit in parallax layers, so they move with the camera; check they do not drift behind a text line.
- Not ported: the plugin's colour grade (lift, gamma, gain) and its 3D kit. The working page does vignette and grain from `S().grade`.

## Good for (examples, never limits)

Parables, daily kindness, a neighbour, a choice between two ways, a person who changes, any story with ordinary people in it.

## Working example

`assets/styles/rim-light-stick.html`: a 10 s made-up scene (a bowl carried to a neighbour's door at night) in three shots: a wide walk under a lamp, a giant face, the door opening. Read it for the techniques; do not reuse its story.
