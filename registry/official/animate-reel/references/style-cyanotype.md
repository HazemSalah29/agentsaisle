# Style: Cyanotype

**Production readiness:** needs work (the print is a single framed card on a beige margin, so there is no camera or scene range; no depth beyond one sheet; objects stay small and top-and-bottom only)

A sun print. Objects (an olive branch, a key, a coin, loose leaves) are laid on yellow-green coated paper, the sun sweeps across and turns the paper Prussian blue, the objects are lifted off, and the rinse brings the pale shapes up white. The verse is then "exposed" white on the same blue.

## Look

- Paper `#e8e2cf` with a fibre grain. Coated area is a ragged hand-painted rectangle (jittered edge).
- Unexposed coating `#c9cf7c` (yellow-green). Freshly exposed blue `#5d86ab`. After the rinse Prussian `#0f3a6b`. Exposed white `#f1f0e6`.
- Objects while still on the sheet: dark olive `#2f3a2a` with a soft shadow, pale veins.
- Edges are soft (1.6 px blur) and a faint second copy offset 18 px down-left at 18 percent shows the sun moving, like a sun-dial print.
- Type: Scheherazade New in `#f1f0e6` with a soft white blur copy behind (edges bleed in cyanotype), Baskerville English, pale-blue Menlo capitals.

## Motion

- Weight: paper and plants are light but objects have a little mass. Objects dropping onto the sheet land with `zeta` 0.7 to 0.8 (one soft tap, no bounce), shadow tightening as they land. Lifting objects rise with a small turn, shadow growing and fading.
- Camera: a top-down copy stand. It pushes in toward the sheet, slides over to the next sheet, or tilts nothing. It never swings in perspective, never rotates, never blurs for depth.
- Entering: objects are laid down from 70 px above; text is exposed, meaning it comes up white out of the blue with a pen mask, one line at a time. Leaving: objects are lifted off, text is washed pale.
- Transformations: yellow-green to light blue to Prussian (the sun front and the rinse); a dark shape becomes a pale silhouette; a shadow copy slides 18 px as the sun moves.
- Transitions: 1) the rinse: the blue deepens over the whole sheet and the next layout is laid down on fresh coating, 2) the sheet is lifted off the table (shadow grows, scale up a little) and the next sheet is underneath, 3) a new sun front sweeps across and leaves the next print behind.
- Timing feel: slow and deliberate. The sun front takes about 1.8 s, the rinse about 1.2 s, objects are laid one every 0.35 s. Holds are long (1 s or more) because exposure is a patient thing.
- Never moves: the paper fibre, the ragged coating edge, the print once exposed (it only deepens, never jitters). Nothing in this world boils or shimmers.

## How it explains

- Story device: A sun-print: objects laid on coated paper, exposed, lifted, rinsed.
- Arrows and flow: A sweeping blue exposure front moving left to right.
- Labels and text: White Scheherazade on blue with a soft bleed; pale-blue Menlo caps.
- Numbers and counts: Counts appear as a row of pale silhouettes left behind.
- Emphasis: The pale silhouette is the emphasis: what the object blocked stays white.
- Scene change: The sheet is rinsed to Prussian and the next print is laid down.

## Build notes

- One `<mask>` does the whole reveal: gradient rect (white = exposed), the object shapes in black, and the same shapes shifted and at low opacity for the ghost.
- Define each object once in `<defs>` with `fill="currentColor"` shapes and veins using `stroke="var(--v)"`. The same `<use>` is dark olive on the sheet and black/white in the mask by setting `fill` and `--v` on the wrapper.
- Draw the pale layer first, then the blue rect with the mask, so the colour of the pale layer can change independently during the rinse.
- Put a pre-exposure hook on the coated paper in dark ink and fade it before the blue front reaches the middle; dark ink on blue is unreadable.
- Gotcha: a hard-edged light band looked like a stripe. Give it a gradient fill (transparent, warm, transparent) and `screen` blend.
- Gotcha: keep objects out of y 780 to 1400 or they fight the verse.

## Good for (examples, never limits)

Remembrance, what stays after things pass, light and its traces, preserved words.

## References

- https://en.wikipedia.org/wiki/Sun_printing - process overview (from search, not opened)
- https://kirstinefahl.myblog.arts.ac.uk/?p=110 - a music video made from about 580 cyanotype sheets at 24 fps (from search, not opened)
- https://ellenbarratt.substack.com/p/cyanotypes-multiple-exposures-and - multiple exposures and sun-dial prints (from search, not opened)

## Working example

`assets/styles/cyanotype.html`: a 10 s page (QURAN 13:28, "Whatever the sun can't reach stays pale."). Read it for the techniques; do not reuse its layout as a template.
