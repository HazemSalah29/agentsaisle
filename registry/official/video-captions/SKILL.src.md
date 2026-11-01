---
name: video-captions
description: Make captions for a video project from its word timings, in three styles (karaoke, pop, clean), with SRT and VTT files and captions burned into the render in the browser engine so Arabic letters join and right-to-left text reads correctly. Use when the user wants captions or subtitles for a project, or runs /video-captions. Don't use for transcribing the user's own footage or for editing captions by hand-drawn effects.
disable-model-invocation: true
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video captions

Groups the words, keeps them inside the platform safe zone and writes `captions.json`, `captions.srt` and `captions.vtt`. `video-core` draws them as real text. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- A project has `voice/words.json` and `timing.json` and needs captions.
- The user runs `/video-captions [--style karaoke|pop|clean] [--max-words 4] [--burn|--srt|--both]`.

## Don't use when

- There is no voice yet: run `video-voice` and `timing.mjs` first.
- The user wants captions for their own recorded footage (transcription is a later skill).
- The user wants a style that is not one of the three.

## Steps

1. Check `voice/words.json` exists. If its timings are estimated, tell the user captions may drift; offer whisper.cpp for measured times (`video-voice/references/engines.md`).
2. Run `node <skill>/scripts/captions.mjs <project> --style <name>`. `--srt` writes subtitle files without burning them; the default also burns them in the next render.
3. Arabic or other right-to-left text: the layout flips by itself. Check `brand/fonts` has a font with the script (for example Cairo); run `video-brand` check with `--lang ar`.
4. Render with `node <video-core>/scripts/render.mjs <project> --draft`, then look at the result before the final render.
5. Read `references/styles.md` only if the user asks to change a style (size, weight, panel, stroke).

## Budget

<!-- include: _shared/read-budget.md -->

- Run the script once per style change. Do not read `captions.json`; its summary line says what matters.

## Output

- The caption count, style, direction and whether they are burned in; the three file paths.
- Any `note:` lines (size raised, lines without times, estimated timings).

## Done when

- `captions.mjs` exited 0 and the user knows whether timings are measured or estimated.
- No caption group is a single word unless its line is one word.
