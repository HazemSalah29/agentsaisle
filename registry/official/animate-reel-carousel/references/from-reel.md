# Turn a reel into a carousel

When the user says "turn this reel into a carousel", one idea becomes two posts. The carousel reuses the reel's checked source, its story and its look. It does not check the source again, and it does not pitch new styles, unless the user asks.

## What carries over

| From the reel's `script.md` | Use in the carousel |
|---|---|
| `## Sources` | Copied as it is into the carousel's `script.md`. No new check. |
| `## Copy` | The base of the slides. The user approved these words for the reel, so do not change them without asking. |
| `## Look` | The style, palette and fonts for a graphic look. |

## Full edition

1. **Find the reel folder** in `00 - notes/content/`. If the user did not name it, list the newest reels and ask.
2. **Make the carousel folder** `00 - notes/content/<YYYY-MM-DD>-<reel-slug>-carousel/`, with `script.md` (`format: carousel`), and write `from: <reel folder>` in its frontmatter.
3. **Copy the sources.** Copy `## Sources` from the reel's `script.md`. Set `status: source done`.
4. **Shape the slides.** A reel is a story told in time. A carousel is read slide by slide. Pick a shape (`<animate-reel-carousel>/references/writing.md`). Map the reel's lines to slides, one thought per slide. Slide 1 hooks. The last slide asks the reader to share or save. If a line must change to fit a slide, show the change and ask. Then the normal stop in step 3 of the flow.
5. **Keep the look.** Use the reel's style and palette from `## Look`. Ask only how much drawing (cover, every slide or in between) and the size. Suggest the drawn cover if the user is not sure. Write `deck.json` in the carousel folder with `look: graphic`, the size, and one `slides` entry (with its text) per slide.
6. **Make stills from the reel.** The reel's `index.html` draws any moment as a still:
   ```bash
   node <animate-reel>/scripts/capture.mjs "00 - notes/content/<reel folder>" stills <t1,t2,...>
   ```
   Pick the moments that show each slide's thought, from the reel's beat table in its `script.md`. The stills land in the reel folder, in `stills/t<time>.jpg`, at 1080x1920. Copy the ones you use to `slides/art/` in the carousel folder.
7. **Build the graphic slides.** For each slide, start from `<animate-reel-carousel>/assets/graphic-base.html`. Put the still in `#art` as an image that fills the slide (the SVG `<image>` with `preserveAspectRatio="xMidYMid slice"`, `href="art/t<time>.jpg"`). Crop so the main object is in view. If the still has the reel's own text in it, pick a moment with less text, or let the slide's `.safe` box cover it.
8. **Render and hand over** as in steps 5 to 7 of the flow.

## Chat edition

- **Same chat as the reel:** the source, the copy and the look are already in the chat. Use them as above.
- **A new chat:** ask the user to attach the reel's `script.md` or its MP4. From `script.md`, take the sources, the copy and the look. From an MP4 alone, read the text on screen and the citation line, and ask the user to confirm the source.
- **The art:** draw the slides again in the named style, from its working page in the reel styles. Do not try to rebuild the reel page.

## If the stills cannot be made

If the reel's `index.html` is missing or will not load, draw new slides in the same style, from the style's working page in `<animate-reel>/assets/styles/`. Tell the user in one line.

## After

Link the two posts: write `from: <reel folder>` in the carousel's `script.md`, and the carousel folder name under `## Carousel` in the reel's `script.md`.
