---
name: video-kinetic
description: "Part of the video library (loaded by /video, not run directly): a speech-synced kinetic-type video from a short script: bold words pop as spoken, slash and shatter cuts, cards and flows."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Kinetic video

Turns a short script into a punchy motion-graphics video: every word pops in at the moment it is spoken, in a heavy display font; key words glow with a spark ring; between beats the screen is cut by a glowing slash, shatters, whips or zooms through; optional 3D-tilted cards and node flows show what the user's script lists. It is rendered from HTML to MP4 by `video-core` on the user's computer (Claude desktop app, Code tab, Local; Windows, Linux or macOS). `<skill>` is this folder; `<video-core>`, `<video-voice>` and `<video-qa>` are sibling skills. The look is original: nothing of any other creator's video is used.

## Use when

- The user wants a hype, launch, explainer or "motion graphics" video where bold words appear as someone speaks, with fast stylish transitions.
- They give a topic or a script. If only a topic, write a short script of their facts (`references/script.md`); never invent a claim, number or quote.

## Don't use when

- The user wants their own footage cut up (use `video-edit`), a product-photo edit (`video-product`) or generated people.
- The words would need facts the user has not given. Ask for them instead.

## Steps

1. Write `projects/<slug>/script.md`: 5 to 12 short lines, one idea each (`references/script.md`). Optional attributes under a line: `emph:` (key words), `layout: slab` (one giant word on a colour block), `transition:`, `exit:`, `card: Title|row=tag;row` and `flow: a>b>c` (only content the user supplied).
2. Pick a preset (`volt` lime, `ember` orange, `ice` cyan; `--accent #rrggbb` overrides). Run `node <skill>/scripts/plan.mjs --project projects/<slug> --preset ember`.
3. Voice and timing: `<video-voice>/scripts/voice.mjs` (the local synthetic voice, or `recorded.mjs <project> --file mic.wav --speaker self` for the user's own recording, which also writes the word times), then `align.mjs` (real word times from whisper.cpp), then `<video-core>/scripts/timing.mjs`.
4. `node <skill>/scripts/cues.mjs projects/<slug> --preset ember` (original sound effects on cuts and key words), `<video-core>/scripts/check.mjs`, then `render.mjs --draft`.
5. Run `node <skill>/scripts/sync.mjs projects/<slug>` and `<video-qa>/scripts/qa.mjs`, open `qa/contact-sheet.png` and judge it with the checklist in `references/craft.md`. Fix by editing `script.md` attributes or `video.json` and re-planning (a new folder) or editing in place; at most 2 revisions, then show the user.
6. Render the final (no `--draft`), run QA again, show the MP4 path and contact sheet, offer the publish pack (`video-publish`). Never upload.

## Budget

<!-- include: _shared/read-budget.md -->

- Run each script once per revision. Do not read `words.json` or the render folder.

## Output

- The project folder, the preset, the number of beats and transitions, the sync result and the QA result.

## Done when

- `sync.mjs` and `video-qa` pass, the contact sheet passes `references/craft.md`, and every word on screen came from the user's script.
- Nothing was uploaded, and a recording of someone's voice was used only with their confirmation.
