# Style: Blueprint draft

A cyanotype technical drawing: white hairlines on blue graph paper, dimension arrows, mono labels and a title block, with parts that draw themselves on. Seen in the explainer family's blueprint infographics (GyGinfographics on Dribbble, static) and in line-drawing SVG animation write-ups (Jake Archibald). It reads as engineering: measured, structural, calm.

## Look

- Ground: cyanotype blue `#0b3d91`, with a graph grid: 40 px minor lines at 9 % white, 200 px major lines at 22 %.
- Ink: white `#f4f8ff` only, 2-3.5 px hairlines, square caps. No second colour; emphasis is a white block with blue text.
- Frame: a drawing border from y 250 to 1560 with a title block in the bottom strip ("DWG 6464 / BUKHARI", "SCALE 1:1", "REV A") and corner crosshairs.
- Captions: bold Menlo, white; the key phrase is knocked out (white box, blue text).
- Annotation: dimension arrows (end ticks and arrowheads), mono labels with wide tracking ("ONE BIG ACT", "+1 A DAY", "STOPS HERE"), dashed centrelines and a dashed datum line.

## Motion

- Everything draws on: the frame, then the title block, then each object, one after another.
- Objects are built in sequence, not faded in. Small parts drop a short distance onto the grid and stay.
- Annotation arrives after the object, so the drawing "gets measured".
- Quiet between beats; every new part has a sound.

## How it explains

- Story device: The drawing gets built part by part, then measured.
- Arrows and flow: Dimension arrows with end ticks, dashed centrelines and a dashed datum line.
- Labels and text: Wide-tracked mono labels; the title block carries the reference.
- Numbers and counts: Dimension figures that tick up beside the part they measure.
- Emphasis: The key phrase knocked out: white box, blue text.
- Scene change: A new sheet draws on in the same frame; the old one wipes off the grid.

## Build notes

- Draw-on: `<path pathLength="1" stroke-dasharray="1" stroke-dashoffset="${1-p}">`, with `p` from `ease((t-a)/d)`. A helper `P(d,p,w,o,dash)` does it all; pass a dash string to get a dashed line instead.
- The grid is plain SVG lines generated once per frame; render cost is negligible (no filters, no WebGL).
- Dimension arrow = line, two end ticks, two arrowhead strokes, all drawn on together.
- Rotated labels: `<text transform="translate(x y) rotate(-90)">`.
- Counting: blocks are placed by index from a start time, so the frame stays a pure function of t.
- Sound: `key` for lines, `tick` per block, `thud` when the big object stops, `plink` for a callout.
- Isometric is a possible variant (same ink, same grid, parts drawn as cubes); not tried here.

## Good for (examples, never limits)

Structure and build-up topics: pillars, steps of a ritual, consistency vs one burst, anything that compounds.

## References

- https://jakearchibald.com/2013/animated-line-drawing-svg/ (draw-on technique; found by the scout)
- https://dribbble.com/GyGinfographics (blueprint infographic look; static, unverified)

## Working example

`assets/styles/blueprint.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
