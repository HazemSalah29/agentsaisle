# Style: Swiss grid poster

**Production readiness:** needs work (abstract shapes and bold type only, no places or people; one flat palette; reads as a poster loop, not a story world)

An International Typographic Style poster brought to motion: a visible modular grid, one huge bold sans word at a time, and primary-colour shapes that slide in along the grid and lock to it. Seen in Swiss and Bauhaus kinetic poster work (Mat Voyce's grid loops, Jon Yablonski's animated Swiss posters, Swissted motion; see References).

## Look

- Ground: warm off-white `#efece3`. Hairline grid in black at 13% opacity: 6 columns by 8 rows of 150 px, starting at x 90, y 270.
- Palette: ink `#111111`, red `#e03a2b`, yellow `#f2c230`, blue `#1f4aa8`. Spend one colour per idea: black square for the heavy thing, yellow circle for the light one, red for the word that answers.
- Type: Helvetica Neue 700, 210 px, tracking -8 px for the giant words, flush left on the grid. Verse English in Helvetica Neue 700 at 76 px. Small labels 24 px, 7 to 9 px tracking, caps.
- Shapes are only squares, circles and bars. No gradients, no shadows, no texture.

## Motion

- Weight: everything is rigid and graphic. Slides use `zeta` 0.8 with a small overshoot (`1.1` back-ease) so a block locks onto its grid line. Type uses `zeta` 1, no bounce.
- Camera: none in the usual sense. The grid itself is the camera: the poster can pan one cell, or the whole grid can zoom to a cell that becomes the next page. It never tilts, rotates or goes 3D.
- Enter: lines grow from the top-left corner over about 0.9 s, shapes slide in straight along a grid line, words wipe in from their left edge with a 60 px slide. Leave: words wipe off to the left, shapes slide out along the line they came in on.
- Natural transformations: a square becomes a circle by corner radius, a shape shrinks to a quarter and parks in a cell as a mark, a block splits along the grid into two, a number counts up in place.
- Transitions: a block of colour slides across and the next page is revealed behind it; the grid scrolls one module and a new row takes the poster; a cell zooms to full frame and becomes the next page.
- Timing feel: sharp and rhythmic, on a beat. Moves of 0.3 to 0.5 s, then a clear hold of 0.6 s or more so the word can be read.
- What never moves: the grid lines, the margins, the baseline of the type. Only one or two things move at once.
- Limit to know: the look carries ideas, contrasts and counts very well. For places and people, mix in line art or a flat-colour silhouette on the grid.

## How it explains

- Story device: A poster grid where one colour carries each idea: black square for the heavy, yellow circle for the light, red for the answer.
- Arrows and flow: A straight bar that grows along the grid and stops on a grid line.
- Labels and text: Giant Helvetica words flush left on the grid, small caps labels, nothing decorative.
- Numbers and counts: A row of identical squares or bars filling cell by cell; big numerals set at poster size.
- Emphasis: The word that answers is set in red; a shape locks in with a small overshoot.
- Scene change: The shape group shrinks to a mark in the top-left cell while the next text takes the poster; the grid stays.

## Build notes

- One SVG for grid and shapes (rebuilt each frame), plain divs for text. Shape group is one `translate + scale`, so the park-to-corner move is two numbers.
- Keep the overshoot to 10%. Larger and it reads as bouncy, which is the wrong register for this style.
- Put the Arabic in its own right-aligned div (`direction:rtl`, `right:90px`) so it hangs off the right grid edge while English stays flush left. The contrast is part of the look.
- Gotcha: the big words are 210 px and must be set to `display:none` until their cue, or their clip box shows a sliver at t=0.
- Gotcha: `clip-path: inset(... left%)` reveals right to left only if the left inset is the animated value; animate the right inset and it runs the wrong way.

## Good for (examples, never limits)

Pairs and contrasts (hardship and ease, now and later, one and many), definitions, short sayings, anything with two nouns that can be shapes.

## References

- https://www.webdesignerdepot.com/2016/01/swiss-in-css-animating-the-international-typographic-style/ - posters rebuilt as layered CSS motion; grid suits rectilinear animation (opened)
- https://abduzeedo.com/type-motion-mat-voyce-animates-experimental-kinetic-typography-stickers - strict modular grid, centred characters, negative space doing work (opened)
- https://wearefevr.com/the-influence-of-swiss-design - Swiss design in motion graphics, Swissted video (from search, not opened)
- https://dribbble.com/petebarr - Swissted animation work (from search, not opened)
- https://www.monash.edu/mada/student-work/master-of-design/2025-midyear/interaction-design/piyush-darak - Bauhaus-led primitive shapes in a loop (from search, not opened)

## Working example

`assets/styles/swiss-grid-poster.html`: a 10 s page in this style (QURAN 94:5, hardship and ease as a black square and a yellow circle). Read it for the techniques; do not reuse its layout as a template.
