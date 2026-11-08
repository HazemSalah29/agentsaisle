# Screens

Ready-made animated screens in `assets/screens/`. **A toolbox, never a limit:** a reel may use none of them, and anything the script needs that is missing gets built new for that reel. Never pitch a smaller direction because a screen already exists. The direction comes first; this menu is asked second.

See them all: `assets/screens/gallery/index.html` plays every screen for 6 s, joined by the transitions (set `data-palette` on `<html>` to `olive`, `oxblood` or `dusk`; `dusk` is the Cinema sand colours, and a demo can carry its own palette as a fourth item). Its text is demo text, never for posting.

## Using a screen in a reel

1. Copy `kit.js`, `palettes.css`, the screen files and (if used) `transitions.js` into the reel folder. The reel may change its copies freely; the library stays clean.
2. Load them with plain `<script src>` tags, kit first. Set `data-palette` on `<html>` (or add the reel's own palette block with the same 8 tokens: `--bg --lift --deep --ink --quiet --dim --accent --accent-hi`). Declare Scheherazade New with `@font-face` next to the page.
3. The page owns the atmosphere: `const atm = Kit.atmosphere(root)` (ground with a breathing glow, vignette, grain), and calls `atm.frame(t)` in its `frame(t)`. Screens draw only their subject.
4. Make a screen: `const s = Screens.counterLock(layer, { to: 365, t0: 2 })`. Every maker returns `{ frame(t), sfx, end }`. Call `s.frame(t)` from the page's `frame(t)`, push `s.sfx` into `window.SFX`, start the next beat at `s.end`.
5. Common params on every screen: `t0` (start, s), `dur`, `x`, `y` (centre, px), `scale`, `sound` (false gives no sfx), `seed`.

Every `frame(t)` is a pure function of t. Colours come only from the tokens. Arabic is one text node in Scheherazade New, never split into letters. Sounds use only the types in sound.md.

## The screens

| Screen (file) | The viewer watches | Own params (default) |
|---|---|---|
| `counterLock` (counter-lock.js) | a number counts up, slows, 0.3 s of silence, locks with a pulse and an accent line | `from` 0, `to` 100, `curve` 'ease' or 'flicker', `digits` (pad), `label`, `race` {to, label, lead} for a second counter that leads, then both lock |
| `dotGrid` (dot-grid.js) | dots light until the count is full, a count above | `cols` 21, `rows` 18, `fill` 365, `order` 'row', 'spiral', 'random' or 'wave', `rate`, `shape` 'dot', 'bead' or 'square', `missing` [indices that stay dim], `label` |
| `barRace` (bar-race.js) | up to 5 bars grow; the leader glows; the lead can flip | `bars` [{label, value, role 'accent' or 'ink'}], `steps` [[share, values]], `orient` 'up' or 'across', `lockEqual` |
| `arabicHighlight` (arabic-highlight.js) | a line of Arabic writes on, the key word lights, an underline or ring, English rises | `ar`, `key` (throws if not in `ar`), `en`, `reveal` 'pen', 'words' or 'fade', `underline` 'draw', 'ring' or 'none', `at` 1.4, `size` 128 |
| `ayahMap` (ayah-map.js) | 114 marks (or 30 juz cells) light where a word appears, a count climbs, optional zoom to one hit | `hits` [{surah, ayah}], `layout` 'strip' or 'grid', `label`, `zoomTo` (index) |
| `dial` (dial.js) | a hand turns, marks light as it passes | `from` 0, `to` 18, `max` 24, `marks` 24, `labels`, `label`, `kind` 'clock', 'gauge' or 'sun' |
| `orbitRings` (orbit-rings.js) | bodies circle a lit centre with soft trails, rings settle one by one | `rings` [{r, count, speed}], `centre` 'dot', 'word' or 'none', `centreText`, `tilt` 0.55, `settleAt` |
| `cardGrid` (card-grid.js) | cards slide in, can flip, ticks land one by one | `cards` [{text, sub}], `cols` 3, `order` 'row' or 'random', `flip`, `checks`, `stagger` 0.3 |
| `timelineBar` (timeline-bar.js) | a bar draws across a span, event marks pop, a light runs along it | `span` {start, end, unit}, `events` [{at 0..1, label}], `runner` 'light' or 'none', `fillTo` 1 |
| `shapeMorph` (shape-morph.js) | one shape turns into the next point for point (a lamp becomes a crescent becomes a door); needs motion.js | `shapes` (SVG paths or point lists; demo set on `Screens.shapeMorph.shapes`: lamp, crescent, door, drop, leaf), `at` [times], `hold`, `move`, `spring` {zeta, f}, `fill`, `stroke`, `N`, `size`; one `slide` sound per morph |
| `polygonDraw` (polygon-draw.js) | a shape draws line by line with a pen dot, then fills | `sides` 7, `kind` 'polygon', 'star' or 'bloom', `k` (star step), `draw` 'lines' or 'all', `fill` true |
| `particleField` (particle-field.js) | dust drifts, gathers into a circle or a word (Latin or Arabic), scatters | `count` 1400, `target` 'circle', 'word' or 'none', `text`, `gatherAt` 0.1, `scatterAt` 0.62, `drift` 1 |
| `scaleZoom` (scale-zoom.js) | the camera pulls back level by level: one dot, a day, a month, a year, a life | `levels` [{label, kind 'dot', 'grid' or 'rings', n}], `speed` 1, `holdAt` 0.8 |
| `lanternCount` (lantern-count.js) | a count as lanterns that light, never a ring or bars. `hall`: the camera flies down a hall, lanterns light ahead of it left and right in turn, a counter climbs, a miss stays a dark lantern with a label. `strings`: strings of small lanterns with the same number on each string, groups light in turn, so a bigger count is more strings | `mode` 'hall' or 'strings', `total` 114, `misses` [], `missLabels` {}, `label`, `groups` [{label, n, arabic}], `perString` 19. Shown in the `dusk` palette (Cinema sand colours) in the gallery |

## Elements (elements.js)

Forces a line can name, acted out on screen. Use one only when the script names that force; the base look stays calm. Each returns `{ frame(t), sfx, end }` like a screen; `glitch` takes an existing element instead of a root. Colours come from the tokens unless `color` is passed (fire and water usually want their own). Demo: `assets/screens/gallery/elements.html` (capture it from a scratch copy, as its top comment says).

| Element | What the viewer sees | Params (default) |
|---|---|---|
| `Elements.flash(root, o)` | a full-frame flash, up in 2 frames, fast decay | `t0`, `dur` 0.45, `peak` 0.85, `color` white |
| `Elements.lightning(root, o)` | a jagged bolt with branches draws in 0.08 s, flickers, fades; flash, `crack` and `boom` | `x0`, `y0` (start), `x1`, `y1` (strike), `branches` 3, `color`, `glow` accent-hi, `flash` true, `rise` false |
| `Elements.fire(root, o)` | embers rise from a base line, hot at the root | `x`, `y` (base), `width` 760, `height` 560, `count` 1600, `color` '#e2541f', `colorHi` '#ffd27a' |
| `Elements.water(root, o)` | stacked wave lines draw on and keep rolling | `x`, `y`, `width` 760, `lines` 9, `gap` 26, `amp` 10, `color` '#5fb3d9' |
| `Elements.fog(root, o)` | soft banks drift, then lift and thin out | `y`, `height` 900, `opacity` 0.55, `clearAt` 0.6 (share of `dur`) |
| `Elements.cracks(root, o)` | glowing veins grow from the edges to a ring and light where they hit | `x`, `y` (target), `ring` 220, `count` 12, `color` '#e0452e', `grow` 1.6 |
| `Elements.glitch(el, o)` | the element jitters, splits red and cyan, slices, then settles | `t0`, `dur` 0.7, `strength` 1 |
| `Elements.rays(root, o)` | soft beams fan down from above and sway | `x`, `y` -160, `count` 7, `spread` 56, `opacity` 0.12 |

A morph (water that becomes fire) is two elements on one spot: end one as the other starts, with a `flash` between.

## Transitions (transitions.js)

Each returns `{ frame(t), sfx, end }`. They set opacity, transform and filter on whole scene layers, so put any scene's own transform on an inner wrapper.

| Transition | What it does | Params (default) |
|---|---|---|
| `Transitions.crossfade(a, b, o)` | a fades and grows slightly; b fades in as its blur clears | `t0`, `dur` 0.45 |
| `Transitions.dipSeed(a, b, o)` | a dims until one seed is left; b grows out of it | `t0`, `dur` 1.6, `seed` 'dot', 'zero' or a word, `x`, `y`, `parent` |
| `Transitions.colorShift(target, o)` | every palette token moves to another palette (OKLab mix) | `t0`, `dur` 2.5, `to` 'oxblood', `from` |
| `Transitions.keyUnderline(wordEl, o)` | with a voice: the word turns accent and an underline draws just after it is said | `at`, `lag` 0.1, `colour` |
| `Transitions.fold(a, b, o)` | a swings off a hinge toward the viewer in 3D, shading as it turns, its shadow falling on b | `t0`, `dur` 0.9, `axis` 'y' or 'x', `hinge` 'left', 'right', 'top' or 'bottom', `dist` |
| `Transitions.mirrorFold(a, b, o)` | a splits at its centre and the halves open like doors onto b | `t0`, `dur` 0.9, `right` (a second live copy of a's scene; without it a static clone is used), `dist` 2600 |
| `Transitions.maskWipe(a, b, o)` | b shows through a growing shape; an object in a can lead it | `t0`, `dur` 0.9, `shape` 'circle', 'arch', 'line' or an SVG path in a 100x100 box, `x`, `y`, `lead` (element), `soft` 0 (circle and line only), `rin` 30, `rim` true, `parent` |
| `Transitions.matchCut(a, b, o)` | a shape in a travels and scales onto a shape in b while the scenes swap behind it | `t0`, `dur` 0.9, `fromEl`, `toEl` (measured at make time and on `document.fonts.ready`; make it with both scenes at rest), or `fromRect`/`toRect`, `parent` |
| `Transitions.pageTurn(a, b, o)` | a peels off a corner like a page flipping, with a moving highlight and shadow (a flat fold, not a curved curl) | `t0`, `dur` 1.0, `corner` 'br', 'bl', 'tr' or 'tl', `angle` 30 |

The five above set `zIndex` on the layers while they run and restore it after, so each scene layer needs `position:absolute` and a `zIndex`. At the end, a is hidden and b is normal.

## Type motion (type-motion.js)

Text that moves with meaning, not a plain fade. Load after `kit.js`. Latin text may be split into words or letters; Arabic stays one text node, never split (shaping breaks). Each returns `{ frame(t), sfx, end }` and takes the common params.

| Maker | The viewer watches | Own params (default) |
|---|---|---|
| `TypeMotion.maskReveal` | lines rise from behind a hard mask edge, one after another | `lines` (or `text` with \n), `size` 112, `stagger` 0.2, `lineDur` 0.85, `dir` 'up', 'down' or 'left', `accentLine` (index) |
| `TypeMotion.wordStagger` | words arrive one by one (heavier words slower, small settle); the key word lands last and turns accent | `text`, `size` 104, `stagger` 0.2, `keyWord` (word or index; throws if absent), `keyGap` 0.5 |
| `TypeMotion.textMorph` | one word becomes another: shared letters hop to their new spots, the rest fade and swap | `from`, `to`, `size` 230, `hold` 0.8, `morph` 1.0 |
| `TypeMotion.inWorld` | text on a wall, floor or page in CSS 3D, moving with the world | `lines`, `size` 104, `surface` 'wall', 'floor' or 'page', `rotX`, `rotY`, `z`, `persp` 1400, `cam` t => {x,y,z} (default a slow push) |
| `TypeMotion.dimensional` | a big headline grows stacked token-colour layers and turns slightly as it holds | `lines`, `size` 230, `depth` 24, `gap` 4.5, `turn` [-26, 20], `persp` 1700 |
| `TypeMotion.arabicMask` | an Arabic phrase is revealed right to left through a soft moving mask with a lit edge, then the English rises | `ar`, `en`, `size` 140 (shrinks to fit 900 px), `softness` 160, `reveal` 1.5, `gap` 0.5 |

## Camera (assets/camera.js)

One camera for the whole world, with parallax by layer depth, so no reel retypes `cam()`. Load `motion.js` first, then `camera.js`. Pure in t; no depth-of-field blur anywhere (look.md, Cinema night).

- `Camera.rig([{el, depth}], {spring, guard})`: works on SVG `<g>` and HTML boxes. Depth 1 is the world (exactly `cam(x,y,z)`); above 1 is nearer and moves more (near frame about 1.3), below 1 is farther. Camera is `{x, y, z, rot}`, home 540, 960, 1, 0.
- Moves, in time order, each starting where the last ended: `push(t0, dur, toZ)`, `pull`, `pan(t0, dur, toX, toY)`, `crane(t0, dur, toY)`, `whip(toX, t0, dur)`, `orbit(t0, dur, radius, deg)`, `shake(t0, dur, amp, seed)` (seeded, decays), `drift({period, amount})` (1.00 to 1.06 breathing).
- Or absolute keys: `rig.keys([[t, {x, y, z, rot}], ...])` eased with `inout`; springs with `{spring: .8}` (as `Motion.track`).
- `whip` and `crane` add a motion blur (45 px across, 30 px up) only while they move.
- `rig.frame(t)` applies it; `rig.state(t)` returns the camera (to place captions). A one-time console warning fires if a near-layer object sits in the caption band y 1350 to 1550 at rest.

## Before using a screen's look on a post

Each screen avoids one studied page's signature (the "Not like" lines in the spec). Keep it that way when bending a copy: no slot-machine counter on a gold glow, no flow-field orb, no green ring badge, no 3x3 grid of cycling numbers.
