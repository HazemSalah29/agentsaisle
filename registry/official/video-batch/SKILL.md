---
name: video-batch
description: "Part of the video library (loaded by /video, not run directly): one video per row of the user's own CSV from a template; dry run first."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Personalised videos from a CSV

Fills a template project's `video.json` and `script.md` once per CSV row and writes `row-001`, `row-002` and so on. Values replace text only, so a cell can never change the structure. `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user wants the same video for many people or accounts, with their own list.
- A finished or draft template project exists, with placeholders such as `{{name}}` in its text.

## Don't use when

- The data is not the user's own, or was scraped or bought. Refuse.
- The user wants real people's faces, voices or likeness. Not built.
- The user wants only the script, voice or render: `video-write`, `video-voice`, `video-core`.

## Steps

1. Ask the user to confirm the list is their own data and that the videos stay on this machine. Do not open the CSV yourself; the script reads it.
2. Put `{{column}}` placeholders in the template's `video.json` text and `script.md` (`references/batch.md`). Column names are lowercase letters, digits and `_`.
3. Dry run: `node <skill>/scripts/batch.mjs --template projects/<t> --csv <file> --out projects/<t>-batch`. Check the counts it prints.
4. Write: the same command with `--apply`. Then voice, timing, captions, `<video-core>/scripts/check.mjs` and render per row.
5. When done, remove the personal data: `node <skill>/scripts/batch.mjs --clean projects/<t>-batch`.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Do not print or paste CSV rows, in the chat or in notes.

## Output

- Row count, placeholders used, unused columns, and the output folder. No cell values.

## Done when

- Every row has its own project, `check.mjs` passes on a sample, and the user knows how to clean up.
- Nothing was sent anywhere and the CSV was not copied.
