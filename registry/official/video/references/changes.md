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

- Run `changes.mjs` once. Do not read the diff by hand.

## Output

- The folder written, the counts the script printed, and the files left out of the code scenes.

## Done when

- `check.mjs` exits 0 and every number in the narration is one the script counted.
- No code was run from the repository, and nothing was uploaded.

## Details

- Counts come from the diff: files, lines added, lines removed per file. Never round or estimate them.
- A code scene needs a hunk of at most 20 lines, 60 characters wide, in a language the code scene knows (js, ts, json, sh, py). Other files appear only in the totals.
- The changelog section is found by a heading that contains the release text; its bullets (at most five) are shown as written, markdown marks removed.
- Not built: architecture diff (needs two arch-visualize models), code morph between hunks, binary files.
