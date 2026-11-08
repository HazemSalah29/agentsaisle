# Style: hand-drawn

**Production readiness:** needs work (type sits small in one corner with the rest of the frame empty; flat ground with no light, depth or camera; only one doodle scene proven)

Feels personal, like a notebook or a chalkboard.

## Look

- Ground: dark charcoal paper, warm (`#1b1a17` to `#24221d`), with a faint paper grain.
- Ink: chalky off-white `#ecebe4`; one muted accent if needed (dusty gold or soft red).
- Type: handwriting. On this Mac: Chalkboard SE, Bradley Hand, Chalkduster. Large (60-80 px), left or centre aligned, sometimes written word by word.
- Drawings: simple objects (a jar, a candle, a person, a clock), uneven strokes, visible overshoot at corners.

## Motion

- Weight: light and quick. Doodles are drawn, not dropped, so there is no spring on the lines; anything that lands (a stamped circle, a tally mark) settles with `zeta` 0.5 to 0.6 and a 2 to 3 px bounce at most.
- Strokes draw on with dash animation, uneven speed along the path: slow at corners, fast on straights, a small overshoot past the corner.
- Boiling: redraw the wobble every 0.12 to 0.15 s with an `feTurbulence` + `feDisplacementMap` filter whose `seed` comes from `t` (`floor(t / 0.13)`). The boil never stops, so a held drawing still feels alive.
- Camera: the page is a sheet under a lens. It pans and pushes in slow eased drifts (under 6 percent) toward whatever is being drawn, and travels sideways to the next doodle. It never rotates, never shakes, never zooms through the paper.
- Entering: things are drawn on, written word by word, or pasted as a quick sketch. Leaving: crossed out, scribbled over, or rubbed away from one edge. Nothing fades in as a soft blob.
- Transformations: a doodle redraws itself into the next one by erasing a few strokes and drawing new ones; a circle becomes a clock face; a tally row grows one scratch at a time.
- Transitions: 1) the page is wiped by a hand-rubbed smear from one side, 2) the camera slides along the sheet to a fresh patch of paper, 3) the sheet is crumpled up and a new one is under it (flat fold shapes, no blur).
- Timing feel: word-by-word writing at about 0.18 to 0.25 s a word; a held thought at least 0.6 s; the whole feel is human and slightly imperfect, never metronomic.
- Never moves: the paper grain and the ground tone. Text never slides on a straight line after it is written.

## How it explains

- Story device: A simple doodled object acts the idea out, line by line.
- Arrows and flow: Wobbly hand-drawn arrows that draw on with uneven speed.
- Labels and text: Handwriting in chalky off-white, written word by word.
- Numbers and counts: Tally marks or numbers scratched in by hand.
- Emphasis: Circle, underline or cross out by hand; the lines boil.
- Scene change: Wipe the page or draw the next doodle beside the last.

## Build notes

- For a fuller inked look (wobbly variable-width lines, hatching, a gouache wash, one lamp lighting the room), use the ink kit in `assets/ink/` and see [lamp-ink.md](lamp-ink.md).

- Filter: `<filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="S"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter>`; set `seed` to `Math.floor(t / 0.13)`.
- Apply the same filter to handwriting text for a chalky edge.
- Grain: a fixed noise layer (canvas filled once with seeded random dots at 4-6 % opacity).
- Sound: `key` at low gain as a pencil-scratch stand-in, `tap` for each word, `drop` for an object landing.

## Good for (examples, never limits)

Personal reminders, lists ("3 ways to..."), feelings, the inner life.

## Working example

`assets/styles/hand-drawn.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
