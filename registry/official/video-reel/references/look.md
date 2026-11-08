# Look

## Contents

Looks tried · Layout · Building a living object · Cinema night · Light, colour and acting · Motion numbers (a note as a feeling, as a number) · Camera and timing · Motion helpers in the starter

Pick the look per reel in the direction step. Looks tried so far:

- **Oxblood and gold** (the starter holds these tokens). Table below.
- **Dark blueprint**: near-black ground, dot grid, warm grey ink, one orange accent, IBM Plex Sans and Mono.

Whatever the look, keep one accent colour and spend it on what matters in the moment.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#45111a` | ground, with a soft radial lift to `#541520` in the middle |
| `--deep` | `#2e0a10` | ground edges, unlit shapes |
| `--ink` | `#ffffff` | text |
| `--gold` / `--gold-hi` | `#d6a84f` / `#f0cf87` | the live thing: key word, counted bead, the line that matters |
| `--quiet` | `#c3c1bd` | labels, counters, the reference |
| `--dim` | `#6b2430` | shapes not yet lit, things that stopped |

Type: Baskerville serif for English (78 px lines, 50 px for quoted English, 30 px spaced capitals for kickers). Scheherazade New for Arabic (92-96 px, line height 1.85). Tabular numbers for counters.

## Layout

- Canvas 1080x1920. Keep text between y 250 and y 1500: the Instagram UI covers the top and the caption covers the bottom.
- Side margin about 100 px. Let text wrap with `text-wrap: balance`. Centred or left-aligned is a direction choice.

## Building a living object (when the direction uses one)

Build it as one set of elements (for example 60 cells) placed by a list of layouts: `[[startTime, (kind, i, t) => ({x, y, s, o})], ...]`. `frame(t)` finds the current layout, blends from the previous one over about 0.9 s with `inout`, and sets each element's position, size and opacity. Fill, glow and colour come from the story state (day count, stopped or not).

A soft gold glow layer behind everything can warm up as the good side adds up, and breathe a little, so the ground is never fully still.

## Cinema night

A night look that plays like cinema. It reads as a film because light does the work, not outlines.

- **Sky as a dusk gradient, not a flat colour.** Near-black at the top, plum in the middle, a low warm amber glow near the horizon (`#0b0912` to `#241824` to `#5a3a26`). Seeded stars that twinkle a little. A crescent with a soft radial halo.
- **Every light source is a radial gradient** that fades to zero: lanterns, windows, doorways, the moon. Lanterns flicker with two multiplied sines (`.85 + .15 * sin(7t) * sin(3.1t)`), so no two flicker together.
- **Rim light on dark figures.** A man is a near-black robe with one thin gold stroke down the lit edge (opacity .22) and a brighter stroke on the head (.5). It reads as backlit and needs no face.
- **Light figures carry their own glow.** Women and children are cream cloth with a soft halo ellipse behind them that breathes about 4% (`1 + .04 * sin(1.6t)`).
- **Depth in layers.** A far city of dark blocks with a few warm windows, mid streets with lanterns, near figures and objects. Each scene has floating dust that drifts slowly through it.
- **A camera on every scene.** `cam(cx, cy, z)` wraps the whole world: `translate(540 960) scale(z) translate(-cx -cy)`. Every beat pans, pushes or cranes with `inout` easing. Nothing is a locked frame. `assets/camera.js` does this for you, with parallax per layer depth (see screens.md, Camera), so a reel no longer retypes it.
- **Moves between scenes as camera moves.** A whip pan slides two scenes 1300 px with a horizontal motion blur (`feGaussianBlur stdDeviation="45 0"`) only while it moves. A crane up uses the same blur vertically (`"0 30"`).
- **Lightning as one onset.** A jagged path, a sharp core plus a wide blurred glow, and a full-frame warm wash at .38 that decays fast (`exp(-9t)`), with one small after-flash.
- **Finishing on every frame.** A vignette (clear in the middle, .75 black at the edges, centred a little high) and a film grain from `feTurbulence` at .07 opacity, with its seed changed 12 times a second.
- **Gold only for meaning.** The night is plum, amber and cream; only coins, the scale and the thread are gold.

**Contrast first: never all black**. Use a bright warm horizon (`#1a1530` to `#4e2f52` to `#d0794a` to `#f0a868`), a hazy lighter far city (`#5a3c4c`), a warm brown ground with a lit edge line, and a soft blurred rim glow around every figure. Two figure modes, picked per reel:
- **Dark on light** (used in The strongest man): deep plum robes (`#140d12` to `#7a4a2c` on the lit edge) against the bright sky.
- **Light on dark**: cream robes in the child's colours (`#dcbf92` to `#fff1d8`, head `#f3dfbd`) on the same sky. This has the strongest contrast, but the child then needs his own warmer gold to stand apart.
Keep the sky when you test figure colours; change only the figures. Never let a heavy object float: a lifted thing stays in the hands that hold it.

**Depth means layers and space, never blur**. A depth-of-field blur and bokeh test lost to the sharp original (2026-10-25). Build depth as sharp planes you look through: a dark near frame close to the lens (an arch, a pillar, an awning, hanging lanterns, a roof edge, a plant) with a thin gold rim, the scene in the middle, a pale haze band over the far city, and floor lines that run back to one vanishing point. The near layer moves faster than the world when the camera moves (`nearCam`, about 1.3x). Keep near things at the frame edges, out of the caption area (y 1350 to 1550). In the 2026-10-26 test, a near doorway arch framing the whole scene read best.

## Light, colour and acting

Methods from five working faceless styles. Guides, not counts. They add to Cinema night and Gold only for meaning, never replace them: a dusk sky and a gold accent stay as they are.

- **A glow comes from a source you can see.** A pool of warm light sits next to a lamp, a window, a candle, a phone or a glowing figure, not on a wall by itself.
- **Every colour has one job.** Write it in the Look: which colour belongs to what (Lamplit: mustard is the hat only, amber is light only). The accent then means something each time it appears.
- **A glowing figure lights its world.** A pool of light on the floor, a reflection, light on the near wall; the room is never brighter than the figure (`assets/ember/`).
- **Words can live in the world.** Written by hand on a card or a window (`assets/ink/`), or printed on an object at an angle, instead of floating type. A direction choice per reel.
- **Acting lands on the word.** A face, a pose or a grip changes on the word that carries it (`faceAt` in stick-rig.js). Gestures stop hard; walking feet stay planted (`walkAcross`).
- **Hands close up.** A hand gripping the object reads at once on a phone and says "this matters".
- **Cut just before the word.** The picture changes about 3 frames before the word it shows.

## Motion numbers

Use these when the style's recipe does not say otherwise. At 30 fps, 1 frame is 0.033 s. Adapted from claude-video-2 (MIT).

- **Normal move:** 8 to 18 frames (0.27 to 0.6 s). A big camera move: 0.8 to 1.2 s.
- **Arriving:** `power3.out` or `expo.out` (in plain code: `1 - (1 - p) ** 3`).
- **Leaving:** `power2.in`, and shorter than the arrival.
- **A to B on screen:** `power3.inOut` or `expo.inOut`. Ambient drift: `sine.inOut`.
- **Never linear** on anything the eye follows. Linear is only for the master clock.
- **Overshoot:** at most 4% (`back.out(1.2)`), unless the style is playful.
- **Stagger:** 2 to 3 frames between items; keep a group inside 6 frames so it reads as one gesture.
- **Hold** a finished state at least 0.6 s. Nothing on screen for under 0.3 s.
- **A flash** (lightning, an impact) is one onset, then a hold or a fade of 0.3 s or more. Two flashes 0.17 s apart read as a glitch.
- **Nothing scales up from zero:** start at 0.6 to 0.9 scale with the opacity.
- **Text:** a masked reveal (it slides up from behind an edge) beats a soft fade.
- **Secondary motion:** a small settle after landing, and a shadow that tightens as a thing lands.
- **Parallax:** near layers move faster than far ones.
- **Cut on motion:** start the next beat while something is still moving.
- **Springs for things with weight.** `assets/motion.js` (copy it into the reel folder): `Motion.spring(t, zeta, f)`, `Motion.track(t, [[time, value], ...])` for a thing that moves to several places (one spring per change, so it never jumps), `Motion.follow` for a loose part. Damping ratio `zeta`: 1 no bounce, 0.7 to 0.85 weighty, 0.4 to 0.6 playful. Position and size may bounce; opacity and colour never do. Easing curves stay fine for fades, camera drifts and the clock.
- **One hero move at a time.** Each beat has one main move. Anything else starts 0.1 to 0.2 s after it and travels 50 to 70% as far; ambient drift stays under 5% of the hero's travel. When everything moves at once the eye does not know where to look.
- **Push key poses 10 to 30% further than feels right.** A phone shrinks everything: a 3% squash reads as no move at all, 6 to 8% reads.
- **Loose parts follow late.** A flame, a chain, a leaf or a hanging lamp starts 3 to 6 frames after the body and settles with a looser spring (`zeta` 0.3 to 0.5), like hair after you turn your head.
- **At most 3 bright flashes in any second** (WCAG, the web's accessibility standard), for comfort and for viewers with epilepsy.
- **Text contrast at least 4.5:1** against what is behind it, on every frame, moving backgrounds included. A pale line on a pale sky fails.
- **Sound lands on the picture:** a sound plays on the frame its change starts or stops, or 1 to 2 frames after, never before. Light comes before sound in real life, so an early sound feels dubbed.
- **Motion blur** is added to fast frames by `render.sh` (`scripts/blur.py`, a 180-degree shutter); never fake it with a CSS blur on the whole frame. A whip pan's own directional blur (below) is still drawn in the page.

### A note as a feeling, as a number

When the user (or a still check) gives a note as a feeling, turn it into a number before changing code:

| The note | The change |
|---|---|
| "Make it pop" | scale 1.0 to 1.08 to 1.0 over 6 frames, peak on the sound |
| "Make it feel premium" | springs at `zeta` 0.8, no overshoot on text, entrances `expo.out` |
| "It drags" | cut each hold by 6 to 12 frames, but keep the reading pace in rules.md |
| "It feels busy" | one hero move at a time; the rest start 0.15 s later at 60% travel |
| "It looks like AI" | name each default it used (glow, particles, everything fading in), ban them by name, render stills again |
| "It feels flat" | add parallax (near 1.0, middle 0.5, far 0.2) and a shadow that tightens as things land |
| "Too fast" | lengthen the move by 4 to 6 frames, not the hold |

Reading pace is our own rule (rules.md, Pace), not theirs: our copy is full sentences.

## Camera and timing

- **Shot size is the zoom, not a breath.** A drift of a few percent is too small to see on a phone. When a line names a thing, the camera goes to that thing at a clear shot size, then comes back out when the frame needs everything:
  - **Wide:** the whole scene. Use it when several things must be read together.
  - **Medium close-up:** the target fills about 1/3 to 1/2 of the frame, with a little context.
  - **Close-up:** one thing, or a detail of it, fills most of the frame. Use it for the emphasis, the act, or a small detail the line names.
  Two shots of the same size in a row feel flat. Use `assets/motion.js`: `Motion.frameOn(box, fill)` gives the shot for a target box, `Motion.track` springs between shots, and `Motion.shot(cam)` turns it into a transform that never shows the world's edge. Draw the world bigger than the frame, so the edge stop does not lock the shot.
- **Text after the camera lands.** A caption never appears while the camera is still moving to it. Captions, citations and the watermark sit on a screen layer outside the camera, so a zoom never scales or crops them.
- **Hold, move, hold.** In a scene, hold about 0.45 to 0.7 s, make one camera move for each voice line, then hold again. Under a hold, a slow push (`sine.inOut`, a few percent) keeps the frame alive. A scene may open already in close-up and pull back. Never go close and back out faster than the line can be read.
- **In slow, out fast.** Things come in over 0.7 to 1.3 s (`power4.out` or a spring) and leave over 0.35 to 0.55 s (`power2.in`). When in and out take the same time, the motion feels mechanical.
- **Each line adds one thing.** In a scene that holds over several lines, each line adds one thing and the old ones stay, up to 3 to 5 in all: the subject, its proof (a label, an object), its size (a count or a repeat), a mark. One lone object per line does not explain enough.
- **Small living details.** Every scene has 4 to 6 small things that move on their own and tell where or when we are: steam from a cup, a lamp flame, a curtain, a fan, dust in a light beam, a clock hand. Each is a pure function of `t`. Calm reels keep them slow and small.
- **Text zone: dark or light, never mid-grey.** The area right behind a caption must be dark (25% brightness or less) or light (80% or more). Check it on a grayscale still. This test is in addition to the 4.5:1 contrast rule.
- **Quick still test.** Could this frame be a slide without any change? If yes, the scene is not acting yet.

## Motion helpers in the starter

- `SC = [[id, t0, t1], ...]` scene windows. Scenes fade through the ground in 0.4 s.
- `up(el, t, t0, d)` fades a line up 22 px with a blur clearing.
- `typer(el, t0, cps)` types the text in and adds a key sound per character.
- `ease`, `inout`, `clamp` for everything else.
- Glow: `drop-shadow` or `text-shadow` in gold, strong on the moment something lights, then settling.

`frame(t)` must be a pure function of `t`: no timers, no state carried between frames. Capture jumps to any time.

Measure positions (for a ring around a word, a line under it) once in `document.fonts.ready`, with the scene visible and before any motion transform applies. A rect read mid-animation includes the slide and lands off-centre.
