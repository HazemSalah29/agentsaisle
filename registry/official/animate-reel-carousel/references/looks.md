# Looks, sizes and readability

The user picks the look. Pitch from the likes in `00 - notes/context/observed/taste.md` first. Never use the page colours as a silent default: say which colours you will use, and let the user change them.

## The three looks

| Look | What it is | Who writes the slide pages |
|---|---|---|
| **Plain** | Text only, on a flat background. | `make-slides.py`, from `<animate-reel-carousel>/assets/plain.html` |
| **Themed** | The user's colours and fonts, a lead line, a progress bar, a quiet source line, the handle and the slide number. | `make-slides.py`, from `<animate-reel-carousel>/assets/themed.html` |
| **Graphic** | Drawn art in one of the reel styles, or a look the user describes, with the text on a readable backing. | You, from `<animate-reel-carousel>/assets/graphic-base.html` |

Plain and themed are quick and calm. Graphic takes longer and stops the scroll. Say this in one line when you ask.

## deck.json

`deck.json` sits in the work folder. Every look needs it, because it sets the size and the slide count.

```json
{ "look": "themed", "size": "3:4",
  "bg": "#10151c", "ink": "#f4f1ea", "accent": "#e8b04a",
  "font_head": "Georgia", "font_body": "Helvetica Neue", "handle": "@yourpage",
  "progress": true,
  "slides": [ { "lead": "Three habits", "text": "Small steps beat big plans.", "source": "WORLD HEALTH ORGANIZATION" } ] }
```

- `look`: `plain`, `themed` or `graphic`.
- `size`: `3:4`, `4:5` or `1:1`.
- `bg`, `ink`, `accent`: hex colours. Start from `colours` in brand.md.
- `font_head`, `font_body`: font names installed on the computer (in the chat edition, in the sandbox). Letters, digits, spaces and hyphens only.
- `handle`: from `handle` in brand.md.
- `progress`: `true` shows the progress bar (themed).
- `slides`: one entry per slide. `text` is the slide text, with `\n` for a new line. `lead` and `source` show only in the themed look.

For a graphic deck, `slides` still lists every slide with its text, because the renderer counts them. The text you draw lives in each `slides/NN.html`.

## Graphic

### Styles

Pitch 2 or 3 styles that differ in kind, not only in colour, from `<animate-reel>/references/style-index.md`. A user can also describe a look in their own words. Then you build it from the nearest recipes.

For each pick, draw the cover as one still, starting from the style's working page in `<animate-reel>/assets/styles/`. Never start from a blank page, because quick sketches from zero look like clip art. Put each trial in `looks/<style>/` inside the work folder: a `deck.json` with one slide and `slides/01.html`. Render it with `slides.mjs` into the same `looks/<style>/` folder. Show the stills side by side, with a pick.

A slide is a still image. Draw one moment of the style. Do not play its motion. The style pages show `@YOURPAGE`. Change it to `handle` from brand.md.

### How much drawing

Ask with 3 choices:

| Choice | `drawing:` | What the user gets |
|---|---|---|
| A drawn cover, lighter slides after it | `cover` | Slide 1 is full art. The other slides use the style's colours, type and texture, with a small drawn detail at most. |
| A drawing on every slide | `every` | Each slide has its own drawing of that slide's thought. |
| Something in between | `some` | The cover, plus drawings on the slides that need them most (often a middle turn and the last slide). |

If the user is not sure, suggest the drawn cover. It stops the scroll, and the lighter slides stay easy to read.

### The graphic slide contract

Copy `<animate-reel-carousel>/assets/graphic-base.html` to `slides/NN.html` for each slide (`01.html`, `02.html` and so on).

- **Art** goes in `#art`, an SVG or a canvas that fills the slide.
- **Text** goes in `.safe`, a box with a solid backing behind the text.
- **Size.** The base page is drawn at 3:4. For `4:5` or `1:1`, set `--h` (1350px or 1080px) and the SVG `viewBox` to match.
- **The page sets** `window.ready = true` when it is drawn, and `window.overflow` to `true` if the text does not fit. The base page already does this. Keep it.
- **Arabic:** add the `@font-face` for Scheherazade New that the base page describes, with the full path to `<animate-reel>/assets/ScheherazadeNew-Regular.ttf`.

Then run `make-slides.py`. For a graphic deck it only checks that every page exists, and it prints `missing slides/NN.html` if one is not there.

## Sizes

| Size | Pixels | When |
|---|---|---|
| `3:4` | 1080x1440 | The default. The Instagram profile grid shows 3:4, so nothing is cut off on the grid. |
| `4:5` | 1080x1350 | When the user asks for it. |
| `1:1` | 1080x1080 | When the user asks for it. |

All slides in one carousel use the same size.

## Readability

People read carousels on a phone, often in a few seconds per slide. A slide that is hard to read is a failed slide, even when it looks good.

- **Text never sits straight on busy art.** On graphic slides it sits in `.safe`, on its backing. Keep the busy part of the art away from the text.
- **Strong contrast** between the text and its backing. Light text on a dark backing, or dark text on a light backing.
- **Body text at least 40px** at 1080 wide. The plain and themed pages already use larger sizes.
- **Keep at least 72px clear** at each edge.
- **Check it at phone size.** Look at each PNG at full size, then think of it at the width of a phone screen. If a line is hard to read there, make it bigger or shorter.
- **Overflow is a failure, not a warning.** `slides.mjs` renders every slide, then exits with an error that names each slide with too much text (`text overflows slide NN`). Shorten or split that slide (ask first if the words are the user's own), then render again. Never ship cut-off text.
- **Fonts.** If the slide font looks like a plain default font, the font did not load. Pick a font that is installed, and render again.
