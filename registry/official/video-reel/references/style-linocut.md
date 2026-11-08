# Style: Linocut relief print

A two-colour hand-carved print pulled twice on cream rice paper. Everything is the carver's work: tapering white gouge strokes cut from dense black, a red reduction block printed a hair off register, salty uneven ink, and pencil notes in the margin. The reel is a run of proofs: each beat is a newly carved block, and the next proof peels back over the last one. Plants, suns, rays, arches and lettering only, no figures.

## Look

- Paper `rgb(240,232,212)` with long fibre strokes. Ink black `rgb(26,23,22)`. Red `rgb(196,58,38)`, multiplied into the paper so the fibres show through. Pencil is warm grey that goes silvery over ink.
- Block: 940 x 1230 px at (70, 200), a carved inner border line, rounded wavy edges, nicks and chips scattered in the open black (`chips`, `chatterRing`, `chatterEdge`).
- Subjects are carved as paper left in the black: a red sun with 44 long and short gouge rays and a ring of short dashes, a sprout (curved stem, two leaves with a carved midrib and side veins), a row of eight small prints of the same sprout, an arched text panel with a carved border.
- Type: Arial Black carved letters (each nudged and tilted a hair) as paper-coloured words on a vermilion band. Baskerville 56 px for the English, cut in black on the paper panel. Bradley Hand pencil notes under the block ("small, kept up", "proof 2/2") and a pencil ring round the key word.
- Arabic: Scheherazade New 94 px in black ink on the cleared panel, two lines.

## Motion

- Proof pull: `u = x*.85 + y*.55`, a front that sweeps 0.7 s from `-150` to `2100`. Behind it the new block, ahead of it the old one, with a thin dark crease line riding the front (the sheet lifting off tacky ink).
- Everything inside a proof moves on twos (`st = floor(t*12)/12`): the sprout grows over 0.8 s, the eight small prints land 0.34 s apart with a tiny chop nick at each foot, the red lettering is written on left to right.
- Arabic is written with the pen mask right to left, one line at a time, the vowel marks fading in last. English lines are cut in left to right from the centre of each line.
- The ink never sits still: the density hash changes every 1/12 s, so the grain boils slightly even on the final hold. Pencil circle draws over 0.55 s.

## How it explains

- Story device: Each beat is a freshly carved block pulled as a proof.
- Arrows and flow: Gouged channels; the error path printed red.
- Labels and text: Carved block lettering in one ink colour.
- Numbers and counts: Carved numerals re-cut on twos.
- Emphasis: The printmaker's own pencil circle and a margin note.
- Scene change: The new proof peels back over the last one.

## Build notes

- Two canvases, `k` (black key) and `rd` (red), drawn as alpha masks with `destination-out` for carving. Blur the key 1.1 px and the red 1.3 px, offset the red by (3, -2). Then one per-pixel pass composites paper, red, black and pencil.
- Keep the paper and noise fields static: bake the paper-with-grain, `tooth`, `broad`, `streak`, `fine` and the static hashes into typed arrays once. The per-frame pass then only needs two hashes per inked pixel. About 62 ms a frame at 1080 x 1920; five `getImageData` calls (two masks, two blurs, pencil) are the rest.
- Port the salt rule at full strength (`salt > .7` drops density to 15 percent, `> .55` to 70 percent). It is what makes the ink look pressed rather than filled.
- Gotcha: a single narrow leaf on a red disc reads as an eye. Draw a sprout (two leaves and a stem) instead. Never carve anything that could read as a face.
- Gotcha: `chatterRing` nicks wander outside the block when the ring is larger than the block. Reject any nick that leaves the block interior.
- Gotcha: the stripped Arabic body (no vowel marks) is about 3 percent narrower than the full line, so centring both shows a doubled edge. Centre each word of the stripped line where the same word sits in the full line (`bodyWords`).
- Gotcha: size Arabic so the longer line fits the panel with 60 px to spare (94 px here). 112 px ran into the carved border.
- Text on the red band is cut with `destination-out`, so it needs the band to be red-only (the black is cleared first, see `band()`).

## Good for (examples, never limits)

Ease, repetition, a small deed kept up, patience, anything with a "again and again" or a count of proofs. The carved sun and sprout suit growth and mercy.

## References

- `references/prompt-linocut.md`

## Working example

`assets/styles/linocut.html`: a 10 s page (SAHIH AL-BUKHARI 6464): proof 1 prints a sprout again and again ("One small leaf, again and again."), proof 2 is the hadith with the pencil ring on "little". Read it for the techniques; do not reuse its layout as a template.
