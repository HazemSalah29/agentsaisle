# Interactive explainers

One project, two outputs: the video, and a page where the viewer can pause, scrub, slow a step down and choose between branches. The page uses the same scenes and animations as the render, needs no server, and loads nothing from the network (a content-security policy forbids it). `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user wants the viewer to choose a path or control the pace.
- The project is finished enough to check (`<video-core>/scripts/check.mjs` passes) and has timing.

## Don't use when

- The user wants an MP4: that is `video-core` render.
- The project has `screen` or video `broll` scenes: the page refuses them (stills and every drawn scene work).
- The user asks you to host or upload the page. Hand them the folder.

## Steps

1. Branches are optional. To add them, put the scenes in this order in `video.json`: a question scene, the scenes of answer 1, the scenes of answer 2, then the scene all paths continue with. Run `node <skill>/scripts/branches.mjs <project> --init` for an example `interactive.json`, edit labels and ids, then run it again without `--init` to check (`references/branches.md`).
2. Write narration so each answer's scenes make sense on their own and the shared scene works after either one.
3. Export: `node <video-core>/scripts/export-html.mjs <project> [--out folder] [--audio mix.wav]`. `--audio` plays one finished audio file in step with the page; without it the page is silent.
4. Open `index.html` in a browser and try both answers, the scrubber and the speed control. Report what you could not try.

## Budget

- Run each script once. Do not read the exported HTML.

## Output

- The folder written, the number of branch points, whether audio is included, and which paths were tried.

## Done when

- `export-html.mjs` exits 0 and each answer path was opened and played through to the shared scene.
- Nothing was uploaded, and the page loads nothing from the network.

## Details

`interactive.json` sits next to `video.json`:

```
{ "version": 1, "branches": [ { "id": "pick", "after": "s3", "question": "Which one?",
    "options": [ { "label": "Token bucket", "from": "s4", "to": "s5" },
                 { "label": "Sliding window", "from": "s6", "to": "s7" } ],
    "then": "s8" } ] }
```

- The question appears when scene `after` ends and the clock holds on its last frame. Choosing an answer plays that answer's scenes (`from` to `to`), then every path continues at `then` (or ends when `then` is `"end"`).
- Layout in `video.json`: `after`, then answer 1's scenes, then answer 2's, and so on, then `then`. The checker names the scene each part must start with.
- Limits: 4 branches a project, 2 to 4 answers, a question of 100 characters, a label of 40. Plain text only (no control or direction marks).
- Scrubbing: dragging into an answer plays that answer, then continues. Dragging past a question skips it.
- Speed: 0.5x to 2x. Keys: space plays or pauses, the arrow keys jump 5 seconds.
- Not built: branches that loop back, scores or state, a question inside a scene, video clips in the page.
