# Style: Graphite sketchbook

A pencil study in a spiral sketchbook, shown as it is made. Faint construction ellipses come first, firm contours over them, then directional hatching, a smudged tone, and a kneaded eraser lifting the highlights. The page ends with the verse written in pencil. Quiet and careful, like slow hands. The pencil in hand draws every line.

## Look

- Desk `#2a2420` at the left edge and a cream page `#efe6d2` with baked fibre noise, a curve near the binding and a lamp falloff. A wire spiral with punched holes runs down the left edge.
- Graphite `38,38,44`. Construction at 10 to 30 percent, contours at 70 to 85 percent, hatching at 50 percent, a smudge layer of the same colour at 8 to 50 percent.
- Type: Bradley Hand for the title and the English, Noteworthy for the margin note, Scheherazade New for the Arabic, Menlo for the citation. All in graphite.
- Subject: six stepping stones across a stream, drawn as flat ellipses with a band of side. Faint flow lines run behind them and ripple rings spread round each foot.
- Props: the pencil in hand (a green 2B), eraser crumbs on the page.

## Motion

- Construction ghosts in first (axis, sight line, loose overshooting ellipses). Contours firm up stone by stone, near to far. Hatching sweeps three passes over each stone, driven by a light model from the upper left. Highlights lift last.
- The pencil tip follows the newest stroke. A slow pull-back of the whole page (5 percent over 6.5 s) runs under everything.
- Ripples never stop, so the final hold is alive.
- The Arabic word is written with the pen mask right to left, marks last; the English writes character by character.

## How it explains

- Story device: A pencil works across a wide sketchbook spread while the camera follows.
- Arrows and flow: Pencilled arrows, drawn with a quick faint pass then a firm line.
- Labels and text: Pencil handwriting, written on word by word.
- Numbers and counts: Numbers pencilled and re-pencilled as they count.
- Emphasis: A firm pencil circle or a quick underline round the key word.
- Scene change: The page physically turns to a fresh sheet; no cuts.

## Build notes

- `pencil()` draws a line as short segments whose width and alpha taper at both ends and flicker with noise. All gating is a `gate` argument computed from `t`, so there is no state between frames.
- Hatching: for a set of offsets across the shape, walk along the line and collect runs where `shade(x,y) > threshold`, then draw each run in hand-length flicks (8 to 22 points) with a small jitter. The random sequence is seeded and consumed the same way each frame, so the lines never change as the sweep reveals more of them.
- The tooth pass is the medium: for every pixel `k = clamp((tooth - (1 - alpha * hard) * .75) * 3.2 + .15)` and `alpha *= .25 + .75 * k`. Light pressure only catches the peaks. Run it on the graphite layer (hard 1.4) and the smudge layer (hard 2.2) every frame; the tooth array is baked once.
- Flow lines are drawn first and the stones' silhouettes are knocked out of the layer with `destination-out` before the contours, so water never runs through a stone.
- Gotcha: text between y 250 and y 1500 holds six stones, the verse and the citation only if the stones sit between y 430 and y 1100. Check that the Arabic's high marks clear the nearest stone.
- Gotcha: very flat stones look like coins. Vary `rx` and add chips on the top face; more irregular outlines would help.
- The Arabic keeps its dots and vowel marks because it is painted twice (the second at half alpha, 1 px off) before the tooth pass.

## Good for (examples, never limits)

Care, restraint, slow and deliberate acts, a single careful step, anything about taking time. A subject that is built up from simple solids (stones, jars, bowls, a lamp).

## References

- `references/prompt-sketchbook-pencil.md`. `pencil()`, the construction and contour passes, `hatchPass`, the tooth pass, the kneaded-eraser lift, the spiral binding and the slow pull-back are ported from it.

## Working example

`assets/styles/graphite-sketchbook.html`: a 10 s page (QURAN 18:19). "Some steps need slow hands." Six stepping stones are sketched, shaded and rippled, a margin note says "test each one", then the word wal-yatalattaf is written, with "and let him be cautious" and the citation held for about 2.5 s.
