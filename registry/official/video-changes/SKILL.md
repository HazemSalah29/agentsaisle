---
name: video-changes
description: "Part of the video library, used by the video skill (not run directly). Make a short \"what changed\" video for a pull request or release from a saved git diff and an optional changelog section: counted totals plus code diff scenes. Use for PR, release or commit-range videos. Don't use when the diff has not been saved to a file."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Release and PR videos

Reads a unified diff as text and builds the draft project: title, totals, optional changelog bullets, up to four code diff scenes, outro. The script never runs git; you save the diff first. `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user asks for a video of a PR, a release or a commit range.
- CI wants a draft each release (the script has no prompts and exits 0, or 2 with a sentence).

## Don't use when

- The user wants live numbers (downloads, users). Only counts from the diff are allowed.
- The user wants an architecture diff. That is not built; say so.
- The user wants only the script, voice or render: `video-write`, `video-voice`, `video-core`.

## Steps

1. Save the diff: ask the user to approve running `git diff <range> > change.diff` (or `gh pr diff`). Do not read secrets or `.env` files; if the diff touches one, tell the user and stop.
2. Run `node <skill>/scripts/changes.mjs --diff change.diff --out projects/<slug> [--changelog CHANGELOG.md --release 1.2.0] [--title "Release 1.2.0"] [--max-files 4]`.
3. Reword `script.md` with `video-write`; keep the `fact:` ids and the counts (`references/changes.md`).
4. Continue: voice, timing, captions, `<video-core>/scripts/check.mjs`, draft render, `video-qa`.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run `changes.mjs` once. Do not read the diff by hand.

## Output

- The folder written, the counts the script printed, and the files left out of the code scenes.

## Done when

- `check.mjs` exits 0 and every number in the narration is one the script counted.
- No code was run from the repository, and nothing was uploaded.
