---
name: video-captions
description: "Part of the video library (loaded by /video, not run directly): captions from word timings (karaoke, pop, clean, kids), SRT/VTT, burned in; Arabic joins correctly."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video captions

Groups the words, keeps them inside the platform safe zone and writes `captions.json`, `captions.srt` and `captions.vtt`. `video-core` draws them as real text. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- A project has `voice/words.json` and `timing.json` and needs captions.
- A project has voice and timing and needs captions: `--style karaoke|pop|clean|kids`, `--max-words 4`, `--bilingual translations.json`, `--burn|--srt|--both`.

## Don't use when

- There is no voice yet: run `video-voice` and `timing.mjs` first.
- The user wants captions for their own recorded footage (transcription is a later skill).
- The user wants a style that is not one of the three.

## Steps

1. Check `voice/words.json` exists. If its timings are estimated, tell the user captions may drift; offer whisper.cpp for measured times (`video-voice/references/engines.md`).
2. Run `node <skill>/scripts/captions.mjs <project> --style <name>`. `--srt` writes subtitle files without burning them; the default also burns them in the next render.
3. Arabic or other right-to-left text: the layout flips by itself. Check `brand/fonts` has a font with the script (for example Cairo); run `video-brand` check with `--lang ar`.
4. Render with `node <video-core>/scripts/render.mjs <project> --draft`, then look at the result before the final render.
5. Bilingual learning video (a translation under each caption): write `translations.json` as `{"lang": "ar", "lines": {"l1": "..."}}` with one entry per captioned line (a draft: say a native speaker should review Arabic), then add `--bilingual translations.json`. The second line fades in with its line; it is not highlighted word by word because the translation is not spoken (`references/styles.md`).
6. Read `references/styles.md` only if the user asks to change a style (size, weight, panel, stroke).

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run the script once per style change. Do not read `captions.json`; its summary line says what matters.

## Output

- The caption count, style, direction and whether they are burned in; the three file paths.
- Any `note:` lines (size raised, lines without times, estimated timings).

## Done when

- `captions.mjs` exited 0 and the user knows whether timings are measured or estimated.
- No caption group is a single word unless its line is one word.
