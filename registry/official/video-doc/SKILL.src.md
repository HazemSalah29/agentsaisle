---
name: video-doc
description: Make a short explainer video from a Markdown or text document such as a README, spec or notes, where every spoken line is a sentence or bullet from the file and every fact cites its file and line, and tables with numbers become charts. Use when the user runs /video doc or asks to turn a document into a video. Don't use for PDFs (no parser is installed), to summarise in your own words, or for voice and rendering.
disable-model-invocation: true
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Document explainer video

Builds the draft project: a title, up to five sections as `list` scenes (bullets or whole short sentences), a `chart` scene for each table that has a number column, and an outro. Nothing is paraphrased or cut: a sentence longer than 70 characters is skipped, not shortened. `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user runs `/video doc <file>` or asks for a video of a README, a spec, release notes or a notes file.

## Don't use when

- The file is a PDF. Say no PDF reader is installed and ask for the text or Markdown export.
- The user wants a summary in your words with new claims: facts must be the document's own.
- The user wants only the script, voice or render: `video-write`, `video-voice`, `video-core`.

## Steps

1. Run `node <skill>/scripts/doc.mjs --doc <file> --out projects/<slug> [--max-sections 5] [--format short-9x16]`. It refuses to overwrite an existing `video.json`.
2. Read `facts.md` (not the whole document). If a section matters but has no short sentence, tell the user which one and let them choose a line.
3. Reword `script.md` with `video-write`; keep the `fact:` ids and every number as written (`references/doc.md`).
4. Continue: voice, timing, captions, `<video-core>/scripts/check.mjs`, draft render, `video-qa`.

## Budget

<!-- include: _shared/read-budget.md -->

- Run `doc.mjs` once. Do not read the document in full.

## Output

- The folder written, sections used and left out, and any table turned into a chart.

## Done when

- `check.mjs` exits 0 and every sentence and number in the narration is in `facts.md` with a `file:line` source.
- Nothing was added that the document does not say.
