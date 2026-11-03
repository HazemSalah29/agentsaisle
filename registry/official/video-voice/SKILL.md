---
name: video-voice
description: "Part of the video library (loaded by /video, not run directly): narration from script.md with local voices (Kokoro English, 3arab Arabic) or the user's own recording cut into lines, with word timings; never clones a voice."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video voice

Turns `script.md` into audio and word times. Scripts do the work; the engines run locally and offline. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- A project has a checked `script.md` and needs narration audio, or word timings for captions.
- The user wants their own voice: they recorded the script once through (`references/recorded.md`).
- A project has a checked script and needs narration, optionally with `--provider`, `--voice`, `--speed`.

## Don't use when

- The user wants to clone a voice: this version cannot, and it refuses without recorded consent anyway. Never clone a public figure.
- The user wants a paid service (ElevenLabs and others are not built).
- The script has not passed `write-check.mjs`.

## Steps

1. Check the engines with `/video doctor`. If Kokoro or 3arab is missing, say so and offer `--provider test` (a tone, not speech, useful to preview timing) or the install notes in `references/engines.md`. Never install anything yourself.
2. Run `node <skill>/scripts/voice.mjs <project> [--provider kokoro|3arab|test] [--voice id] [--speed 1] [--seed 1]`. Default provider: 3arab for `ar`, kokoro otherwise. Lines that did not change are kept; add `--force` to redo all.
3. Run `node <skill>/scripts/align.mjs <project>`. It uses whisper.cpp when set up; otherwise it estimates and flags the timings as approximate.
4. Report the manifest: provider, voice, seconds, and whether timings are measured or estimated.
5. Their own recording instead of steps 2 and 3: ask whose voice it is, then `node <skill>/scripts/recorded.mjs <project> --file <recording> --speaker self` (or `--speaker other --consent <file>`). It cuts one WAV per line and writes the word times; it needs whisper.cpp and nothing is uploaded.
6. Next: `node <video-core>/scripts/timing.mjs <project>`, then `video-captions`.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run each script once. Do not listen-check or read the WAV files; the manifest and summary have what you need.
- Re-voice only edited lines (the script does this by itself).

## Output

- The provider, voice and total seconds, and the paths `voice/*.wav`, `voice/words.json`, `voice/manifest.json`.
- Whether word times are measured (whisper) or ESTIMATED, in capital letters if estimated.
- For Arabic: that the voice is a machine voice with a watermark, and numbers must already be words.

## Done when

- `voice.mjs` and `align.mjs` both exited 0 and the user was told how the timings were made.
- No API key was read or printed; no voice was cloned.
