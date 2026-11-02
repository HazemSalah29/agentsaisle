---
name: video-edit
description: "Part of the video library, used by the video skill (not run directly). Edit video and audio files with FFmpeg: trim, join, speed, gif, scene cuts, loudness to -14 LUFS, colour looks, stabilize, punch-in zooms, cutting pauses and fillers, transcribe, reframe wide video to vertical. Use to tighten, fix or reshape the user's footage. Never changes a file in place."
user-invocable: false
allowed-tools: Read Write Glob Bash(node *)
---

# Video edit

Post-production on files the user already has. One script, `edit.mjs`, with a command per job; it reads the original and writes a new file, so the original is never changed. `<skill>` below is the folder that holds this SKILL.md; command details are in `references/commands.md`.

## Use when

- The user wants footage shortened, joined, sped up, levelled, colour-graded, steadied, made vertical, or made into a gif.
- The user wants pauses and "um"s taken out of a talking clip.

## Don't use when

- The video should be built from a script and scenes. That is `video-core`.
- The user wants clips laid over a transcript (`broll`; not built), or wants it uploaded or published.
- The user asks to overwrite the original. Give a new file name; never use `--force` on the input.

## Steps

1. Ask only what is missing: the input file, what should change, the output name. Inputs are plain file paths; the script refuses URLs and names that start with `-`.
2. Run `node <skill>/scripts/edit.mjs <command> --in <file> --out <new-file> [options]` (`references/commands.md`: `trim`, `join`, `speed`, `gif`, `scenes`, `audio`, `color`, `stabilize`, `jumpcut`, `cut`, `transcribe`, `reframe`).
3. `cut` is a dry run until you add `--apply`. Show the user what it would remove (`references/cut.md`) and apply only after they agree. With no transcript tool set up, use `--silence-only` or give `--words`.
4. `reframe` follows a face only when OpenCV is installed (`/video doctor` says); otherwise use `--mode center|left|right|x=0.4`. Say how often a face was found, and that it can miss profiles and several faces (`references/reframe.md`).
5. Show the one-line result. Do not play, describe or re-measure the file unless asked; the script reports length and size.
6. Several steps in a row (cut, then audio, then color) each write a new file; name them in order and tell the user which is the final one.

## Budget

<!-- include: _shared/read-budget.md -->

- Run each command once. Do not open the media, the `.trf` or the `cut.json` to check them; the printed lines say what happened.
- Prefer one command with the right options over several runs.

## Output

- The new file's path, length and size, and what changed (for `cut`: seconds saved, pauses and fillers removed; for `reframe`: face coverage).
- Anything the script said it could not do and the option that avoids it.

## Done when

- The script exited 0, the output is a new file, and the original is untouched.
- Nothing was uploaded or installed, and no number was claimed that the script did not print.
