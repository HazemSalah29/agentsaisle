# My Reels
This folder is your reel studio. It is also your Obsidian vault and your Claude project.

You make short reels here. Claude learns your taste with every reel.

## Start of every session

1. Read `00 - notes/context/declared/brand.md`.

2. If `page_name` there is empty, stop and run the brand interview: read `references/cmd-start.md` in the `animate-reel` skill and follow it.

3. Read `00 - notes/context/observed/taste.md`.

4. Read `index.md`, and the last few lines of `log.md`.

## What the user says, and who answers

Match plain words to a helper. The helper files are `agent-*.md` and the commands are `cmd-*.md`, both in the `animate-reel` skill's `references/` folder.

| The user says | Do this |
|---|---|
| "start", "set up my page", "first reel" | `/video reel start` |
| "what should I do today", "what next" | `/video reel today` (uses the Coach) |
| "give me ideas", "new ideas", "made-up story about X" | `/video reel ideas` (uses the Idea scout) |
| "save this", "here is an article / link / note" | `/video reel save` |
| "how did my post do", "numbers", "review" | `/video reel review` (uses the Coach) |
| "make this reel", "make idea X" | `/video reel reel` (Script writer, Reel maker, then Caption helper) |
| "make a carousel", "slides", "turn this reel into a carousel" | `/video reel carousel` (the `animate-reel-carousel` skill) |
| "write a caption", "Threads post" | Caption helper |
| "update my kit", "I got an update" | Tell the user to run `aisle update animate-reel`; their notes are never touched. |

The `animate-reel-*` skills do the making. The `animate-reel-carousel` skill makes carousels. If a user says "make a reel" with no command, use `/video reel reel`.

`/video reel reel` means `references/cmd-reel.md` in the `animate-reel` skill, and so on: read that file and follow it.

If nothing fits, ask one numbered question with 2 to 4 choices. Do not guess.

## How to file notes

- Raw sources in `00 - notes/sources/` are never edited.

- Talk it through with the user first. Then file what you learned into the right notes.

- After filing, update `index.md` and add one line to `log.md`.

- Each folder has an `_index.md`. Finished or dropped notes go to `_archived/`. Your ledger stays put and is never moved.

- New idea notes copy `00 - notes/ideas/_template.md`. After each reel, add the lesson under `## Lessons` in `taste.md` as one short line, newest first. Keep it to 30 lessons at most and merge old ones.

## Where things go

- Reel folders: `00 - notes/content/<YYYY-MM-DD>-<slug>/`

- Finished videos: `03 - export/<YYYY-MM-DD>-<slug>/` (the same name as the reel folder)

- Carousel folders: `00 - notes/content/<YYYY-MM-DD>-<slug>-carousel/`

- Finished carousels (PNG slides and `caption.txt`): `03 - export/<YYYY-MM-DD>-<slug>-carousel/` (the same name as the carousel folder)

- Saved carousel templates: `00 - notes/context/declared/templates/<name>.md`

- Boards (dashboards): `01 - dashboards/`

- Never edit the installed skills (`animate-reel*`). Updates replace them. Your notes are safe.

## Style

Plain, short sentences. Warm. No em dashes. No jargon.
