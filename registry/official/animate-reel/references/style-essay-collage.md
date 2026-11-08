# Style: Essay collage

The warm, grainy "animated essay" collage: archival halftone prints with torn white borders and soft shadows, newspaper clippings, cut-out condensed headlines on paper strips, masking tape, flat colour blocks, and a yellow highlighter that sweeps across the key phrase. Cutouts land on 12 fps steps while the camera moves smoothly through parallax layers. No photographs of people: the prints are drawn in code (a moon over a dome, a lantern, a date palm, an arched doorway) and then treated like old halftones. Close cousins in this skill are newsprint collage (torn scraps, typewriter, stamps) and editorial spread (a Didone magazine page); this one is the grainy documentary essay.

## Look

- Paper `#f0e9d9` with a 1500 x 2100 fibre texture multiplied over it, kraft `#c9a878`, red block `#b8483a`, clipping `#e9e1cb`, card `#f5f1e7`, ink `#1a1816`, highlighter `rgba(255,226,38,.84)`.
- Halftone prints: a grey scene, blurred 1 px, vignetted, contrast 1.3, then a 45 degree dot screen (cell 3.4 to 4.2 px) mixed 38 percent with a continuous tone, dust specks and a hairline scratch. Printed on cream with a 8 to 12 px white border torn on some sides, a soft shadow and fibre texture on top.
- Headlines: Impact 118 px on paper strips (black strip with light type, paper strip with black type). Body: Baskerville bold 58 px. Kicker and citation: DIN Condensed, spaced capitals.
- Arabic: Scheherazade New 76 px, black ink on a newspaper clipping under a ruled head.
- Finish: a 256 px grain tile in `overlay` at 26 percent (a new offset each 1/12 s) and a warm vignette.

## Motion

- Scene A: two headline strips slide in (left, then right), a highlighter sweeps the second, fifteen small prints fly in from all sides and settle into ranks on a kraft sheet. Scene B arrives by a camera whip: the camera travels one screen down, blurred along its travel.
- Scene B: the Arabic clipping slides up and is written with the pen (three lines, marks last), the English card slides up, a highlighter sweeps "drawn together" then "drift apart". One print is torn in two along a ragged line and the halves slide together and are taped, while two prints with mismatched edges drift slowly apart, each with a thin dashed ink route.
- Arrivals use four stepped poses (`drop`, `slideL`, `slideR`, `slideU`: overshoot scale and a little rotation), so they read as hand-animated.

## How it explains

- Story device: Cut-paper sheets pinned on one table, the idea assembled piece by piece.
- Arrows and flow: Thin ink route lines and a red marker arrow.
- Labels and text: Condensed print headlines on paper strips, small typewriter labels.
- Numbers and counts: Numbers re-cut as condensed numerals on paper strips.
- Emphasis: A yellow highlighter sweep; a red marker ring and cross on the wrong guess.
- Scene change: A fast blurred camera whip hides the cut, or a new paper sheet slides up on steps.

## Build notes

- Build every sprite once (`init`): halves, strips, papers, thumbnails. Per frame there is no per-pixel work except the grain tile, so it is fast. `place(c, cam, p, ...)` gives parallax with factor `p`: backgrounds `p < 1`, content `p = 1`, foreground bits `p > 1`.
- Vertical whip: put the next scene one screen below (`+1920`) and pan the camera. Layers with `p != 1` move at a different speed, so a decor piece at `p` must be placed at `y + 1920*p` to land where intended, and a decor piece for the next scene must use `p > 1` so it starts off screen. Draw the fibre texture tiled (`k = -1..2` copies), or the bottom of the frame goes bare when the camera has moved.
- Whip blur: draw the frame, snapshot it, and redraw the snapshot at 16 offsets along the travel with alpha `1/(i+1)`. Seven samples left visible banding.
- Torn halves: one tear curve `T(y)` from noise. The left half is the picture clipped at `x < T(y)`, the right half at `x > T(y)`, each with a white fringe 9 px past the tear. Placed on the same centre they fit exactly, with the white seam showing.
- Arabic: stripped body words aligned to the full line (`bodyWords`), then the full line fades in. Three lines need about 116 px between baselines at 76 px.
- Keep the English card tall enough for its last baseline (385 px for four lines at 58 px); a 380 px card let the last line touch the edge.

## Good for (examples, never limits)

Explainers, "myth versus truth" turned into a calm essay, anything with two contrasting halves (things that fit and things that do not), recognition and drifting apart, gathering.

## References

- `references/prompt-editorial-collage.md`

## Working example

`assets/styles/essay-collage.html`: a 10 s page (SAHIH MUSLIM 2638): "Souls are like gathered troops." with a gathering of prints, then the hadith and its plain meaning with highlighter sweeps, a torn print taped back together and two prints drifting apart. Read it for the techniques; do not reuse its layout as a template.
