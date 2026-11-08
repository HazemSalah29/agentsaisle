# Style: ember light

**Production readiness:** demo only (one 12 s page, plain room and hall both render; no real reel has used it yet; the figure has no sitting or hand poses beyond the walk and idle, and the head turn is a body yaw with a small head look)

Faceless people made of glowing light in a real 3D world, lighting the ground around them. The look is the glow and the real light, not a room: any place works (dunes at night, a lantern street, a cave, a shore). The demo room is one set; a new place is a new set built with the same textures, lights and engine.

## Look

- World: dim and warm, the figure the brightest thing in it. Indoors, lit by one or two lamps (cream `#f2e2be` shades). Planks, plaster or damask wallpaper with a walnut dado, all painted in code. Never brighter than the figure.
- **Modesty first:** no female glowing figure unless she is shown fully covered and modest: a loose garment to the feet, head covered, no body outline. Kind 0 as shipped shows a body outline, so it is never used; a covered shape must be modelled first.
- Figure: one hero per frame, a smooth faceless silhouette with no eyes, no clothes colour. Light preset is a parameter: `EMBER` (red, the horror-leaning default), `GOLD` (amber, warm and calm), `MOON` (cool cream-blue). Others stay dim (`gain` 0.1 to 0.3).
- The figure lights the room: three point lights, a glow pool on the floor, and a mirrored copy in the glossy floor.
- Post: bloom (0.4 to 0.6), vignette 0.55, soft grain, Neutral tone mapping. No depth of field, no focus blur.
- Type: calm italic serif (Baskerville, Georgia), cream, one line, lower third, soft shadow. Not yellow Arial.

## Motion

- Camera: a slow eased dolly in (about 1 m over 12 s) with a tiny seeded drift (sums of sines, fixed phases from `rng(seed)`), so the same `t` always gives the same view.
- Figure: walks along a path with planted feet (`walk(path, d, t)` and `travel`), eases to a stop over about 0.5 s, then turns in place to look at the lamp.
- The doorway: the door leaf swings open from `t` (a group hinged on its left edge) and the figure's glow grows as it opens.
- Lamp: a faint flicker, a deterministic sine of `t`.
- Entering: from a lit doorway. Leaving: walk out the same way, or fade to black over 0.6 s.
- Transitions: cut to a new camera in the same room, or fade through black. The world is rebuilt from `t` every frame, so nothing carries over.

## How it explains

- Story device: a person (a companion or a made-up character, never a prophet) acts out the idea with body and light.
- Arrows and flow: none; use gaze, a lamp, a doorway, a path of light on the floor.
- Labels and text: one cream serif line, lower third.
- Numbers and counts: more dim figures appearing in the room, or lamps lighting one by one.
- Emphasis: the figure's glow rises and the lamp dims.
- Scene change: the camera dollies to the next room or the door opens on a new one.

## Build notes

- Files: `assets/ember/` (`engine.js`, `figure.js`, `tex.js`, `room.js`, `index.js`), three.js r186 in `assets/vendor/three/`. Import map: `{ "three": "../vendor/three/three.module.js" }` from `assets/styles/`.
- Render: `makeEngine(canvas)` then `engine.render(scene, camera, t, { exposure, bloom, vignette, grain, fade })`. A 2D canvas on top draws the caption.
- Figure: `new Figure(scene, { kind, color: GOLD })`, `fig.pose(walk(path, d, t, { amp, yaw, look }))`, `fig.gain`, `fig.visible`, `fig.setColor(MOON)`. Kind 2 is the default man: a loose thobe to the ankles, only the feet below the hem, the hem sways as he walks; `cap: 'kufi'` (default), `'turban'` or `'none'`. Kind 3 is a woman in an abaya with a khimar: a hood with no neck, draped over the shoulders and chest to a visible edge, no body outline. She is fully covered and modest; use her as she is, and never trim the khimar or the abaya (see Modesty first). Kind 1 (bare broad body) and kind 0 (slim, bob) are never used. Glowing eyes exist in the shader (`fig.eyes`) but stay off.
- Sets: `buildPlainRoom` (plaster, one doorway, one lamp) and `buildHall` (planks, runner, wallpaper, dado, door, lamp, console table). Both return the door leaf, lamp and handles to reset each frame. Keep the floor at y = 0 so the mirror works.
- Pure frame: set every animated thing from `t` at the start of `frame(t)`: door angle, gains, lamp, poses, camera. Same `t` twice gave identical bytes in testing.
- WebGL in capture: the page loads ES modules from `file://`, which Chrome blocks (CORS from origin null). `scripts/capture.mjs` needs `chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] })`. Headless Chrome then renders WebGL fine.
- Cost: texture painting takes a few seconds at load; each frame is one full-size ray-march pass per figure.
- Sound: `wood` at low gain for footfalls and the door. No music.

## Good for (examples, never limits)

A companion or a made-up character in any place, a night journey across open ground, a crowd of dim figures with one lit, a lone figure on a hill, a quiet arrival.

## Working example

`assets/styles/ember-room.html`: a 12 s page (a doorway opens, a gold figure walks in, stops, turns to the lamp). Add `?set=hall` for the hall and `?color=ember|gold|moon`. Read it for the pose and camera code; do not reuse its caption or layout as a template.
