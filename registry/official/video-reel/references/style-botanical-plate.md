# Style: Botanical plate

A page from an old botanical book: engraved black ink (tapered hatching, stipple, weighted outlines) with a separate watercolour tint laid under it, a little off register, on foxed cream paper inside a double plate rule. The plate teaches by drawing: a date palm sapling grows one frond for each small day, and a red-ochre ring is painted round the key word at the end.

## Look

- Paper `#efe5cf` with fibre noise, a warm edge burn, foxing spots (multiply), a plate mark with a white highlight line.
- Ink: black, composited with `multiply` (a blurred 25 percent copy under a 92 percent crisp copy), then lifted with `lighten` to `rgb(38,30,24)` so the black is a warm dark brown.
- Tint: olive `#6d8c45` and `#58773a` for leaves, `#a98a55` trunk, `#8a6a45` soil, `#7a5230` the date stone, `#c8a25a` gold for the day marks, `#b8382c` for the emphasis ring. Each wash is offset about (2, -1.5) px from its ink and has a darker pooled edge. The whole tint layer is multiplied by a pigment-grain alpha texture.
- Type: Baskerville italic for the title and the English, small spaced capitals for the plate header, Menlo spaced capitals for the citation, Scheherazade New in ink for the Arabic.

## Motion

- The plate rules draw on, the ground mound and the date stone appear, a title in italic.
- One frond per beat (1.3, 2.1, 2.9, 3.7, 4.5 s): the trunk rises, a frond fans out, its leaflets unfurl from closed to open, and the matching ring in the row of five "day" marks fills with gold. Leaflets sway a little all reel.
- Arabic written with the pen in ink, the English in two lines, the citation, then the ring is painted round "little".

## How it explains

- Story device: Each beat is a numbered plate from a naturalist's folio, pulled fresh under the press.
- Arrows and flow: Fletched engraved arrows that follow the life-cycle of the idea.
- Labels and text: Italic plate captions and tiny numbered legends, as under a specimen.
- Numbers and counts: Counts sit in an engraved cartouche.
- Emphasis: The colourist's red wash rings the key word.
- Scene change: Each plate is pressed over the last by a roller pass; no cuts.

## Build notes

- Port the reference's engraving kit as is: `ribbonPath` (tapered ribbons), `engrave` (weight follows a shade function), `surfLines`, `outline`, `contour` (weight follows the light), `stipple`, `wash`, `bladeS`. Each leaflet is a `bladeS` blade: erase the ink under it, wash it, engrave 3 lines, a midrib ribbon, a contour.
- Keep the ink and tint layers persistent and clear them each frame. Paper and the pigment grain are built once. The grain is per pixel on a half-size canvas and stretched.
- Draw the Arabic on the ink layer so it gets the same ink treatment as the engraving. Draw the ring on the tint layer.
- Gotcha: draw a leaf order that keeps the lowest fronds last or the erase step cuts holes in the upper ones.
- Gotcha: the engraving looks best when the plant fills the plate. At first the sapling was tiny on a big blank sheet, so the frond lengths were scaled 1.3x.
- Gotcha (font): check the Arabic dots on a full-size crop with a pixel count (see the note in nouveau-card).

## Good for (examples, never limits)

Growth, constancy, small things done every day, a seed, a tree, a good word ("a good word is like a good tree"), anything that is built up slowly. Plants of the Qur'an and Sunnah suit it (date palm, fig, olive, pomegranate); draw them accurately, no invented species.

## References

- `references/prompt-botanical-plate.md`

## Working example

`assets/styles/botanical-plate.html`: a 10 s page (SAHIH AL-BUKHARI 6464, "A small deed, kept up every day."). Canvas 2D, about 3 ms per frame call.
