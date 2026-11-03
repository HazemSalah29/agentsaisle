---
name: video-localize
description: "Part of the video library (loaded by /video, not run directly): dub a finished project into Arabic or English as a sibling folder; no other languages, no voice cloning."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video localize

Makes `<project>.ar/` (or `.en/`) beside the source project. The agent translates; scripts list the strings, check the result and write the files. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- The user asks for an Arabic or English version of a video they made.

## Don't use when

- The target is another language: no voice provider exists for it. Say so.
- The user asks for `--keep-voice self` (voice cloning) or `--lipsync`: both are refused by the script. Say what is not built; do not work around it.
- The user wants the translation called reviewed. It is a machine draft until a native speaker reads it.

## Steps

1. Run `node <skill>/scripts/localize.mjs plan <project> --to ar`. It copies assets, brand and characters into the sibling folder and writes `translate.json` (every script line and every on-screen string, with length limits).
2. Fill in each `target` in `translate.json`. Adapt idioms; do not translate word for word. Follow `references/translation.md`. Keep brand names and code as written. In Arabic, write numbers in narration as words.
3. Run `node <skill>/scripts/localize.mjs apply <new-folder>`. It lists problems (missing, too long, digits, glossary, brands); fix and run again. It is safe to repeat: it rebuilds from `source.video.json`.
4. Read `translation-review.md` with the user: it lists what was not translated (diagram labels, screen recordings with baked-in text).
5. Inside the new folder run the usual steps: `video-voice` (it picks 3arab for Arabic, Kokoro for English), `align.mjs`, `timing.mjs` (the scenes retime to the new audio), `video-captions`, `video-core` check and render, `video-qa`. Puppet videos: run `video-kids` `visemes.mjs` again.
6. Fixed-length scenes that carry narration may now be too short; `timing.mjs` and `video-qa` say so.

## Budget

<!-- include: _shared/read-budget.md -->

- Translate only what `translate.json` lists. Do not open media files.

## Output

- The new folder, the count of strings translated, the review notes, and what still needs a native speaker.
- A clear statement that lip sync and voice cloning are not available.

## Done when

- `localize.mjs apply` exits 0, `video-core` check passes in the new folder, and the user was told the translation is a draft.
- The source project was not changed.
