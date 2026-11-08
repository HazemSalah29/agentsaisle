# Style: Pixel quest (8-bit HUD)

A game HUD in 4-6 colours: a 135x240 canvas scaled by 8 with nearest-neighbour, a bitmap font, XP bars, day counters and tiny sprites. No Islamic creator was found using it (the notes found none); it comes from pixel-art web craft and fits deeds as an inventory, a daily XP bar or a streak.

## Look

- Ground `#14102b` (deep indigo), panels `#2e2560`, white `#f4f1ff`, gold `#ffd34e`, green `#5be37d`. Five colours in total.
- A HUD strip across the top ("QUEST LOG", a gold star), a thin rule and a dim handle at the bottom.
- Text is a 5x7 bitmap font, centred, one pixel = 8 screen px. Key numbers are drawn at 2x ("DAY 7").
- Bars are a white frame with segmented fills (green, last segments gold). Streak slots are small squares with a flame sprite.

## Motion

- All motion reads from `f=floor(t*10)/10`, so everything moves in 10 fps steps. No easing.
- Text types in at 20 characters a second. Bars fill and drain one segment at a time.
- Scene change is a dither wipe: a checker-pattern edge sweeps down, then back up on the new scene.
- The big-deed bar fills once, then drains to a single segment. The streak counter adds one day, one flame, every 0.7 s.

## How it explains

- Story device: A game quest log: the idea is a level with bars, slots and a streak counter.
- Arrows and flow: Pixel arrows that blink along a path, or a bar that fills toward a goal, one segment at a time.
- Labels and text: Bitmap text typed in at 20 characters a second, with a HUD strip on top.
- Numbers and counts: Segmented bars and flame slots; the counter ticks by whole numbers at 10 fps.
- Emphasis: The last bar segments turn gold, or the big number is drawn at 2x.
- Scene change: A dither wipe: a checker-pattern edge sweeps down, then back up on the new scene.

## Build notes

- Canvas is 135x240 with CSS size 1080x1920 and `image-rendering: pixelated`. Draw with `fillRect` only; no text API, no smoothing.
- Glyphs are strings of 0/1 rows. The lines wrap by hand: a line holds about 22 characters.
- The salawat sign has no 5x7 grid. Draw U+FDFA with Scheherazade New on a 13x9 offscreen canvas and threshold alpha to 1 bit; it stays legible and looks pixel-made. Load the font first (`document.fonts.load`) before building it.
- Cheap to render: the frame is a few hundred rects. No render-cost problem.
- Sound: `key` while typing, `tick` per bar step, `plink` per streak day, `bell` when the bar fills.

## Good for (examples, never limits)

Daily acts, streaks, consistency over size, a deed as an inventory or a score. Works well for "small and constant beats big and once". Never show "GAME OVER" for a person.

## References

- https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look (unverified)
- https://www.joshwcomeau.com/animation/sprites/ (unverified)

## Working example

`assets/styles/pixel-quest.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template. It loads `ScheherazadeNew-Regular.ttf` from its own folder (copy `assets/ScheherazadeNew-Regular.ttf` next to it).
