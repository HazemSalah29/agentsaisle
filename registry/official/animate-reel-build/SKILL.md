---
name: animate-reel-build
description: "Step 5 of the /animate-reel chain for the user's page: builds the approved storyboard as an HTML page animated as a pure function of time, shows a live preview with sound, checks and scores stills and motion clips, renders the 1080x1920 MP4 with sound and poster, runs the flash, sync and loudness checks, and delivers. Use only when the /animate-reel gate or animate-reel-storyboard hands off, or when the user asks to rebuild, re-render or deliver a reel."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *) Bash(python3 *) Bash(bash *)
---

# Reel build
Turns the approved storyboard into the final MP4. Reads `script.md` (`## Beat table`, `## Look`) and `storyboard.html`. Shared rules: `<animate-reel>/references/chain.md` and `<animate-reel>/references/rules.md`, sections "Build and look", "Sound", "Deliver" and "After the user posts". Scripts live in `<animate-reel>/scripts/` (called `S/` below).

## Use when

- `animate-reel-storyboard` hands off step 5, or the user asks to rebuild, re-render or fix a reel.

## Don't use when

- The storyboard is not approved.
- The user wants AI video or AI images; reels here are motion graphics drawn in code.

## Steps

```text
Build progress:
- [ ] 0 Rules read
- [ ] 1 Built: every beat plays
- [ ] 2 Live preview seen by the user
- [ ] 3 Stills and motion clips checked and scored
- [ ] 4 Rendered with sound
- [ ] 5 Final MP4 checked, rules ticked, delivered
```

0. **Read the rules first,** even when this step runs alone, because the numbers live only there. Read "Fixed for every reel" and "Brand constants" in `<animate-reel>/references/chain.md`, and the "Build and look", "Sound" and "Deliver" section of `<animate-reel>/references/rules.md`. If the reel folder has no `rules.md`, copy it there. Done when read.
1. **Build** `index.html` in the reel folder. It exposes `frame(t)` as a pure function of time (all randomness seeded) and pushes sounds into `window.SFX`. Reuse the storyboard's drawing code; start hand-built scenes from `<animate-reel>/assets/starter.html`; ready-made screens and transitions are in `<animate-reel>/references/screens.md`; motion numbers and easing in `references/look.md`. A helper gets a fresh brief, never a fork of the chat (a fork carries the whole conversation and builds nothing better). Done when every beat plays. When the reel shows Arabic, copy `<animate-reel>/assets/ScheherazadeNew-Regular.ttf` next to the reel's `index.html` (the starter loads it from the same folder).
2. **Preview.** The SFX Kit and the kit sounds come from the installed packs `animate-reel-sounds` and `animate-reel-sfx-1` to `-4`; `mix.py` finds them next to this skill and nothing is downloaded. If a pack is missing, pick a sound of the same feel from the packs that are installed, or use none, and tell the user in one line. Then `node S/preview.mjs <folder> [port]`, open it with the built-in browser's `preview_start` and give the user the link. It plays live with sound and reloads on save. Done when the user has seen it. Stop the server when the step ends.
3. **Stills and motion.** `node S/capture.mjs <folder> stills <t1,t2,...>` at the start, middle and end of each beat, then `node S/sheet.mjs <folder>/stills`; open every questionable still at full size, Arabic dots by pixel count. A good still can hide bad motion, so also run `node S/capture.mjs <folder> clip <t0-t1,...>` for the hero sequence and every scene change: it writes `clips/<range>.mp4` and a strip of every 2nd frame, `clips/<range>.jpg`, where the spacing between frames shows easing, weight and overshoot. Look at each strip. Then a cold reader scores it (`<animate-reel>/references/review.md`, part B): a fresh helper that sees only a pack of the stills sheet, the strips, key stills and `WORDS.md`, never the chat or the code. It scores 1 to 10 through four lenses, as a strict senior team would: **story** (pictures and words work together, the hero sequence shows what the words do not), **art direction** (composition, what the eye sees first, type, colour, depth, one consistent world), **motion** (nothing mechanical, weight feels real, every camera move and transition has a reason, no effect without a job), **phone viewer** (reads at a glance, the first 2 s pull in). Write its scores (marked `cold reader`) and its worst 3 problems in `script.md`, fix those 3, each with a fix card and a scope check (review.md), and re-capture only what changed. Each round gets a new reader. A fix that would change something the user already saw and approved (in the storyboard or the live preview) is asked first, in one line: what changes and why. Fixes to things the user never saw (a cut-off dot, a text clash) go ahead. Stop at all 8 or more, or after 2 rounds, and say what still scores low. One full still check, never a second one. If a still fails a fixed rule, return to step 1. Optional: other styles side by side, `<animate-reel>/references/variants.md`.
4. **Render.** `bash S/render.sh <folder> [poster-seconds]` (in the background). It writes `reel.mp4` and `poster.jpg` to `03 - export/<YYYY-MM-DD>-<slug>/` in the kit folder, with the poster as frame 0. Read its report: every `TOO LOUD` line is a sound to lower in the page; with a voice, test the levels on a copy with `python3 S/mix.py <copy> <copy>` before rendering again. Done when the report prints no `TOO LOUD` line and the peak passes (rules.md, Sound).
5. **Deliver.** `node S/readcheck.mjs <folder>` (every text held long enough to read; the page must expose `window.TEXTS(t)`, contract at the top of the script): fix each FAIL before delivery. `python3 S/pacing_check.py <out>/reel.mp4` (in the background): look at each flagged spot and the strips it writes; frame 0 is the poster, which is planned. Read its sync report. Make the contact sheet it prints and look at it. Write the packaging in `script.md`: cover text and one short caption carrying the comment ask (rules.md, Deliver). Save each caption to a file and run `python3 -I S/caption_check.py <file>` (add `--platform youtube` or `threads`, and `--parable` for a parable; it reads the hashtags from `00 - notes/context/declared/brand.md`); fix every FAIL and say each WARN out loud. Tick every box in the reel's `rules.md`. Give the user the path, the packaging, the direction in one line, and what was not checked (nobody but the user listens to the sound).

**Fixing after the user has seen it** (a note on the preview or the render, or a check FAIL). Write a fix card first (`<animate-reel>/references/review.md`): the cause, the scope, what stays, and the proof. Show it in the reply. Save `index.before.html`, make the fix, then run `node S/capture.mjs <folder> scope index.before.html <ranges>`: every frame outside the scope must be identical. A re-render still waits for the user's yes.

**Stop.** The reel is done when the user has the path. After they post, follow "After the user posts" in `rules.md`.

## Budget

- Read only the files this step names; the rules live in `<animate-reel>/references/rules.md`, so read the sections for this step, not the whole file.
- Run each script once per change and read its report, not its source.
- Do not re-read a file you just wrote or edited.

## Output

- `reel.mp4` (1080x1920, 30 fps, with sound) and `poster.jpg` in `03 - export/<date>-<slug>/`, the check reports, and the scores in `script.md`.

## Done when

- The render passed the loudness, flash, sync and readability checks, the cold reader scored it, and the user has the path.
