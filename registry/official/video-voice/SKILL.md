---
name: video-voice
description: "Part of the video library, used by the video skill (not run directly). Make a voice track from script.md, one WAV per line with word timings, using local engines (Kokoro for English, 3arab-TTS for Arabic) or an offline test tone. Use for narration and caption timings. Don't use to clone a voice, to use a paid voice service, or before the script passes the writer check."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video voice

Turns `script.md` into audio and word times. Scripts do the work; the engines run locally and offline. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- A project has a checked `script.md` and needs narration audio, or word timings for captions.
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
5. Next: `node <video-core>/scripts/timing.mjs <project>`, then `video-captions`.

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
