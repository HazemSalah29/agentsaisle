# Style: Iso night

**Production readiness:** needs work (the room, the moonlight, the lamp and the flat floor labels hold up; stand, ruku and sujood poses blend in a 14 s working page; ruku reads as a deep bend rather than a flat back, sujood reads as a low shape from far away, and no scene change, second place or sound has been tried)

A true isometric world floating in a night void: one room on a thick bevelled slab, solid walls, a window with the moon, and one warm lamp. Every edge is parallel and nothing gets smaller with distance, so the floor always reads at a glance. The palette, the scenes and the moves here are our own. Working page: `assets/styles/iso-night.html` (a man prays before fajr: he stands, bows into ruku, stands, and goes down into sujood; moon dust drifts in the window beam, the lamp flickers).

## Look

- **True isometric.** One projection for everything: `P(x, y, z) = [OX + (x - y) * cos30 * S, OY + (x + y) * 0.5 * S - z * S]`. Build with `box()` and `poly()` in world units. Never a vanishing point.
- **One place, one slab.** The room sits on a thick slab with a bevel over a dark void, with a soft cool glow under it.
- **Solid walls.** Two back walls with a lit top edge and a thickness, so they read as walls, not glass.
- **Palette:** void `#060912` to `#0b1226`, floor `#1b2646`, walls `#101a34` to `#1a2648`, wall tops `#26345e`, moonlight cream `#f4eed6`, type cream `#ece6d2`, prayer mat `#2b5658`, lamp amber `#ffd38a` with glow `255,170,80`. Pick each reel's accent from its story.
- **Colour jobs.** Blue is the world. Cream is the moon and the text. Amber is the one warm thing (the lamp, or whatever the story makes precious). Keep amber to one object.
- **Figures are jointed.** `POSES` holds each pose as a side view in the figure's own plane (`[forward, up]` for foot, knee, hip, shoulder, head, hand, plus a radius per part); forward is toward the qibla (world -y). `poseAt(t, keys)` eases between keyframes, `figure(x, y, pose, breath)` projects the joints and draws each part as a tapered capsule. Poses: `stand`, `ruku`, `sujood`. Faceless, thobe and kufi; the kufi sits on the side of the head away from the neck, so it turns with the head. Warm light on the lamp side, cool on the moon side.
- **Fill each capsule piece on its own** (`capsule()` returns three paths). One combined path cancels where windings oppose and shows seam lines.
- **Labels lie flat on the floor** at the iso angle (`g.transform(cos30, .5, -cos30, .5, 0, 0)`), in spaced Menlo capitals. A label names a thing in the viewer's words; it is never a riddle.
- **Text:** Baskerville italic cream at the top (y 250 to 400), with a soft dark glow. Citation and watermark below the slab.

## Motion

- **The camera never turns.** It only pushes in or slides, so the iso grid stays the same (look.md, Camera and timing).
- **Living details:** dust drifting down the moonbeam, the lamp flicker (two sines), a small breath in the shoulders, a slow star twinkle.
- **All randomness is seeded** (`rnd` reset at the top of `frame(t)`); grain re-seeds per frame from `t`. `capture.mjs verify` passes.
- `window.TEXTS(t)` is in the page, so `readcheck.mjs` runs on it.

## How it explains

- Story device: one place seen whole, like a model on a table; the change happens to light, objects and posture.
- Turn: light changes (the lamp goes out, the moon sets, dawn comes through the window), or a new slab slides in at the same angle for a new place.
- Feeling: the camera pushes in slowly on the one warm thing.
- Labels and text: flat labels on the floor for objects; story lines at the top.

## Gaps before a full reel

- **Poses.** Sitting (jalsa, tashahhud) and raised hands are not built; add them to `POSES`. Ruku could use a flatter back; sujood needs a closer camera to read the forehead on the floor.
- **Scene change.** Sliding a second slab in at the same angle is planned, not built.
