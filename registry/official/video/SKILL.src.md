---
name: video
description: Set up the studio folder for making videos with code (HyperFrames) and make an explainer or a kids' puppet video from an idea by running the video skills in order. Use when the user types /video init, /video doctor, /video explain "<topic>", /video kids "<idea>", /video story "<premise>", /video localize, /video ingest, /video showcase, /video tour or /video changes. Don't use to upload a finished video.
disable-model-invocation: true
allowed-tools: Read Write Glob Bash(node *)
---

# Video studio

Creates the folder a user makes videos in, checks their machine, and walks an explainer video from an idea to a checked MP4 by naming the next skill at each step. It does the work of none of them. `<skill>` below is the folder that holds this SKILL.md; `<video-core>` and the other `<video-...>` are the sibling skills.

## Use when

- The user runs `/video init`, or asks to set up a place for making videos.
- The user runs `/video doctor`, or asks why a render tool is missing.
- The user runs `/video kids "<idea>" --age 3-5|6-9` (options `--lang en|ar`, `--song`) or asks for a cartoon for children: follow `references/kids.md`.
- The user runs `/video story "<premise>"` (options `--length 60s|3m`, `--generator stills-only|veo|kling|ltx|wan`) or asks for a cartoon or cinematic short from images: follow `references/story.md`.
- The user runs `/video localize <project> --to ar|en` or asks for an Arabic or English version of a finished video: hand over to the `video-localize` skill and stop; it has its own steps (`references/localize.md`).
- The user runs `/video tour .` or asks for a walkthrough video of a repository: hand over to the `video-tour` skill and stop; it needs `docs/architecture.json`.
- The user runs `/video changes` or asks for a PR or release video: hand over to the `video-changes` skill and stop; it needs a saved git diff.
- The user runs `/video ingest <url or file>` or asks to download or import footage: hand over to the `video-ingest` skill and stop. It asks for the rights basis itself; never suggest one.
- The user runs `/video showcase` (an app demo): hand over to the `video-showcase` skill and stop; it has its own steps.
- The user runs `/video explain "<topic>"` (options `--format reel|short|youtube|square`, `--lang en|ar`, `--length 30s|60s`) or asks for an explainer video.

## Don't use when

- The video is a story for children with puppets: use `/video kids`. A story from AI or supplied images is `/video story`.
- The user wants a video uploaded. The last step prepares a pack to upload by hand; it never uploads.
- The folder is a code project that should not get video folders. Ask for an empty folder first.

## Steps

1. For `/video init`: run `node <skill>/scripts/init.mjs` in the folder the user opened (or pass a folder path). It never overwrites a file.
2. For `/video doctor`: run `node <skill>/scripts/doctor.mjs` and show it as it is. If a tool is missing, give its install line and wait; never install anything yourself. Doctor only says "found" or "missing" for API keys; never read, print or ask for a key value.
3. For `/video explain "<topic>"`: make `projects/<slug>/` (lowercase, hyphens) with `brief.json` left to the writer. Only `--budget $0` exists: local tools, no paid service. Run `node <skill>/scripts/pipeline.mjs projects/<slug>` before every step and after it.
4. Do what its `Next:` line says by running that skill (`references/explain.md` has the order and what each step hands over). The order is write, storyboard (stop for the user's approval), diagram scenes, voice, timing, captions, render, QA, publish.
5. Pause at the storyboard, and again before any step that would cost money (only `video-generate` can, and it asks for the exact total). Never skip QA; if it fails, name the failing check and the step that fixes it, then go back.
6. When QA passes, offer the publish step: write `publish/copy.json` from the brief and facts (`video-publish` has the rules), then run `/video-publish`. When every step is done, show the MP4 path, the contact sheet, the QA lines and where the pack is, tell the user to read each `disclosure.md`, and stop. Never upload.
7. For `/video kids "<idea>" --age ...`: the same loop with `references/kids.md` (pass `--kids` to `pipeline.mjs` until `brief.json` exists). Pause at the character sheet and the storyboard; characters are original, and the publish pack's "made for kids" answer is yes.
8. For `/video story "<premise>"`: follow `references/story.md`. Default `--generator stills-only` costs $0 for motion; any paid image or clip goes through `video-generate`, which prints a quote and waits for the user's yes to that exact total.

## Budget

<!-- include: _shared/read-budget.md -->

- Run each script once. Do not read the template files or the other skills' files to describe them; `pipeline.mjs` says what is next.

## Output

- The folder path and what was created or kept (init), or the tool table and tier (doctor).
- For an explainer: the pipeline table after each step, and the finished video's path with its QA result.

## Done when

- `init.mjs` or `doctor.mjs` ran and its output was shown, or the explainer's pipeline shows every step done.
- Nothing was installed, downloaded, uploaded or overwritten, and the user approved the storyboard before `video.json` existed.
