# Style: Pressed-flower journal

A dotted journal page on a table: washi tape goes on, a pressed flower is laid down, a torn paper label holds the Arabic, and the English is handwritten and underlined. Stop-motion on twos, like a scrapbook video.

## Look

- Table `#d8d1c0`, page `#f1e8d6` with a dot grid `#c9bda3` every 60 px, rotated -0.8 degrees, soft paper shadow, a fine grain on top.
- Washi: dusty rose `#dba3a6` stripes, sage `#a8b896` diagonal stripes, butter `#e5d2a0` plain. 74 px tall, zigzag cut ends, 88% opacity.
- Pressed flower: translucent rose petals `#d9a1a8` at 62%, thin darker veins, butter centre, sage stem and leaf.
- Type: handwriting (Bradley Hand, with Snell Roundhand and Noteworthy as fallbacks) in `#6b5a6e`, typed Courier labels for the citation and handle, Scheherazade New 128 px on a torn cream label `#fbf6ea`.

## Motion

- Everything reads `f = floor(t*12)/12`, so things land in 12 fps steps. A tape slides 60 px down onto the page, the flower tilts and settles over 0.9 s, the label slips up 30 px.
- The Arabic is written right to left in one pen reveal, in steps.
- The English is handwritten in, then a rose underline draws itself with `stroke-dashoffset`.
- The handle is a typed strip on a butter tape.

## How it explains

- Story device: A journal page that fills up: tape, a pressed flower, a label and handwriting land on it.
- Arrows and flow: A hand-drawn rose line that draws itself, or a strip of washi tape laid in a direction.
- Labels and text: Handwriting for the English, typed Courier for citations, Arabic on a torn cream label.
- Numbers and counts: Small tape strips or pressed petals added one per count.
- Emphasis: A rose underline that draws itself under the key phrase.
- Scene change: Turn to a new page, or the old items lift off and new ones are taped down; the page stays.

## Build notes

- Torn edges are `clip-path: polygon(...)` with small zigzags; a drop shadow on the clipped element is cut off, so shadows go on the unclipped parent or are skipped for tape.
- Tape stripes are `repeating-linear-gradient`, no images.
- The pressed flower is one inline SVG built in JS: six petals rotated 60 degrees each, drawn once, moved and tilted by CSS in `frame(t)`.
- Gotcha: a flower larger than about 320 px collides with the closing line. Keep it small in a bottom corner.
- Gotcha: `position:absolute` on every element, including the handle, or it vanishes into normal flow.
- Fonts: the handwriting fonts are macOS system fonts, so check them on the render machine; they are not bundled.

## Good for (examples, never limits)

A story with a place and a small human moment, a gentle reminder, a nameless "you" doing an ordinary thing.

## References

- https://paperwrld.com/blogs/paperwrlds-blog/press-flowers-scrapbook - pressed flowers with label tape and washi accents (from search, not opened)
- https://www.cottageonbunkerhill.com/pages-petals-my-diy-flower-journal/ - pressed flower journal, matte paper, vintage feel (from search, not opened)
- https://www.kapwing.com/templates/scrapbook/aesthetic - scrapbook video templates (from search, not opened)

## Working example

`assets/styles/pressed-flower-journal.html`: a 10 s page (QURAN 18:19). Read it for the tape, label and flower techniques; do not reuse its layout as a template.
