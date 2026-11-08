# Style: chapter cards (one thing, a few layers)

One object, word or saying is opened layer by layer. A thread of beads at the top shows which layer you are on, one framed card holds a gold line drawing and its Arabic, and at the end every card lines up in a row.

## Look

- Ground: near-black olive `#0f1310`. Card: `#151a15`, radius 22, gold hairline at 35 %.
- Headline: Baskerville 70 px cream, key words gold italic `#dcb064`, at the top (y about 330).
- Bead thread at y 268: a gold line with one bead per layer. Past beads are filled, the current one grows and glows, and the layer word sits on the right in Menlo caps.
- Drawings: gold strokes, width 5, round caps. Arabic in Scheherazade New under the drawing.

## Motion

- Hook: headline only ("One saying. Three layers."), the empty beads fade in.
- Each layer: the bead lights, the headline swaps, the drawing strokes itself in, then the Arabic is written with the pen. The card frame stays put, only its content swaps.
- End: the big card shrinks into the middle of a row of small cards, one per layer, each with its drawing and Arabic. Then the citation.
- A soft glow breathes behind each drawing, so the holds never go still.

## How it explains

- Story device: One idea split into numbered layers; the bead thread shows where we are.
- Arrows and flow: A gold bead moves along the thread from layer to layer.
- Labels and text: Baskerville headline with gold italic key words; layer word in Menlo caps.
- Numbers and counts: The beads count the layers; the day count sits in the card.
- Emphasis: The current bead grows and glows; the key words turn gold italic.
- Scene change: The frame stays put and only its content swaps; the card shrinks into a row at the end.

## Build notes

- Give every icon path `pathLength="1"`, then `stroke-dasharray="1"` and `stroke-dashoffset="1-p"` draw it with no length math.
- Arabic pen reveal: one pass right to left over the full height, body without tashkeel, then the full text cross-fades in (same rule as qalam-sketch).
- Pass `t` into every helper: one helper that read `t` from outside threw on every frame and the capture came back black after the hook.
- Keep it to 3 to 5 layers. More than 5 makes the recap row too small to read.
- Sound: `tap` and `tick` as a bead lights, `key` while the Arabic writes, a `plink` panned to the bead, a `bell` on the recap. Bed: air or breeze.

## Good for (examples, never limits)

One thing with several meanings: a word with layers, a hadith in parts, one object in several stories (the staff, water, the night), "3 signs of", "4 things that".

## Working example

`assets/styles/chapter-cards.html`: a 10 s page in this style (Sahih al-Bukhari 6464, three layers). Read it for the techniques; do not reuse its layout as a template. It loads `../ScheherazadeNew-Regular.ttf`.
