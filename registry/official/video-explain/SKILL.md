---
name: video-explain
description: Plan and fill the technical scenes of an explainer video, which are rate-limit animations driven by a real seeded simulation, request flows imported from an arch-visualize model, highlighted code with focus and diff, and sequence diagrams. Use when the user wants an animated diagram, code or algorithm scene in a video.json, or runs /video-explain. Don't use for scripts, voice, captions or rendering, for maths scenes, or to show numbers the simulation did not produce.
disable-model-invocation: true
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video explainer scenes

Chooses and fills the four technical scene kinds of `video-core` (`rate-limit`, `request-flow`, `code`, `sequence`). What the viewer sees is computed, not drawn by hand: the rate-limit animation is the event log of the real algorithm, and a request flow comes from a real model of a codebase. `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- A storyboard has a beat that explains an algorithm, a request path, a protocol exchange or a piece of code.
- The user runs `/video-explain` or asks for an animated diagram or code scene in an existing project.

## Don't use when

- The user wants the script, voice, captions or the render. Those are `video-write`, `video-voice`, `video-captions` and `video-core`.
- The scene needs maths, a graph of a function or a kind that is not built. Say so; do not fake it with a title scene.
- A number would have to be typed in by hand. Run the simulation or leave the number out.

## Steps

1. For each technical beat pick a kind with `references/kinds.md` and say which in one line.
2. `rate-limit`: pick the numbers that make the point (`references/simulations.md`), run `node <skill>/scripts/simulate.mjs --seed 42 --count 80 --pattern poisson --rate 6 --algo token-bucket --capacity 5 --refill 3 --into <project>/video.json --scene <id>`. Quote only the numbers it prints, and add them to `facts.md` with source "simulate.mjs, seed 42".
3. `request-flow`: needs a model. If `docs/architecture.json` is missing, tell the user to run `/arch-visualize` first. List flows with `node <skill>/scripts/arch-import.mjs --model <file> --list`, then import one with `--flow <id> --into <project>/video.json --scene <id>` (`references/arch-import.md`). Narrate it as what the code says, not live traffic.
4. `sequence`: write the `source` text yourself, one row per message, short labels (`references/kinds.md`).
5. `code`: use the user's real code, at most 20 lines of 60 characters; add `focus` steps that follow the narration (`references/code.md`).
6. Match narration to the scene: one narration line per row or step makes each one appear with its line.
7. Run `node <video-core>/scripts/check.mjs <project>` and fix every problem it lists; then `render.mjs --draft` and look at one frame per scene before the final render.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run each script once per scene. Do not read the vendored files in `<video-core>/assets/` to check them; `check.mjs` does.
- Do not open the model file by hand; `arch-import.mjs --list` and its step list are enough.

## Output

- One line per technical scene: kind, what it shows, and where its numbers or code came from.
- The numbers the simulation printed, as the narration may quote them.
- The check result, and the draft frames looked at.

## Done when

- `check.mjs` exits 0 and every rate-limit scene was filled by `simulate.mjs`, every request-flow by `arch-import.mjs`.
- Every number in the narration appears in a script's output, and nothing was installed or fetched.
