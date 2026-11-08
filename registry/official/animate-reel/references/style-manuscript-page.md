# Style: manuscript page and split-flap

A single parchment leaf on a dark desk, framed like a hadith manuscript: double border, a small red cartouche naming the source, the quote set in a book serif with a highlight that sweeps the word being read. The idea then lands as a ruled tally on the page, and one short caption arrives as split-flap cells. Seen as a practice (not a specific reel) in the text-as-graphic family notes (`_scout/2-type.md`, style 3: "Mushaf page / flap"; practice-based, no single reel found).

## Look

- Desk `#241b14`; leaf `#efe3c8` with a faint stain speckle, 940 x 1420, slight 1.2 % push-in over the reel.
- Double border in ink `#2b1d12` (4 px outer, 1.5 px inner) with solid square corner studs.
- Cartouche: a notched hexagon band in oxblood `#8a2b1c`, small tracked caps ("SAHIH AL-BUKHARI 6464"). It names the book only. No ayah markers, no surah header, no Arabic ornament, so it reads as a hadith leaf, never a mushaf.
- Text: Baskerville 56 px, centred, faint ruling lines under each line. Highlight is a soft ochre block behind the current word.
- Tally: two rows of seven empty day boxes. A red wax-style seal fills one box (the big deed); small green ink ticks fill box after box (the small deed).
- Caption: dark split-flap cells (Menlo bold, hairline across the middle), English only, `#efe3c8` on `#2b1d12`.

## Motion

- Words arrive one by one (about 0.27 s each) with a tiny rise and the ochre highlight sweeping along; after the hook the whole quote dims to 60 %.
- Seal stamps in with a scale from 0.4 and a thud; the other boxes of that row get faint dashes (nothing happened).
- Ticks draw themselves with stroke-dashoffset every 0.6 s; a thin green line grows beneath the row.
- Flap cells scramble through seeded random letters for about 0.5 s each, staggered left to right, then settle.

## How it explains

- Story device: A single hadith leaf on a desk, the quote read word by word, then a tally of days.
- Arrows and flow: None; the tally boxes filling in order is the flow.
- Labels and text: Baskerville on ruled lines; split-flap caption cells in English only.
- Numbers and counts: Two rows of seven day boxes; ticks draw in one by one.
- Emphasis: An ochre highlight sweeps the current word; the rest of the quote dims.
- Scene change: The split-flap cells scramble and settle on the next caption; the leaf stays.

## Build notes

- Keep the text as HTML spans (real font metrics, easy highlight) over an SVG page; rebuild both from `t` each frame.
- Flap: no accumulated state. Each cell derives its letter from `hash(cell, floor(t*16))` and a `scaleY(|cos|)` flip per step, so it is a pure function of `t`.
- Pitfall: seven boxes at 130 px overflowed the inner border; size the grid from the border width (here 100 px + 14 px gaps).
- Pitfall: ruling lines must sit below descenders; set them from the text top plus line height, not by eye.
- Render cost is low (SVG + DOM, about 2 minutes under parallel load).
- Sound: `key` per word (quiet), `slide` when the tally appears, `thud` for the seal, `tick` per day, `tap` then `bell` for the flap.

## Good for (examples, never limits)

Direct quotes, hadith with a clear source, counted or day-by-day ideas, anything where the "document" feeling adds weight. Never put Qur'an ayat on this page: it would imitate a mushaf.

## References

- https://github.com/socketopp/svelte-split-flap (split-flap cell technique; unverified)
- Framer "flap split reveal" component (flap reveal idea; unverified)

## Working example

`assets/styles/manuscript-page.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
