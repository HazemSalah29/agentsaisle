---
name: video-interactive
description: Export a video project as an interactive web page, a single folder with a player (play, pause, scrub, speed) and optional branch points where the viewer picks a path, such as token bucket or sliding window. Use when the user runs /video interactive or wants a lesson the viewer can steer or slow down. Don't use for a plain video file, for projects with video clips or 3D puppets, or to host or upload the page.
disable-model-invocation: true
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Interactive explainers

One project, two outputs: the video, and a page where the viewer can pause, scrub, slow a step down and choose between branches. The page uses the same scenes and animations as the render, needs no server, and loads nothing from the network (a content-security policy forbids it). `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user runs `/video interactive <project>` or wants the viewer to choose a path or control the pace.
- The project is finished enough to check (`<video-core>/scripts/check.mjs` passes) and has timing.

## Don't use when

- The user wants an MP4: that is `video-core` render.
- The project has `screen` or video `broll` scenes or 3D puppets: the page refuses them (stills and every drawn scene work).
- The user asks you to host or upload the page. Hand them the folder.

## Steps

1. Branches are optional. To add them, put the scenes in this order in `video.json`: a question scene, the scenes of answer 1, the scenes of answer 2, then the scene all paths continue with. Run `node <skill>/scripts/branches.mjs <project> --init` for an example `interactive.json`, edit labels and ids, then run it again without `--init` to check (`references/branches.md`).
2. Write narration so each answer's scenes make sense on their own and the shared scene works after either one.
3. Export: `node <video-core>/scripts/export-html.mjs <project> [--out folder] [--audio mix.wav]`. `--audio` plays one finished audio file in step with the page; without it the page is silent.
4. Open `index.html` in a browser and try both answers, the scrubber and the speed control. Report what you could not try.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run each script once. Do not read the exported HTML.

## Output

- The folder written, the number of branch points, whether audio is included, and which paths were tried.

## Done when

- `export-html.mjs` exits 0 and each answer path was opened and played through to the shared scene.
- Nothing was uploaded, and the page loads nothing from the network.
