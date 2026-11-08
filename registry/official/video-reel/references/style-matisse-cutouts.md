# Style: Matisse cut-outs

Organic paper shapes in flat bold colour, snipped and dropped onto a cream sheet, moving at a hand-made 12 fps. The late Matisse "drawing with scissors" look that has come back across illustration and motion (see References).

## Look

- Ground: warm cream `#f4eee0` with a faint multiply grain (`feTurbulence`, 35% opacity).
- Gouache palette, matte and fully saturated: Matisse blue `#1d3fa6`, coral `#f0572e`, yellow `#f7c40c`, green `#1e7a4c`, pink `#f4a3bd`. Matisse was exact about colour and used complementary pairs: blue with orange, yellow with violet.
- Shapes are polygons of about 44 points (never smooth curves), so every edge reads as a scissor cut: lobed algae, a five-lobed star, a pointed leaf, a loose blob, and a rough rounded tile for text.
- Each shape has a soft offset shadow (6, 9 px, black at 13%) so it lies on top of the sheet.
- Type: Marker Felt, 74 px, near-black `#15120f`, centred. Arabic sits on the yellow tile.

## Motion

- Time is stepped to 12 fps (`q = floor(t*12)/12`): shapes move like paper pushed by hand.
- A shape is snipped (grows from 25% to 100% in 0.35 s), then falls from 520 px above while turning from a 40 degree tilt to its final angle.
- After landing, shapes sway about 1.6 degrees so the sheet is never dead.
- Text steps in with 5 opacity steps and a short rise, and steps off to the left.
- The yellow tile falls in last and carries the Arabic, written right to left.

## How it explains

- Story device: One sheet of cream paper; each idea is a shape snipped out and dropped on it, so the story is built by pasting.
- Arrows and flow: A cut-out strip or a string of small cut shapes, lying on the sheet, pointing from one shape to the next.
- Labels and text: Short words on a rough cut paper tile, set in marker type; Arabic on the yellow tile.
- Numbers and counts: Count by pasting one more cut shape per step, a row of identical blobs that grows.
- Emphasis: A shape in the one loud colour (coral against blue) snaps in bigger than the rest.
- Scene change: Shapes fall away downward at 12 fps and new ones drop in; the sheet stays, no fades.

## Build notes

- `poly(kind, seed)` makes each outline from a radial function plus a 5% seeded jitter. `alga` uses `1 + .42 sin(7a + seed) cos(2a)`; the leaf is a lens `x = 1.9 cos a`, `y = .5 sign(sin a)(1 - cos^2 a)^.75`, which gives pointed ends.
- The tile is a superellipse (`n = 4.2`) with jitter, scaled by its width and height in the SVG transform, so the shadow scales with it.
- A shadow is a second copy of the path under the shape. No SVG filter is used, so frames render fast.
- Keep decorative shapes on the edges and in the corners. They may run off the canvas; text stays clear of them.
- Gotcha: a leaf built as a stretched circle looks like a peanut. Build the lens directly.
- Gotcha: place the handle and citation so no shape tip crosses them; a rotated leaf tip reached the handle at first.

## Good for (examples, never limits)

Gentle instructions, mercy, nature, hospitality, anything small and kind.

## References

- https://www.designboom.com/art/tom-geraedts-matisse-cut-outs-stedelijk-museum-amsterdam-06-22-2015/ - Tom Geraedts, "The Oasis of Matisse" for the Stedelijk Museum: coloured paper forms drifting through a park (opened)
- https://artlyst.com/henri-matisse-expressive-simplistic-colour-and-pattern-painted-with-scissors/ - process: gouache paper cut and pinned (opened)
- https://eyeondesign.aiga.org/how-matisses-cut-outs-took-over-the-illustration-world/ - why the look is everywhere in illustration now (from search, not opened)
- https://www.moma.org/audio/playlist/6/308 - MoMA cut-outs audio; at least 17 oranges (from search, not opened)
- https://www.aucklandartgallery.com/explore-art-and-ideas/artwork/14897/les-quatre-rosaces-aux-motifs-bleus-four-rose-windows-with-blue-motifs - complementary colour contrasts (from search, not opened)

## Working example

`assets/styles/matisse-cutouts.html`: a 10 s page in this style (QURAN 18:19). Read it for the techniques; do not reuse its layout as a template.
