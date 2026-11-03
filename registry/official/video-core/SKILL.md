---
name: video-core
description: "Part of the video library (loaded by /video, not run directly): check, time and render a video.json to MP4 with the Remotion engine (build.mjs, render, review, credits); holds every scene kind and the look."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video core

The engine under the video library. A project is a folder with a `video.json` (the plan); scripts check it, set scene lengths from the voice, turn it into a film (`assets/film/resolve.mjs`), render the picture with Remotion (`assets/remotion/`), then mix the voice, a music bed and sound effects with ffmpeg. You edit `video.json`; the code draws the frames, so the same file gives the same video. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- The user has or wants a `video.json` and asks to check, render, re-render or credit it.
- Another video skill hands over a project folder to render.
- The Remotion engine needs setting up (`engine.mjs`).

## Don't use when

- The user wants the script, the voice, a diagram's data or a screen capture. Those are separate skills; do not draw frames by hand.
- The engine or FFmpeg is missing and the user has not set them up. Run `engine.mjs status` and `/video doctor`; never install anything yourself.

## Steps

1. Engine: `node <skill>/scripts/engine.mjs status`. Not ready: `node <skill>/scripts/engine.mjs setup` writes the pinned package.json to `~/.aisle-video/remotion` and prints the two commands for the user to run there. Say the Remotion licence line it prints.
2. Write or edit `<project>/video.json` (`references/video-json.md`; kinds and props in `references/scene-kinds.md`; schema in `<skill>/assets/video.schema.json`). Look settings live in `style` (preset, captions, music).
3. Run `node <skill>/scripts/build.mjs <project> --draft` (check, timing and render in one call; no flag for the final, which also writes credits). It stops at the first step that fails and shows its message: fix it and run again. The steps by hand: `check.mjs`, `timing.mjs` (after the voice), `render.mjs [--draft] [--preset name]`.
4. Look at the draft: `node <skill>/scripts/review.mjs stills <project> --at 0.5,3,7` (one time per scene), once. When it is accepted, `node <skill>/scripts/review.mjs approve <project>`; the final refuses to run if the project changed since, unless `--ignore-approval`. Every render writes `out/<name>.validation.json`; fix a failed one.
5. The final writes `out/<name>.mp4`, `out/<name>.srt` and `.vtt` (when there are captions), and `credits.mjs` writes `credits.json` and `CREDITS.txt`; it fails if an asset has no licence.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run each script once per change. Do not read `out/rm/` or `timing.json` to check them; the scripts print what matters.
- Render a draft before the final, and re-render only after `check.mjs` passes. A draft renders at half size, so it is about 4 times faster.

## Output

- The path of the MP4, its length and size, the subtitle files and the credits files.
- The disclosure advice from `credits.mjs`, in its words, and any `note:` lines render printed.

## Done when

- `check.mjs` exits 0, `render.mjs` printed the output path, and `credits.mjs` exited 0.
- No asset lacks a licence and nothing was installed or fetched by the scripts.
