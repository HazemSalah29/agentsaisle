# Style: Watercolour sketchbook

One long sheet of cold-press paper that the camera pans along. Every picture is sketched first in pencil, then painted in layered wet washes whose edges pool as they dry. It is the slower, more studied cousin of [watercolour bloom](watercolour-bloom.md): bloom is paint spreading on one page, this is a sketchbook sheet with a pencil under-sketch, a visible drying edge and a pan between two painted stops.

## Look

- Paper `#fbf8f0` (251,248,240) with baked cold-press tooth, a faint warm tone gathering at top and bottom edges, and a few ghost washes already on the sheet.
- Washes (all multiplied onto the paper): cerulean `126,178,214`, ultramarine `64,92,168`, slate violet `142,134,172` and `92,88,142`, aureolin `250,214,90`, orange `246,150,60`, Payne's grey `86,84,112`. Wet-in-wet drops of ultramarine, rose `200,120,150`, burnt sienna.
- Pencil `70,68,76` at 10 to 30 percent, doubled lines that overshoot, construction circles and axes.
- Lettering: Bradley Hand (system font) in plum `66,48,112`, a violet drop bleeding into the letters. Arabic in Scheherazade New, plum ink `62,42,100`.
- Spaced capitals for the citation in Menlo, muted plum. Splatter of the colours used, flicked from the nib.

## Motion

- Pencil lines draw on first (a cloud outline and a tangled scribble, then a lantern with its axis and sight lines).
- A wash arrives as `cur` goes 0 to 1: it grows from 55 to 100 percent of its size about its centre while alpha rises, then its pooled rim darkens slowly over about 1.2 s more (the water drying).
- Camera pan: `cx = 540 + 1320 * inout(win(t, 3.0, 3.95))`, one smooth move along the sheet. The next stop's pencil is already waiting there.
- Ambient life: the lantern glow breathes (a warm multiply gradient), ripples spread on the pond and thin out as the reel settles.
- The Arabic is written on with the pen mask right to left in two lines, vowel marks last. English lines are brush-lettered and revealed left to right.

## How it explains

- Story device: One long sketchbook sheet; the camera pans along it from one painted idea to the next.
- Arrows and flow: Loaded round-brush strokes with pooled edges.
- Labels and text: Brush-lettered words that are rewritten as they change.
- Numbers and counts: A brush-lettered counter that is wiped out and rewritten for each count.
- Emphasis: A red alizarin circle painted round the word.
- Scene change: The camera pans along the sheet; no cuts.

## Build notes

- Bake the sheet once: three value-noise grids (2.2, 7, 40 px cells) make a height map `HM`, kept for granulation, and shade the paper. A 2400 x 1920 sheet bakes in about a second.
- Each wash is baked once into its own canvas: paint 20 to 34 deformed-polygon layers (`deform` = midpoint displacement with a per-vertex wobble weight), cut with a soft mottle, then one pixel pass does the pooled edge and the granulation (`rim = alpha - blurred alpha`, blue and violet pigments settle into the paper pits, yellows do not). The pass writes TWO canvases: the body and the rim alone. Drawing the rim at `dry^2` alpha is what animates the drying edge without re-running the pixel pass per frame.
- Negative painting: lift a ragged white halo round the lantern with `destination-out` polygon layers before the pool pass, so the halo gets a crisp pooled edge. A bloom (a ragged hole) is the same trick on a small blob.
- Gotcha: the reference blooms are spiky (`amt .35`, wobble 1.4) and read as little stars or snowflakes. Use 12 points, `amt .16`, wobble .9 so they stay round cauliflower holes. Check every still for a six-pointed shape.
- Gotcha: a wash canvas that is too tight shows a straight edge where the paint is clipped. Give each wash a margin of at least 60 px past the painted shape.
- Gotcha: the reference lettering is a per-character reveal on a canvas the width of the page. Reveal from the measured text extent (`s0` to `s1`) or the line seems to wait before it starts.
- Keep Arabic on bare paper under the picture, not on a wash.

## Good for (examples, never limits)

Hearts and states of mind: remembrance, stillness after unrest, gentle reminders, hope. Two-stop stories (a restless thing, then a calm thing).

## References

- `references/prompt-watercolor.md`. Its `exWash`, `rimPool`, `poolGran`, `exBloom`, wet-in-wet `drop` and long-sheet camera are what this recipe ports.

## Working example

`assets/styles/watercolour-sketchbook.html`: a 10 s page (QURAN 13:28). A storm cloud and tangled scribble are sketched and painted ("When the heart is restless,"), the sheet pans to a lantern over still water, the Arabic is written under it, then the English and the citation hold for about 2.5 s.
