# Style: pen stroke (Arabic calligraphy written on)

Real Arabic text that looks written live: a gold pen nib travels right to left along the baseline and the letters appear behind it, with dots and vowel marks landing last. Craft notes come from a scout of text-as-graphic motion (stroke-dashoffset handwriting, Tegaki's Amiri skeletons); no specific Islamic reel was found using it, so treat the look as practice-based.

## Look

- Ground: deep green-black `#0d1f19`, thin gold frame inset 40 px at 35 % opacity.
- Ink: warm ivory `#efe6cf` for the Arabic; gold `#d9b45a` for the nib, the key English phrase and labels.
- Arabic is Scheherazade New at about 124 px, two lines, centred, with full tashkeel. English hook in Baskerville above, gold italic on the key phrase.
- Small Menlo labels, a handle at the bottom.

## Motion

- Pass 1 (body): a mask edge sweeps right to left over a thin band around the baseline, so only the letter bodies show, like a first pen stroke. The nib bobs on the edge.
- Pass 2 (marks): a second, faster sweep over the full line height reveals dots, hamza, shadda and harakat. Each line ends with a `plink`.
- `key` ticks every 0.22 s during writing; a `bell` after the last line.
- Later beats can use the same ink language: a tall gold bar once, then small ivory bars every day.

## How it explains

- Story device: The pen is the narrator: the line is written in front of you, body first and marks second.
- Arrows and flow: A gold ink line that draws itself with the nib riding its tip.
- Labels and text: Ivory Arabic with full diacritics written right to left, English hook above in a serif.
- Numbers and counts: A tall gold bar for the big thing, then small ivory bars, one per day.
- Emphasis: One gold phrase in italic; the nib bobs and a bell rings at the last line.
- Scene change: Same dark ground throughout; the line fades and the next line is written in the same place.

## Build notes

- No stroke paths needed. Draw one `<text direction="rtl" text-anchor="middle">` and show it through an SVG `<mask>` holding a slanted polygon whose front x is a pure function of t. The slant (60 px) makes the edge read as a pen, not a wipe.
- Two masks per line: body band (about -95..+30 px from the baseline) and full height. Tune the band per font size; check that no dot or mark leaks into pass 1.
- Joins are correct because the browser shapes the whole string; never split the text per letter.
- Traps found on the souls reel (2026-10-24): a band that is too short cuts the bottom of ح and ج off with a straight edge, so the full-height band must cover every letter at every frame, not only after the pass. A second sweep for the marks made the nib write line 2 twice: write each line once, then bring the vowel marks in on their own layer (body text with the tashkeel stripped, then the full text faded in over it). The letters' own dots ride with the body layer.
- Load Scheherazade New with `@font-face` (`ScheherazadeNew-Regular.ttf` next to the page) and wait on `document.fonts.load` before `ready`.
- Render cost is low (one innerHTML rebuild per frame, no filters).
- Option to check later: Tegaki (github.com/gkurt/tegaki) ships stroke skeletons for Amiri for true pen paths; licence unchecked, nothing downloaded here.

## Good for (examples, never limits)

Short verses, hadith texts, du'a, names of Allah, a bismillah, any line where the Arabic itself is the lesson.

## References

- github.com/gkurt/tegaki (unverified, Amiri skeletons for handwriting reveal)
- svgator handwriting tutorial (unverified, dashoffset technique)
- khoshnus (unverified, calligraphy reference)

## Working example

`assets/styles/pen-stroke-calligraphy.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template. It loads `ScheherazadeNew-Regular.ttf` from the same folder; copy it from `assets/ScheherazadeNew-Regular.ttf`.
