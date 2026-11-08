# Style: Chalkboard lesson

A green slate in a worn oak frame. A stick of chalk writes, ticks and hatches; a felt eraser wipes part of the board and leaves a cloudy ghost. Older lessons show faintly through the slate. Warm, schoolroom, a lesson being taught. Distinct from [hand-drawn](hand-drawn.md), which is loose chalky lines on charcoal: this one is a full physical board, with broken strokes that skip over the slate's tooth, dust, a tray and eraser ghosts.

## Look

- Slate `#2c4639` with a mottled noise base, a soft lamp hot spot, a vignette, and a 256 px light and dark tooth tile laid over everything.
- Eraser ghosts: 50 blurred arcs and passes of `215,228,215` at 4 to 10 percent, felt streaks inside them, settled dust specks, and faint old lessons (fractions, "p. 112", "due Friday") rubbed almost out.
- Chalk: white `240,242,236`, yellow `246,222,120`, pink `244,150,175`, blue `150,205,240`, green `205,250,190`.
- Type: Chalkboard SE (system font) for writing, Scheherazade New in yellow chalk for the Arabic, spaced capitals for the citation.
- Frame: oak top and sides (grain strokes plus a bevel gradient), a tray with a dust drift, four chalk sticks, a felt eraser. A little chalk-stick in hand follows the writing tip.

## Motion

- Writing goes character by character with a jitter and a second half-alpha pass. Lines draw on by their path length.
- A chalk dust puff falls under the tip; dust motes drift down the board all the time.
- The felt eraser slides along a row, wiping the chalk behind its leading edge (`destination-out` with a soft right edge) and leaving a blurred pale ghost where it passed.
- Arabic is written with the pen mask right to left in chalk, vowel marks last.
- The last chalk line is green and holds for about 2 s.

## How it explains

- Story device: A teacher lesson on one long slate, chalk writing as the camera tracks along.
- Arrows and flow: Dusty chalk strokes with a hand-drawn head.
- Labels and text: Chalk handwriting, written on word by word.
- Numbers and counts: Numbers are rubbed out and re-chalked as they count.
- Emphasis: Pink chalk rings or underlines the key word.
- Scene change: The camera slides to the next stretch of board; the old one stays behind.

## Build notes

- A chalk stroke is four parallel sub-strokes at different pressure and offset, drawn in 6-point runs whose alpha follows noise. All chalk goes to its own layer `CL`.
- The grain pass is the whole medium: for each chalk pixel keep `alpha * clamp((g - (1 - a) * .95 - .06) * 3)` where `g` mixes a per-pixel hash of the board position and a small tiled noise. Anchor it to board position, not to the frame, so the speckle never crawls. Run it every frame on the whole layer (about 20 ms).
- Draw the layer twice: once blurred at 22 percent (the dust halo), then crisp.
- Bake the slate and the frame separately (the frame is a transparent layer drawn last, over the chalk and the dust).
- Gotcha: text between y 250 and y 1500 leaves the bottom of a tall board empty. Spread the story down the board (rows near y 500 and 650, verse from y 960).
- Gotcha: Chalkboard SE at 74 px reads best as bold. At 52 px regular it is the smallest size that stays readable on a phone.
- The Arabic keeps every dot after the grain pass because it is drawn twice (the second at half alpha, 1 px off).

## Good for (examples, never limits)

Teaching moments, "a lesson", habits and counts shown as boxes and ticks, small versus big, steady versus sudden. A hadith about consistency fits best.

## References

- `references/prompt-chalkboard.md`. `chalk()`, `write()`, the grain pass, the eraser smears and the oak tray are ported from it.

## Working example

`assets/styles/chalkboard-lesson.html`: a 10 s page (SAHIH AL-BUKHARI 6464). Two people start the same habit: the big deed fills two boxes and the eraser wipes its empty days away, the small deed ticks every day. The Arabic is chalked, then the hadith in three lines, the last in green.
