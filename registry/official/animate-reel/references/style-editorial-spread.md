# Style: Editorial spread

A quiet-luxury magazine page brought to motion: soft beige stock, a high-contrast Didone headline, hairline column rules that draw in, a drop cap, and a page turn that carries the reader from the article to the verse. The "old money" editorial look that circulates on Instagram and Pinterest (see References).

## Look

- Paper `#e8ddc9` with a radial lift (`rgba(255,250,238,.55)` centre, `rgba(120,95,55,.18)` edges). Ink `#1d1914`. One accent, oxblood `#7a1f2b`, for the italic key word and the drop cap.
- Headline: Didot (fallback Bodoni 72), 156 px, tracking -4 px, one word in italic oxblood. Body: Baskerville 34 px, 1.5 line height, two 360 px columns with a 1 px rule between.
- Verse English: Didot italic 76 px, tracking -1 px. Labels in Helvetica Neue 22 px with 8 px tracking: masthead, issue number, citation.
- Hairlines: a 2 px and a 1 px rule under the masthead (double rule), a 1 px rule closing the page.
- No shapes, no colour blocks. Whitespace is the decoration.

## Motion

- Rules draw left to right over 0.9 s. Masthead fades in 10 px.
- Headline lines rise out of a slot: `clip-path` opens from the top while the line slides up 40 px.
- Columns fade up 18 px, one after the other.
- Page turn (1.1 s, `inout`): the cover page rotates `rotateY(0 to -100deg)` around its left edge under a left-origin perspective, with a shadow gradient that deepens as it lifts. It is hidden once edge-on.
- The verse page waits underneath in a dark edge shade that lifts as the cover leaves. Arabic is written right to left, English fades up, a thin oxblood rule and the citation follow.

## How it explains

- Story device: A magazine spread: cover page, then a page turn to the verse page.
- Arrows and flow: Hairline rules and column rules, no arrowheads.
- Labels and text: Didot headline with one oxblood italic word; Baskerville body in two columns; Helvetica labels.
- Numbers and counts: Issue numbers and counts set as small Didot numerals.
- Emphasis: One oxblood italic word and the drop cap; whitespace does the rest.
- Scene change: A real page turn: the cover rotates away on its left edge over the next page.

## Build notes

- Two full-canvas `.pg` divs in a `perspective:2600px; perspective-origin:0% 50%` stage. The top one has `backface-visibility:hidden` and `display:none` past 90 degrees, so no mirrored back is drawn.
- `perspective-origin` at the left edge makes the turn look like a book page, not a card flip.
- Put the Arabic on two lines with `<br>` between words (`أَلَا بِذِكْرِ ٱللَّهِ` / `تَطْمَئِنُّ ٱلْقُلُوبُ`). One line at 124 px overflowed the canvas and clipped the first letters; never shrink Arabic below about 110 px to make it fit.
- Didot at 156 px sets 12 characters in about 860 px, so keep headline lines under 13 characters.
- Gotcha: the drop cap floats, so the first body line starts later than the column; keep the first line short.
- Gotcha: no pure-white anywhere. White reads as a screen, not paper.

## Good for (examples, never limits)

Calm reflective verses (remembrance, patience, trust), anything that wants a thoughtful, premium tone.

## References

- https://trends.daisyui.com/trend/editorial-design/ - big expressive serif, restrained colour, text rising 6 to 10 px (from search, not opened)
- https://trends.daisyui.com/trend/quiet-luxury/ - whitespace, muted neutrals, hairlines, restrained motion (from search, not opened)
- https://contentstudio.io/social-media-terms/old-money-aesthetic - cream, beige, navy palette (from search, not opened)
- https://pippit.capcut.com/templates/old-money-aesthetic - restraint, smooth pacing, editorial type animation (from search, not opened)
- https://picsart.com/template/elegant-beige-magazine-spread-poster-template-391266111030700 - beige magazine spread layout (from search, not opened)

## Working example

`assets/styles/editorial-spread.html`: a 10 s page in this style (QURAN 13:28). The cover copy is placeholder story text written for the demo. Read it for the techniques; do not reuse its layout as a template.
