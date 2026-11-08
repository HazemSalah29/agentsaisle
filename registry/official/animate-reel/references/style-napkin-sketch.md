# Style: Napkin sketch

A plan scrawled in black Sharpie on a crumpled cafe napkin, lying on a varnished wooden table beside a cup of tea. The ink feathers into the tissue, a red Sharpie marks the wrong guess, and the marker is set down at the end. Casual, human, like someone explaining over tea.

## Look

- Table: horizontal planks of warm wood `118,74,42` with ring grain per pixel, a window sheen, a cup shadow, a vignette.
- Napkin: a 900 x 1300 sheet tilted about 2 degrees, `#f6f5f0`, deckled edge, 5000 tissue fibres, an embossed border and dot-quilted field (light and shadow offsets), a faint ring stain, folds and crumples lit from the upper left.
- Ink: Sharpie `22,20,28`, red `186,28,30` only for the wrong guess and the key word.
- Type: Marker Felt (system font), 58 to 104 px. Arabic in Scheherazade New, written in the same ink. The citation in Menlo.
- Props: a cup of tea on a saucer with a slow ripple and curling steam, the marker in hand while drawing, then set down.

## Motion

- Strokes follow a clock: each takes `length / 1500 + 0.03` s, and the clock is reset at each group (`clock = 2.35`) so the plan lines up with the script.
- Ink keeps wicking into the tissue after it is drawn (`soak`): the blur and the halo alpha grow over the first 9 s.
- The napkin breathes by 0.3 percent. Steam rises and fades all the time.
- Arabic is written with the pen mask right to left, vowel marks last. The English lines write character by character.

## How it explains

- Story device: A cafe-table pitch: marker scrawls on a paper napkin, with tea and steam beside it.
- Arrows and flow: Quick marker arrows that bleed into the tissue.
- Labels and text: Handwritten words in marker, scribbled in as if talking.
- Numbers and counts: Numbers and tallies scrawled big, tally marks added one at a time.
- Emphasis: A red marker circle or underline round the one thing that matters.
- Scene change: Camera pulls back from a full napkin; a fresh napkin is slapped on top of the pile.

## Build notes

- Bake once: table, napkin body, the fibre mask (95 000 short strokes), the speckle the ink core absorbs unevenly, and the crumple lighting (a height field of noise, ridges, folds and edge curl, lit into a dark layer and a highlight layer).
- Per frame: draw the strokes into a full-size ink layer `IL`. Then composite onto a copy of the napkin: a blurred double copy of the ink cut by the fibre mask (the feathering), a 2.2 px blurred copy at 85 percent (the soft halo), then the sharp core with the speckle knocked out. Last, the baked lighting with `source-atop`, so folds shade the ink too.
- Gotcha: at full strength the crumple makes the napkin read as cobblestones under thin ink. Lower the relief shading factor from 1.35 to .85 and keep the ink at 6 px.
- Gotcha: put the ring stain where no text sits (top right).
- Gotcha: the "Permanent Marker" web font is not on the machine; Marker Felt is close enough and needs no download.
- Show wrong versus right with shapes, not captions: two boxes joined by a long "later..." arrow, crossed out in red, then two boxes side by side under a brace. The brace is what says "with".

## Good for (examples, never limits)

Plans, comparisons, "not this, that", a wrong assumption corrected (hardship THEN ease versus hardship WITH ease). Works with short Arabic.

## References

- `references/prompt-napkin-sketch.md`. The wood table, the napkin, the fibre feathering, the crumple lighting, the cup and steam and the marker are ported from it. The coffee became tea.

## Working example

`assets/styles/napkin-sketch.html`: a 10 s page (QURAN 94:5). "THE PLAN": hardship, "later...", ease, crossed out in red; then hardship and ease side by side under a brace marked WITH in red; then the Arabic, the English and the citation hold.
