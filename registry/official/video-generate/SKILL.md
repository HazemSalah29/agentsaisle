---
name: video-generate
description: "Part of the video library (loaded by /video, not run directly): lists AI images and clips made by the Higgsfield connector in a project, and makes offline test media."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video generate

Makes AI stills and clips and lists them in `video.json` as `aiGenerated`. It has no network code and no key: the `test` provider is offline and free, and real AI images and clips come from the Higgsfield connector (`video/references/higgsfield.md`), then get listed here with `adopt.mjs`. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- The project needs a generated image or short clip (`image` or `video`).
- `video-story` asks for a keyframe or a shot.

## Don't use when

- The ask is music, sound effects or lip sync: say they are not built yet.
- The prompt names a real person, a copyrighted or trademarked character or a logo: refuse and offer an original one.
- The budget is $0 or no connector is connected: use `--provider test`, or make stills with the `broll` scenes instead.

## Steps

1. Make the image or clip with the Higgsfield connector (`video/references/higgsfield.md`: the user's yes to the shot list and its credits comes first), or with `node <skill>/scripts/generate.mjs image|video <project> --prompt "..." --id <asset-id>` for the offline `test` provider.
2. List a connector file with `node <skill>/scripts/adopt.mjs <project> <file> --id <asset-id> --tool <name> [--credits n]`: no network, no charge, credits recorded only as reported.
3. Never retry a generation without asking.
4. A repeat of the same prompt, seed and references is served from the cache.
5. Report the path, the model, the credits reported and the log in `generation-log.jsonl`.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Make the fewest calls: one clear prompt, one seed, then stop. Do not loop to "get a better one" without the user's say. Results are not guaranteed on the first try.
- Never open the generated files to check them unless the user asks; the log has the hash and size.

## Output

- Path, provider, model, cost, cache hit or not, and the total spent so far.
- A reminder that outputs are AI-generated: realistic people or places need the synthetic-content label (`video-core` credits tells which).

## Done when

- `generate.mjs` or `adopt.mjs` exited 0 and `video.json` lists the asset with `aiGenerated: true`.
- No key was read, printed or written; no generation ran without the user's yes.
