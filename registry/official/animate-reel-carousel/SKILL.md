---
name: animate-reel-carousel
description: "Makes a finished Instagram carousel for the user's page: PNG slides (1080x1440 by default) plus a caption ready to copy. It starts from a topic with a checked source, from the user's own text, from a finished reel, or from a saved template. The user picks a plain, themed or graphic look, and says yes at each stop. Use when the user types /video reel carousel, or says make a carousel, turn this into slides, turn this reel into a carousel, or use my <name> template."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *) Bash(python3 *) Bash(bash *)
---

# Carousel
Makes a carousel the user can post as it is: PNG slides and a caption. It works like the reel chain. Each step ends at a stop, and the next step starts only after the user says yes. Only the way a carousel is made is fixed. The text, the shape and the look are new for every carousel.

Read the niche from `00 - notes/context/declared/brand.md`. The `handle`, `voice`, `colours` and `hashtags` come from the same file. The `niche:` key is islamic, faceless, business, personal or other. The rules in "Islamic pages" below apply only when `niche: islamic`. Every other page skips that section.

Read `00 - notes/context/observed/taste.md` before step 3. Its likes, dislikes and lessons come from reels and carousels, and they shape the text and the look.

## Use when

- The user wants an Instagram carousel (PNG slides and a caption) from a topic, their own text, a finished reel or a saved template.

## Don't use when

- The user wants a video (use `animate-reel`).
- The text has no source the user can stand behind and the user will not provide one.

## Steps

Follow Start, then The flow, as written below.

## Start

The user starts in one of four ways:

| The user says | Path |
|---|---|
| "make a carousel about X" | Topic path: steps 1 to 7. |
| "turn this into slides" (with their own text) | Own-text path: skip step 2. Split the text in step 3. |
| "turn this reel into a carousel" | Reel path: follow `<animate-reel-carousel>/references/from-reel.md`. |
| "use my <name> template" | Template path: the text still comes from a topic, the user's text or a reel. Load the look from `<animate-reel-carousel>/references/templates.md`, and skip the look questions in step 4. |

The user's own words are never changed without asking. This is true for pasted text, for a reel's copy and for every fix after a render. Ask first, show the change, and wait for a yes.

Copy this list into each reply and tick it off:

```text
Carousel progress:
- [ ] 1 Folder made
- [ ] 2 Source checked (topic path only)
- [ ] 3 Shape and text approved
- [ ] 4 Look and size picked
- [ ] 5 Rendered, every PNG looked at
- [ ] 6 Slides and caption handed over
- [ ] 7 Template offered, lesson written
```

## The flow

1. **Folder.** Make `00 - notes/content/<YYYY-MM-DD>-<slug>-carousel/`. Write `script.md` there with this frontmatter: `format: carousel`, `status:` (empty for now), `look:`, `size:` and `template:` (empty unless a template was picked). Write the user's request under `## Request`. If the carousel comes from an idea note in `00 - notes/ideas/`, set `format: carousel` and `status: picked` in that note. On the reel path, the reel's idea note stays with the reel: the carousel gets its own note in step 6. Done when the folder and `script.md` exist.
2. **Source (topic path only).** Follow `<animate-reel-topic>/SKILL.md`, steps 2 and 3. Use it as it is. Do not copy it. Read each claim on its primary page: an official site, a study or a book page, read with web fetch. A search summary, a repost or memory is a lead, never the source. Write `## Sources` in `script.md`: title, URL and the quoted line for each claim. List any line the sources do not support, for the user's call. Set `status: source done`. **Stop.** Show the sources. Go on when the user says yes.
3. **Shape and text.** Follow `<animate-reel-carousel>/references/writing.md`. Pick one shape. Write one thought per slide. Slide 1 hooks. The last slide asks the reader to share or save, and names who to send it to. The topic decides the slide count, about 4 to 12. For the own-text path, split the user's text into slides and change no word. If a slide is too long, show the user two ways to split it and let them pick. Write `## Slides` in `script.md`: one numbered line per slide, with its lead and source line if it has one. Set `status: text done`. **Stop.** Show the slides as a numbered list. Go on when the user says yes.
4. **Look and size.** Follow `<animate-reel-carousel>/references/looks.md`. Skip the questions when a template was picked.
   - Ask with one `AskUserQuestion` call: **plain**, **themed** or **graphic**.
   - **Graphic:** pitch 2 or 3 styles from `<animate-reel>/references/style-index.md`, each with one still, drawn from its working page in `<animate-reel>/assets/styles/` (the same way `animate-reel-style` does it). Then ask how much drawing, with 3 choices:
     - a **drawn cover** with lighter slides after it;
     - a **drawing on every slide**;
     - something **in between** (for example the cover, one middle slide and the last slide).

     If the user is not sure, suggest the drawn cover.
   - **Size:** `3:4` (1080x1440) is the default, because the Instagram profile grid shows 3:4. Offer `4:5` (1080x1350) and `1:1` (1080x1080).

   Write `deck.json` in the folder (fields in `<animate-reel-carousel>/references/looks.md`). Write `## Look` in `script.md`. Set `status: look done`. Set the idea note to `status: building`, if there is one.
5. **Render.** Write the slides into `deck.json`, then run from your folder:
   ```bash
   python3 -I <animate-reel-carousel>/scripts/make-slides.py "00 - notes/content/<folder>"
   node <animate-reel-carousel>/scripts/slides.mjs "00 - notes/content/<folder>" "03 - export/<folder>"
   ```
   `<folder>` is the same name in both places. For plain and themed, `make-slides.py` writes `slides/NN.html` from the deck. For graphic, you write each `slides/NN.html` first, from `<animate-reel-carousel>/assets/graphic-base.html` (`<animate-reel-carousel>/references/looks.md`, Graphic). `slides.mjs` uses the same Chrome and Playwright setup as the reels: Playwright comes from `NODE_GLOBAL` (else the global npm folder), and Chrome comes from `REEL_CHROME` (else the installed Chrome). If it prints `text overflows slide NN`, that slide has too much text. Shorten or split it (for the user's own words, ask first), then render again.

   Look at every PNG at full size before you say it is done. Check that the text is easy to read on a phone, that nothing is cut off, that the fonts loaded, and that Arabic (if any) is right to left with its dots. Fix and render again anything that fails. Set `status: rendered`.
6. **Hand over.** Write the caption (`<animate-reel-carousel>/references/writing.md`, Caption). Save it as `03 - export/<folder>/caption.txt`. Give the user the path to the PNGs and show the caption in a fenced code block, so they can press copy. In the chat edition, give the PNGs as files to download. Say in one line what was not checked. Set `status: delivered`. Then do the idea note the same way as for a reel (`<animate-reel>/references/agent-caption-helper.md`, steps 6 and 7):
   - Set the idea note to `status: built`. If there is none (the user's own topic or text, or the reel path), make one first: copy `00 - notes/ideas/_template.md`, name it after the carousel in plain words, fill the keys from `script.md` (`area`, `hook`, `source`, `source_url`, `source_status`), and set `format: carousel`, `status: built`, `found_by: own topic` (on the reel path: `found_by: from reel <reel folder>`) and `created` to today. So every carousel shows on the boards.
   - Ask when the user will post it, with numbered choices: 1. Today, 2. Tomorrow, 3. Pick a date, 4. Not sure yet. Set `post_date` in the idea note to that day, as YYYY-MM-DD. For "Not sure yet", leave it empty. Set `slot` to the highest `slot` in all idea notes, plus 1 (or 1 if none has a slot). Leave it if the note already has one.
7. **After.**
   - Offer to save the look as a template (`<animate-reel-carousel>/references/templates.md`).
   - Write one lesson in `00 - notes/context/observed/taste.md`, under `## Lessons`, as one short line, newest first (the same rule as reels). Keep 30 lessons at most. Merge old ones.
   - When the user posts and gives the post link (now or in a later chat): add a row to `## Posts` in `00 - notes/ledger.md`: `| YYYY-MM-DD | [[<idea note name>]] | carousel | <link> | <one short note> |`. In the idea note, set `post_url` to the link, `post_date` to the day it went out, and `status: posted`. Write one line in `log.md`: `YYYY-MM-DD | Posted <slug> | 00 - notes/ledger.md, <idea note>`. Tell the user to run `/video reel review` in two days for the numbers.
   - When the post is two days old, ask the user for the numbers (or get them the same way as for reels, `<animate-reel>/references/rules.md`, After the user posts). Add a row to `## Stats at 48 h`. Write `N/A` for skip rate and average watch, because a carousel has no watch time.

## Status values

`script.md` frontmatter `status:` moves through `source done`, `text done`, `look done`, `rendered`, `delivered`. A folder with a status resumes at the next step. The own-text and reel paths start at `text done` once the split or the reuse is approved. A template path follows the path of its text: with a topic it runs from step 2, and with pasted text it starts at `text done`.

The idea note in `00 - notes/ideas/` moves on the boards the same way as a reel's: `picked` (step 1), `building` (step 4), `built` (step 6) and `posted` (when the user posts).

## Where things live

- **Work folder:** `00 - notes/content/<YYYY-MM-DD>-<slug>-carousel/`, with `script.md`, `deck.json` and `slides/`. It sits next to the reel folders.
- **Output:** `03 - export/<same folder name>/`, with `01.png`, `02.png` and so on, plus `caption.txt`.
- **Templates:** `00 - notes/context/declared/templates/<name>.md` (one file each). In the chat edition: one Project file, `templates.md`, copied to `00 - notes/context/declared/templates.md` (how to save, list and use: `<animate-reel-carousel>/references/templates.md`).

## Islamic pages

These rules apply only when `niche: islamic`. A page with any other niche never asks for a hadith or an ayah.

- **Source.** Every hadith and ayah is read on its primary page through `<animate-reel-topic>/SKILL.md` step 2: hadith on sunnah.com, ayah on quran.com. Follow the Source section of `<animate-reel>/references/rules.md`. Hadith: sahih or hasan only, with the grading recorded. A search snippet is a lead, not a source.
- **One reference per slide,** placed after the point. In the themed look it goes in the slide's `source` line, for example `SAHIH AL-BUKHARI 6464` or `QURAN 2:286`.
- **Own text is checked too.** On the own-text path, check every hadith and ayah the user cites on its primary page, the same way. If one is wrong or weak, tell the user what you found. Do not change their words.
- **Never a ruling.** The carousel says what the text says. It does not rule on what the reader must do.
- **Composed words never look like scripture.** A line we wrote never sits in the frame or style that a quoted ayah or hadith uses, and it gets no citation.
- **Never draw a prophet,** in any form. No six-pointed star, and no logo, stamp, seal or emblem. The same as the reels.
- **Arabic** is set in Scheherazade New (`<animate-reel>/assets/ScheherazadeNew-Regular.ttf`), with full tashkeel. Arabic placement gotchas: `<animate-reel-carousel>/references/writing.md`, Arabic on a slide.

## Shared files

- `<animate-reel-carousel>/references/writing.md`: shapes, slide rules, hooks, endings, the caption.
- `<animate-reel-carousel>/references/looks.md`: plain, themed and graphic, drawing levels, sizes, `deck.json`, readability.
- `<animate-reel-carousel>/references/templates.md`: save, list and use templates, in both editions.
- `<animate-reel-carousel>/references/from-reel.md`: turn a reel into a carousel.
- `<animate-reel-carousel>/scripts/`: `make-slides.py` and `slides.mjs`. Run them. Do not edit them per carousel.
- `<animate-reel-carousel>/assets/`: `plain.html`, `themed.html` and `graphic-base.html`.
- Reused from the reels, never copied: `<animate-reel-topic>/SKILL.md` (sources), `<animate-reel>/references/style-` and `<animate-reel>/assets/styles/` (graphic styles), `<animate-reel>/references/rules.md` (source rules and After the user posts).

## Budget

- Read only the files this step names; the rules live in `<animate-reel>/references/rules.md`, so read the sections for this step, not the whole file.
- Run each script once per change and read its report, not its source.
- Do not re-read a file you just wrote or edited.

## Output

- PNG slides (1080x1440 by default) and `caption.txt` in `03 - export/<date>-<slug>-carousel/`.

## Done when

- The user approved the text, the look and the slides, and the files are in the export folder.
