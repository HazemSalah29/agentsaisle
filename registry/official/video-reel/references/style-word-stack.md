# Style: word stack (kinetic type)

**Production readiness:** needs work (type only, so there is no world, place or object to carry a multi-scene story; no depth or light; the whole frame is black with a column of words)

Text is the whole graphic. Huge serif words stack down the frame, each rising into view through its own line mask, one key word scales up and turns gold, and lines wipe out through the same masks. Seen in kinetic-type practice (School of Motion kinetic type course, motion.dev text animation); no specific Islamic reel was found, so the recipe is practice-based.

## Look

- Ground: near-black `#0e0d0c`. Text: cream `#f1ebdc`. One accent: gold `#d9a441`.
- Didot bold at 140 px for ordinary words, one word per line. The key word ("not") goes to 400 px in gold.
- Dim state is cream at 18 % (ghost slots) or a muddy `#4c4a3c` (a finished or stopped word).
- Tiny sans handle at the bottom; nothing else on screen. No panels, no pictures.

## Motion

- Weight: confident and printed, with no cartoon bounce. Words rise with an ease-out-quartic, 0.75 s, `zeta` 1. The key word lands heavier: a short 8 to 10 percent scale settle (`zeta` 0.7), and the lines around it are quiet while it lands.
- Camera: a locked frame with one exception. A gentle push of 3 to 5 percent on a held beat, or a vertical slide when the stack outgrows the screen. It never rotates or tilts the type, and never blurs.
- Entering: each word rises from behind its own line mask (translateY 125 percent to 0), staggered about 0.17 s. Leaving: rises out of the top of the same mask, ease in-out, 0.5 s, shorter than the entry.
- Transformations: size and colour change on one word (cream to gold, 140 px to 400 px); a bar strikes a word and the word dims to a muddy tone; small tokens rise one by one under a giant word as the count.
- Transitions: 1) lines rise out through their masks and new lines rise in on the same ground, 2) the key word grows until it fills the frame and becomes the next scene's ground, 3) the stack scrolls up as one block and the next sentence follows under it.
- Timing feel: rhythmic, like a drum. Words land on a beat, the gold word gets the long hold (0.8 s or more), and nothing else moves while it holds.
- Never moves: the black ground and the handle. Type never skews, never fades in softly, never jitters.

## How it explains

- Story device: The story is the words alone: one word per line, stacking into a sentence.
- Arrows and flow: No drawn arrows; a gold bar that strikes through a word, or a small gold underline.
- Labels and text: One word per line in bold Didot, rising through a mask; one giant gold key word.
- Numbers and counts: A giant word like ONCE against small 'day' tokens that rise one by one under DAILY.
- Emphasis: The key word is 400 px and gold, the only large gold thing in its beat.
- Scene change: Lines rise out through the same mask and new words rise in; the black ground never changes.

## Build notes

- Build lines with a helper `line(html, y, size, tIn, tOut)`; `frame(t)` only sets transforms from t, so it stays pure.
- Mask height must be about 1.25x the font size or descenders (g, y) are clipped; the rise and exit distance must be at least 125 % or a descender peeks out as a stray mark after the wipe.
- Arabic marks (the salawat glyph) are not in Didot: wrap in a span using Scheherazade New via `@font-face` (the page loads `../ScheherazadeNew-Regular.ttf` from `assets/styles/`; next to a page, copy the font beside it).
- Render is cheap (DOM only). Sound: `tick` per word, `thud` on the key word and giant words, `tap` on the strike, `bell` on the closing caption.

## Good for (examples, never limits)

Short sayings, one-turn hadith, du'a, two-word contrasts (once vs daily).

## References

- School of Motion, kinetic typography course part 3 (unverified)
- motion.dev, text animation docs (unverified)

## Working example

`assets/styles/word-stack.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
