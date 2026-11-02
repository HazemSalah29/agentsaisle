---
name: video-core
description: Check, time and render a video.json project to an MP4 with HyperFrames (or Remotion with `--engine remotion`), and write its credits and disclosure notes. Scene kinds are title, quote, list, chart, broll, rate-limit, code, sequence, request-flow, screen and puppet. Use when the user wants to render or re-render a video.json, check one, or get its CREDITS.txt. Don't use for writing the script, making voice audio, captions or editing footage; those are other video skills.
disable-model-invocation: true
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video core

The engine under the video library. A project is a folder with a `video.json` (the plan); scripts check it, set scene lengths from the voice audio, render it with HyperFrames or Remotion, mix the sound and write the credits. You edit `video.json`; the scripts draw the frames, so the same file gives the same video. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- The user has or wants a `video.json` and asks to check, render, re-render or credit it.
- Another video skill hands over a project folder to render.

## Don't use when

- The user wants the script, voice, captions, a diagram or code animation, or footage edits. Those are separate skills; do not draw frames by hand.
- HyperFrames or FFmpeg is missing. Run `/video doctor` first; never install tools yourself.

## Steps

1. Write or edit `<project>/video.json` (`references/video-json.md`; props per kind in `references/scene-kinds.md`; schema in `<skill>/assets/video.schema.json`). Only use the built kinds (`references/scene-kinds.md`); fill `rate-limit` and `request-flow` with `video-explain`, never by hand.
2. Run `node <skill>/scripts/check.mjs <project>`. Fix every problem it lists, then run it again until it says OK.
3. If scenes take their length from the voice: put one audio file per script line at `<project>/voice/<line-id>.wav`, then run `node <skill>/scripts/timing.mjs <project>`. If every scene is fixed, skip this step.
4. Run `node <skill>/scripts/render.mjs <project> --draft` first (540p), then without `--draft` for the final. Output: `<project>/out/<folder-name>.mp4`. HyperFrames is the default; add `--engine remotion` only if the user asked for it and installed it (its company licence is shown at render).
5. Run `node <skill>/scripts/credits.mjs <project>`. It writes `credits.json` and `CREDITS.txt` and fails if an asset has no licence or `disclosure` says less than the assets imply.
6. If render says HyperFrames or Remotion is not installed, tell the user to install it (command in `references/runner.md`) and stop (`references/runner.md`).

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run each script once per change. Do not read `out/hf/` or `timing.json` to check them; the scripts print what matters.
- Render a draft before the final, and re-render only after `check.mjs` passes.

## Output

- The path of the MP4, its length and size, and the credits files.
- The disclosure advice from `credits.mjs`, in its words.
- Any `note:` lines render printed (for example a transition that fell back to a cut).

## Done when

- `check.mjs` exits 0, `render.mjs` printed the output path, and `credits.mjs` exited 0.
- No asset lacks a licence and nothing was installed or fetched.
