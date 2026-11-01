---
name: video
description: Set up and check the studio folder for making videos with code (HyperFrames), the entry point of the Agent Aisle video library. Use when the user types /video init to create the studio folder, or /video doctor to see which video tools are installed and which hardware tier they allow. Don't use for writing a script, voicing, editing footage or rendering; those are other video skills.
disable-model-invocation: true
allowed-tools: Read Write Glob Bash(node *)
---

# Video studio

Creates the folder a user makes videos in and checks their machine. In this version `/video` does setup only; writing, voicing and rendering are the other `video-*` skills. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- The user runs `/video init`, or asks to set up a place for making videos.
- The user runs `/video doctor`, or asks why a render tool is missing.

## Don't use when

- The user wants a video made from an idea, a script written, audio voiced or a project rendered. Name the right skill (`video-core` renders a `video.json`) instead of guessing.
- The folder is a code project that should not get video folders. Ask for an empty folder first.

## Steps

1. For `/video init`: run `node <skill>/scripts/init.mjs` in the folder the user opened (or pass a folder path). It creates `brand/`, `characters/`, `recipes/`, `library/`, `inbox/`, `projects/`, `exports/`, `CLAUDE.md`, `brand/brand.json` and `providers.yaml`, and adds `.gitignore` lines. It never overwrites a file.
2. For `/video doctor`: run `node <skill>/scripts/doctor.mjs`. It lists Node, FFmpeg, ffprobe, Python, Manim, whisper.cpp and a GPU, then the hardware tier and one install line per missing tool.
3. Show the output as it is. If a tool is missing, give its install line and wait; never install anything yourself.
4. API keys: doctor only says "found" or "missing". Never read, print or ask for a key value.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run each script once. Do not read the template files to describe them; the summary lists what was created.

## Output

- The folder path and what was created or kept (init), or the tool table and tier (doctor).
- The next command: `/video doctor` after init; after doctor, the install line for what is missing.

## Done when

- `init.mjs` or `doctor.mjs` ran and its output was shown to the user.
- Nothing was installed, downloaded or overwritten.
