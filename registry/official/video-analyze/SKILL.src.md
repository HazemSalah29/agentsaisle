---
name: video-analyze
description: "Part of the video library (loaded by /video, not run directly): measure the pace of a reference video (cuts, shot length, hook, palette) into a recipe of numbers; needs the right to analyse it."
user-invocable: false
allowed-tools: Read Write Glob Bash(node *)
---

# Video analyze

Learns a format, not the content. It reads a reference video and writes `recipes/<name>.json`: numbers and labels such as "a cut every 3.2 seconds, hook of 2.5 seconds, 62% of the time someone is speaking". Nothing of the reference is kept or reusable. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- The user has a video they made, have permission for, or that is Creative Commons or public domain, and wants to make new videos with a similar pace and look.
- A reference video (a file the user has the right to analyse) should set the pace or look of a new one.

## Don't use when

- The user has no right to the video. If they answer "none", stop: the script refuses it, and so should you.
- The user wants the reference's footage, music, words, script or characters reused. Say the recipe cannot hold them; offer original work in the same pace.
- The user asks what the video says or shows. This measures how it is made, not what it contains.

## Steps

1. Ask which file and the basis for using it: `own`, `permission`, `cc` or `public-domain`. Record what they say; do not decide for them, and do not check rights yourself.
2. Run `node <skill>/scripts/analyze.mjs <file> --name <recipe-name> --rights <basis>` (add `--no-transcript` to skip whisper.cpp, `--lang ar` for Arabic). Names are lowercase letters, digits and hyphens.
3. Read the printed summary to the user in plain words (`references/measures.md` says what each number means and how far to trust it). Say what was not measured.
4. Offer how to use it: the pace and hook length for `video-write`'s script and storyboard, the palette for `brand.json`. Use the numbers as targets; write new, original scenes and words.

## Budget

<!-- include: _shared/read-budget.md -->

- Run the script once per reference. Do not open the recipe unless the user asks; the printed lines carry it.
- Do not watch, transcribe or describe the reference yourself.

## Output

- The recipe path and a few lines: cuts a minute, average shot, hook, shares, palette, tempo.
- The notes the script printed (for example, speech not measured) and the list of what it never measures.
- The rights basis the user gave, and that it was not verified.

## Done when

- The script exited 0 and `recipes/<name>.json` exists with only numbers and labels.
- No footage, audio, text or character of the reference was copied or described, and nothing was downloaded or uploaded.
