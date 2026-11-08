# Style: Zellige tile

A Moroccan tile wall that assembles itself. Hand-cut glazed tiles click into an eight-point-star pattern one wave at a time, each a little uneven in colour and edge, with plaster showing between them and a slow sheen of light passing over the glaze.

## Look

- Grout and wall: plaster `#cbbd9c` with a fine grain (multiply).
- Glaze: lake blue `#1f5f8b`, turquoise `#2aa79b`, honey `#d99a2b`, tomato `#b8402c`, graphite `#33373a`, cloud white `#efe8d8`. Each tile is shifted up to 7 percent lighter or darker, so no two match.
- Pattern: 4.8.8 tiling. Octagons on a square grid (side 90, pitch 217 px), diamond squares in the gaps, and an eight-point star in every octagon (outer points on the octagon corners, inner radius 0.765 of outer) with 8 small triangles around it.
- Tile edge: a darker stroke of the tile's own colour (glaze pooling), and the tile pulled to 93.5 percent of its cell so grout shows.
- Verse panel: a cream plaster cartouche (`#efe8d8`) with a graphite frame and a tomato inner rule, sharp corners. No tiles run under it.
- Type: Scheherazade New in deep lake `#17445f`, Baskerville in graphite, tomato Menlo capitals for the citation.

## Motion

- Wave: each tile arrives at `0.3 + distance from the centre / 1100 * 2.8` seconds, stars first, then the triangles and diamonds about 0.4 s later.
- Click: the tile slides in from outward (60 px), turns up to 7 degrees and starts 10 percent big, settles with a small overshoot (`back()`), then gives one short glint as it seats.
- Sheen: after the wall is built, a diagonal band of white at up to 40 percent sweeps across the glaze, so it reads as glass-like.
- The hook sits on the cartouche from the start, the Arabic is written with the pen mask after the wall is done, and the English and citation follow.

## How it explains

- Story device: A wall of tiles being laid: stars first, then the gaps, until the wall is complete and the verse sits on a plaster panel.
- Arrows and flow: A band of tiles that fills across the wall in a direction, one row after another.
- Labels and text: Arabic written on a cream plaster panel, English in serif and citation in tomato capitals.
- Numbers and counts: Count by seating tiles one at a time; each tile clicks in with a small glint.
- Emphasis: A diagonal sheen sweeps across the glaze, and one tile shifts to the tomato accent.
- Scene change: The wall stays; tiles slide out and new tiles click in, or the camera travels over the pattern.

## Build notes

- Build the tiles once as DOM nodes (about 800 polygons) and only set `transform`, `opacity` per frame. Rebuilding strings for 800 polygons per frame works but is wasteful.
- Wobble every corner of every tile on its own (plus or minus 2.5 px). Shared corners then disagree a little and the grout varies, which is the hand-cut look.
- A static noise layer in `soft-light` over the whole wall gives the cloudy glaze variation cheaply.
- Gotcha: a six-point star tiling (hexagram) looks like a different symbol and was dropped. The eight-point star (two overlapped squares) is the traditional khatam, so use the 4.8.8 build.
- Gotcha: skip tiles whose centre falls inside the cartouche, or the star arms poke out from under its edge.
- Gotcha: Scheherazade New's marks rise high at 170 px; leave 150 px above the baseline inside the panel.

## Good for (examples, never limits)

Care, order, craft, patience, being cautious, anything built piece by piece, Maghrebi and Andalusian settings.

## References

- https://www.ziatile.com/blog/moroccan-zellige-tiles-2 - hand-cut, dipped, fired, colour varies tile to tile (opened)
- https://atelier.cole-and-son.com/products/zellige - named glazes: tomato, honey, graphite, lake blue (from search, not opened)
- https://en.wikipedia.org/wiki/Zellij - star patterns from tessellating polygons (from search, not opened)

## Working example

`assets/styles/zellige-tile.html`: a 10 s page (QURAN 18:19, "Every piece is set with care."). Read it for the techniques; do not reuse its layout as a template.
