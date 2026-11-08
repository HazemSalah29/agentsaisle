# Style: Origami studio

Folded-paper models shot on a seamless white studio sweep. Every form is flat facets with consistent fold shading, crisp valley and mountain creases, two-tone paper (colour outside, cream inside) and soft table shadows. A small 3D engine: faces in world space, projected, sorted and shaded one by one. Text lives on tent cards that fold up from flat.

## Look

- Sweep: `#c9d3cf` to `#e6e6de`, a spot of warm light, paper fibre over it. Paper colours: indigo `[58,82,150]`, mustard `[241,182,68]`, teal `[44,160,150]`, sea blue `[60,138,176]`, cream `[246,242,233]`, ink `#23242a`, accent `#e45a3e`.
- Light: a warm key `[-.55, 1, .55]` that orbits slowly (`t * .11` rad), a cool fill from the right. Face brightness `.5 + .7 key + .16 fill + .1 up`, tinted `[1.04, 1, .95]`.
- Each facet: a light gradient along the key direction, a thin lit edge, dark valley creases and light mountain creases (classified from the shared edges between neighbouring facets), and a fibre texture multiplied over everything.
- Shadows: a soft long shadow cast along the key light and a tight contact shadow, both drawn into half-resolution masks and multiplied onto the frame.
- Type: Avenir Next bold on the cards, Scheherazade New for the Arabic, Menlo spaced capitals for the citation.

## Motion

- Tent cards unfold from flat in 0.7 s. The hook card changes its text with a small hop, then folds away while the verse card folds up in its place.
- The boat is a flat net that folds: two hull panels hinge up on the keel to 50 degrees, end triangles close the bow and stern (they are coplanar flat and read as crease lines), a creased sail grows from the keel.
- The water is accordion-pleated ribbons that lie flat until the boat sails, then rise to ridges. The boat bobs and rocks a little. The key light flares when the boat first floats and when the last line lands.
- The camera pushes in slowly all the way through.

## How it explains

- Story device: One long studio table; every prop folds up from flat paper as the camera slides along.
- Arrows and flow: A creased paper arrow lying on the table, with the label printed on it.
- Labels and text: Printed text on folded tent cards or a paper strip, refolded when the words change.
- Numbers and counts: Numbers on tent cards that fold to a new face for each count.
- Emphasis: A camera push-in and a key-light flare on the paper that matters.
- Scene change: The camera dollies along the table to the next prop; no cuts, the old paper unfolds flat.

## Build notes

- Faces are `{pts, col, bcol, paint, map}`. The normal comes from the vertex order; if the viewer sees the back, the face uses `bcol` (the cream inside). Order the vertices so the outside is the front.
- `paint(ctx, 400, ch)` draws a face's print in card units; the affine map comes from three projected points, so type sits in perspective. Size type in card units and fit long lines by measuring (Arabic and English both overflowed at first).
- The camera must be high enough to see the card faces: pitch 36 degrees at distance 8.6 with a long lens (`F = 1560`). Low cameras make the cards read as strips.
- Layout for portrait: the cards stand far back (they land in the top half), the model near the camera, the water in front. Check that the model's tallest point (the sail) does not cross the card text.
- Arabic: write the stripped body with the pen mask, then fade in the full line, aligned word by word (`bodyWords`), or the two layers show a doubled edge.
- Pleated water: alternate ridge heights per half-period (`amp` on odd steps). Keep amplitude low (`.14` to `.16`); at `.2` the ribbons look like saw blades.
- About 36 ms a frame, with a `getImageData` pass for the grain.

## Good for (examples, never limits)

Things that take shape through steps: ease after hardship, building, order, a plan made real, journeys and boats. Cards give it a clean explainer voice.

## References

- `references/prompt-origami.md`

## Working example

`assets/styles/origami.html`: a 10 s page (QURAN 94:5): "A flat page goes nowhere." the net folds into a boat, "Fold it, and it sails.", the verse is written on a second card. Read it for the techniques; do not reuse its layout as a template.
