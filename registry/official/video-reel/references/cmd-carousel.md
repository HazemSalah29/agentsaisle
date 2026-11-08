---
description: Idea to finished carousel, then the caption. Give a topic, your own text, a finished reel, or a template name.
argument-hint: "[topic | \"my text\" | reel folder | template name]"
---

# /video reel carousel

Makes one carousel from start to finish: the source check, the slides, the look, the PNG files, then the caption.

Input: $ARGUMENTS (a topic, your own text in quotes, a reel folder name, or the name of a saved template). If empty, ask with buttons: a topic from the idea list, "I have my own text", "turn a finished reel into a carousel", or "use a template".

The skill asks the user at each stop, so do it here in the chat. Do not hand it to a background helper.

## Before you start

1. Read `00 - notes/context/observed/taste.md`. Keep its lessons, likes and dislikes in mind at every step.
2. Read `00 - notes/context/declared/brand.md`.
3. If `## Posts` in `00 - notes/ledger.md` has a post that is 48 hours old with no row in `## Stats at 48 h`, say so in one line and offer `/video reel review` first. Carry on if the user says no.
4. If `00 - notes/context/declared/templates/` has saved templates, list their names when the user has not picked a path.
5. **Resume.** If a carousel folder for this idea already exists in `00 - notes/content/` (the name ends in `-carousel`), read the `status:` in its `script.md` and carry on from the next step.

Show this list in each reply and tick it off:

```text
Carousel progress:
- [ ] 1 Folder made
- [ ] 2 Source checked (topic only)
- [ ] 3 Slides approved
- [ ] 4 Look and size picked
- [ ] 5 Rendered and checked
- [ ] 6 Slides and caption handed over
- [ ] 7 Template offered, lesson saved
```

## Make the carousel

Read `<video-reel-carousel>/SKILL.md` and follow it. It does steps 1 to 7 and stops for the user's yes after the source, the slides and the look.

The work folder is `00 - notes/content/<YYYY-MM-DD>-<slug>-carousel/`. The PNG files and `caption.txt` land in `03 - export/<same folder name>/`.

## The end

Give the path to the PNG files and the caption to copy. Say in one line what was not checked, and what to do next.

When the user posts, do step 7 of the skill: add a row to `## Posts` in `00 - notes/ledger.md` with `carousel` in the `format` column, and set the idea note to `status: posted` with `post_url` and `post_date`. Carousels count the same as reels in `/video reel review` and `/video reel today`.
