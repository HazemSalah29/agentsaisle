---
name: video-tour
description: "Part of the video library, used by the video skill (not run directly). Make a narrated codebase tour from an arch-visualize model: component overview plus the busiest request flows, each step with its file and line. Use for a repository walkthrough. Don't use without docs/architecture.json, or to show live traffic or timings."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Codebase tour video

Builds the draft project of a tour: a title, an overview of the components by tier, one `request-flow` scene per chosen flow, and an outro. All of it is read from the model that `/arch-visualize` wrote, so every step has a `file:line` fact. `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user asks for a video that walks through how a repository works.
- `docs/architecture.json` exists, or the user agrees to run `/arch-visualize` first.

## Don't use when

- There is no model and the user does not want one. Do not guess an architecture.
- The user wants live traffic, latencies or numbers the model does not hold.
- The user wants only the script, voice, captions or render: those are `video-write`, `video-voice`, `video-captions`, `video-core`.

## Steps

1. Check for `docs/architecture.json`. If missing, stop and ask the user to run `/arch-visualize`.
2. List flows: ask `video-explain` (`arch-import.mjs --list`) when it is installed, or read the flow ids from the model. Pick up to 3 flows that matter, or let the script take the longest ones.
3. Run `node <skill>/scripts/tour.mjs --model docs/architecture.json --out projects/<slug> [--flows a,b] [--max-flows 3] [--format short-9x16]`. It refuses to overwrite an existing `video.json`.
4. Reword `script.md` with `video-write` so it sounds spoken. Keep the `fact:` ids and every component name as they are (`references/tour.md`).
5. Continue with the normal steps: voice, timing, captions, `<video-core>/scripts/check.mjs`, draft render, `video-qa`.

## Budget

<!-- include: _shared/read-budget.md -->

- Run `tour.mjs` once. Do not open the model file by hand.

## Output

- The folder written, the flows chosen and why, and the counts the script printed.
- A note that the tour shows what the code says, not live traffic.

## Done when

- `check.mjs` exits 0 on the project and every fact in `facts.md` has a `file:line` or the model path as its source.
- No number, timing or component appears that the model does not hold.
