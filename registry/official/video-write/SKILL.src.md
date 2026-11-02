---
name: video-write
description: "Part of the video library, used by the video skill (not run directly). Write the script, brief, sourced facts, 5 alternative hooks and storyboard for a short video in explain, story or kids mode, in English or Arabic. Use for any video script or storyboard. Don't use to invent statistics or testimonials."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video writer

Writes the text files a video is built from, then checks them with a script. The agent writes; `write-check.mjs` judges the structure, the sources and the Arabic rules. `<skill>` below is the folder that holds this SKILL.md. Only `explain`, `story` and `kids` modes exist; say so if asked for another.

## Use when

- The user wants a script, storyboard or hook for a short video (explainer, story or kids).
- A `projects/<slug>/` folder has a brief but no `script.md` yet.

## Don't use when

- The user wants audio, captions, edits or a render: use `video-voice`, `video-captions` or `video-core`.
- The mode is ad, showcase, tutorial, hot-take, listicle, data-story or remix: not built yet.
- The user wants numbers, quotes or reviews you cannot source. Never invent them.

## Steps

1. Pick or create `projects/<slug>/`. Ask only for what is missing: mode, topic, language (`en` or `ar`), format, length, audience (kids: `kids-3-5` or `kids-6-9`, plus one learning goal).
2. Write `brief.json` (fields in `<skill>/assets/brief.schema.json`: title, mode, lang, format, audience, goal, promise, lengthSeconds, tone, cta, learningGoal for kids).
3. Write `script.md`: one `[id] line` per sentence of narration, each followed by an indented `beat:` line (rules and beat order in `references/explain-mode.md`, `references/story-mode.md` or `references/kids-mode.md`; hooks in `references/hooks.md`). Open with the payoff, not a "storytime" intro. Put the call to action after the payoff.
4. Explain mode: write `facts.md` (`- [f1] claim. Source: <link or file>`) and tag each step, edge case and number with `fact: <id>`. Use only sources the user gave or you read this session; otherwise leave the claim out or mark it `[needs-source]` for the user. Story mode: write `style-bible.md` (world, palette, characters; `references/story-mode.md`). Kids mode: no facts file; the characters come from `video-kids` (one `characters/<name>/bible.md` each) before the storyboard, and everything is original.
5. Write `hooks.md` with 5 alternative openings (first 3 seconds).
6. Write `storyboard.md`: a table with scene, kind (`title`, `quote`, `list`, `chart`, `broll`, and for technical steps `rate-limit`, `code`, `sequence`, `request-flow`; for kids `puppet`), narration line ids, props as JSON in backticks, seconds, transition (`references/storyboard.md`).
7. Arabic: write natively (not a translation), spell numbers as words, add diacritics only where a word is ambiguous (`references/arabic.md`). Say the Arabic is a draft for a native speaker to review.
8. Run `node <skill>/scripts/write-check.mjs <project>`. Fix every ERROR and weigh each warning; run it again until it exits 0.
9. Stop and show the storyboard. Only after the user approves, run `node <skill>/scripts/storyboard.mjs <project>` to write `video.json`.

## Budget

<!-- include: _shared/read-budget.md -->

- Write each file once, then run the check. Do not reread files you just wrote.
- Keep scripts short: about 2.5 words a second, so 30 s is roughly 75 words.

## Output

- The project folder, the files written, and the check result (errors fixed, warnings left and why).
- The 5 hooks and which one the script uses, and the storyboard table for approval.
- Which claims have a source and which were left out for lack of one. For Arabic: that the text needs native review.

## Done when

- `write-check.mjs` exits 0 and the user has seen the storyboard.
- `video.json` is written only after approval; no statistic, quote or review is invented.
