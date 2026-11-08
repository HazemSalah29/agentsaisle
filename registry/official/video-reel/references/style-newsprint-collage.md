# Style: Newsprint collage and ink stamp

Torn paper scraps that drop onto a desk and settle, typewriter text that types in, and red ink stamps that slam. Craft sources: Yoshinao Satoh's PAPERS (torn-paper collage), zine-workshop collage work, and the SVG feDisplacementMap/feTurbulence notes on MDN. A loud, blunt, hands-on look that suits a claim being nailed down.

## Look

- Desk: warm dark `#2b2723`, covered by tilted newsprint scraps (`#d9d1bd` family) filled with made-up filler words in small Georgia. Never real articles.
- Foreground scraps: bright paper `#f4efe2` or black `#1a1612`, torn top and bottom edges, a soft drop shadow, 1-2 degree tilt.
- Text: American Typewriter 58-62 px on paper, cream on black strips; labels in Impact caps.
- One accent: stamp red `#c8321e`, with a broken-ink texture. Ticks and stamps are inked, not drawn clean.
- A faint multiply grain over the whole frame.

## Motion

- Everything steps at 12 fps (`t` is floored to 1/12 s), which gives the cut-paper stutter.
- Scraps fall from above with a slight tilt, land, and give one small settle bounce. At the end of a beat they fall away downward.
- Text types in by character; the unrevealed rest stays in the line as hidden text so the wrapping never jumps.
- A stamp lands at scale 1.5 down to 1.0 in about 0.17 s with a `thud`; the key word (NOT) is the stamp, set inline in the typed line.

## How it explains

- Story device: A ransom-note desk: scraps of paper fall onto a dark table, one idea per scrap.
- Arrows and flow: A torn paper strip or an inked arrow stamped between scraps.
- Labels and text: Typewriter text typed in by character on bright scraps; Impact caps for labels.
- Numbers and counts: Counts as a row of stamped marks or typed numerals that land one by one.
- Emphasis: A red ink stamp thuds down on the key word at 12 fps.
- Scene change: Scraps fall away downward at the end of a beat and new ones land; stuttered, no fades.

## Build notes

- Torn edge: a `clip-path: polygon(...)` on an inner div, points jittered by a seeded PRNG (up to 9 px top and bottom, 5 px sides). Put `filter: drop-shadow` on the unclipped wrapper, or the shadow is cut off.
- Broken ink: an SVG filter, `feTurbulence` into `feColorMatrix` (alpha = -8n + 5.5) into `feComposite operator="in"`. At -11/6.1 the stamp turned to dust and the ticks looked grey; -8/5.5 keeps it readable.
- Paper grain: one static `feTurbulence` rect with `mix-blend-mode: multiply`, opacity 0.35. It is rasterised once, so it costs nothing per frame.
- Filler text: seeded syllable soup, three columns, `overflow: hidden`.
- The page is a pure function of t: scraps are built once, `frame(t)` only sets transform, opacity and typed text.
- Render cost: about 3 min for 300 frames, mostly the ink filter and many drop-shadows; fine. Fewer than 10 shadowed scraps is a good ceiling.
- ﷺ falls back from American Typewriter to the bundled Scheherazade New (`@font-face` with a relative path, so copy `assets/ScheherazadeNew-Regular.ttf` next to the page).

## Good for (examples, never limits)

Warnings, hooks, myth vs truth, "the thing people get wrong", accountability, anything that says "not this, that". Good for a one-line claim being stamped, or a count that ticks up.

## References

- Yoshinao Satoh, PAPERS (torn paper collage), yokogaomag.com (unverified, from search summaries)
- Zine collage workshop notes, Brighton (unverified)
- MDN, feDisplacementMap and feTurbulence (unverified)

## Working example

`assets/styles/newsprint-collage.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
