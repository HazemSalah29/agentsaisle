---
description: Save a source (a link, an article, a video, a note or a file) and file what it teaches into your notes.
argument-hint: "<link, file, or pasted text>"
---

# /video reel save

Saves a source as it is, talks it through with you, then files what it teaches into the right notes.

Input: $ARGUMENTS (a link, a file path, or pasted text). If empty, ask the user to paste or drop it.

## 1. Read it

- A link: fetch the page. A YouTube link: get its transcript.
- A file: read it. A screenshot: read the text in the picture.
- Pasted text: use it as it is.

## 2. Keep the raw copy

Save it in `00 - notes/sources/` as `<YYYY-MM-DD>-<short-name>.md`: a small frontmatter (`type: source`, `url`, `saved` with today's date), then the content as it is. This file is never edited again, not by you and not later.

## 3. Talk it through first

Before filing anything, tell the user in 3 to 5 short lines what the source says and what it could become: reel ideas, a lesson for `taste.md`, a change to `brand.md`. Ask with buttons what to keep:

1. Turn it into reel ideas (recommended when it has a clear lesson).
2. Add a lesson or a like to my taste.
3. Just keep it for later.

Room for the user's own words.

## 4. File what was agreed

- **Reel ideas:** write idea notes from `00 - notes/ideas/_template.md` with every key filled. `source` and `source_url` point at this source. `source_status: verified` only if the source is the primary page; a repost or a summary stays `lead`. `found_by: save`.
- **Taste:** one short line under `## Lessons`, `## Likes` or `## Dislikes` in `00 - notes/context/observed/taste.md`. 30 lessons at most; merge old ones.
- **Brand:** only with the user's yes on the exact change.
- Link each new note back to the source with `[[<source file name>]]`.

## 5. Update the map

- Add a line to `index.md` for the source and for any new note.
- Add one line to `log.md`: `YYYY-MM-DD | Saved <source>, filed N notes | <files touched>`.

End with what was filed, one line per file.

## Rules

- Never edit a file in `00 - notes/sources/` after it is saved.
- Never invent what a source says. Quote it.
- Plain, short sentences. No em dashes.
