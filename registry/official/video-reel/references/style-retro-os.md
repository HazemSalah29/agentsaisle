# Style: retro OS desktop

A 1990s-style desktop parody: teal wallpaper, grey bevelled windows with navy title bars, block progress bars, a stepped pixel cursor, dialogs that pop. Seen as the "Instagram for Win95" GIF genre (Misha Petrick, covered by Vice). Generic only: no logos, no product names, no start-menu branding. Reads as comedy-tech, so the content stays plain and the tone gentle.

## Look

- Desktop `#008080`. Window face `#c0c0c0`. Bevel: white top-left, `#404040` and black bottom-right, 2-4 px steps.
- Title bar navy `#000080` with white bold text; an inactive window turns `#808080`. Two small raised buttons (minimise, close) at the right.
- Text: Menlo bold, 28-44 px, black on grey or white. Secondary text `#404040`, never lighter (low contrast on grey).
- Sunken white field for the text document and the progress bar; progress blocks are navy, with gaps.
- Taskbar along the bottom (raised grey, a "Start" button, a sunken tray holding the handle). Two yellow folder icons top left.
- Cursor: a black arrow built from 4 px squares with a white edge.
- Accent: one acid green `#00e000` for "alive" cells (the daily-task grid).

## Motion

- Windows pop: 0.17 s of a dashed white outline at the final rectangle, then the full window appears. No fade, no scale.
- Cursor moves along keyframes with `inout`, time quantised to 6 fps and position snapped to 8 px, so it steps.
- Text types in a few characters at a time with a blinking block caret.
- Progress fills in whole blocks; counters tick as integers.
- The big task reaches 100 %, shows a small "complete" dialog, and its window goes inactive grey and stays. The small task keeps counting to its last day and prints "done. Scheduled again tomorrow."

## How it explains

- Story device: An old desktop: each idea is a window with a title bar, a progress bar and a taskbar below.
- Arrows and flow: A black pixel cursor that moves in 8 px steps, then clicks the target.
- Labels and text: Bold monospace text typed in with a block caret, black on grey.
- Numbers and counts: A progress bar that fills in whole navy blocks and integer counters that tick.
- Emphasis: A small dialog box pops up ('complete'), or a window goes inactive grey.
- Scene change: Windows pop open from a dashed outline with no fade; the desktop stays under them.

## Build notes

- Everything is SVG rects with `shape-rendering:crispEdges`; helpers `raised`, `sunken`, `win`, `btn`, `bar` draw all the chrome. No images, no pixel font file.
- Pure function of `t`: `n = floor(214 * ease(k))` for the counter, `floor(frac * blocks)` for the bar. Rebuilding the whole SVG string each frame is cheap (render ran about 2 min for 300 frames).
- Menlo is not a pixel font. It still reads as terminal-era; for a stricter look, draw a 5x7 bitmap font as rect grids.
- The honorific glyph renders small in Menlo (fallback font). Check it in a still.
- Keep windows from overlapping unless a dialog is meant to cover; size window heights to their content, not to a spare constant.
- Sound: `key` while typing and for bar blocks, `tick` for the day counter, `drop` for a window opening, `thud` at 100 %, `plink` for the dialog, `bell` for the final "done".

## Good for (examples, never limits)

Screen time versus salah, a habit that survives versus an event that ends, streaks, "scheduled again tomorrow" as consistency, notifications, small recurring deeds. Never put a hadith or ayah text inside an error window; keep it in a plain document window. No jokes about Allah, death or the grave; avoid "fatal error" and "game over" framings.

## References

- Vice on Misha Petrick's Instagram-for-Win95 GIFs (unverified, from the scout notes): the genre this style comes from.
- MDN "Crisp pixel art look" (`image-rendering: pixelated`) (unverified): for a canvas pixel-grid variant.
- joshwcomeau.com animation and sprite notes (unverified): stepped, frame-quantised motion.

## Working example

`assets/styles/retro-os.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
