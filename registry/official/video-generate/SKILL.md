---
name: video-generate
description: "Part of the video library (loaded by /video, not run directly): one paid AI image or clip through a provider; quotes the price and needs the user's typed approval of the exact total."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video generate

Makes AI stills and clips and lists them in `video.json` as `aiGenerated`. This is the only video skill that uses the network, and only when a paid provider is chosen; the `test` provider is offline and free. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- The project needs a generated image or short clip (`image` or `video`).
- `video-story` asks for a keyframe or a shot.

## Don't use when

- The ask is music, sound effects or lip sync: say they are not built yet.
- The prompt names a real person, a copyrighted or trademarked character or a logo: refuse and offer an original one.
- The budget is $0: use `--provider test`, or make stills with the `puppet` or `broll` scenes instead.

## Steps

1. Read the project's `providers.yaml` (project folder or studio folder). Paid providers need `adapter`, `model`, `keyEnv` and the current price (`usdPerImage` or `usdPerSecond`) that the user filled in. Never guess a price or a model.
2. Run `node <skill>/scripts/generate.mjs image|video <project> --provider <id> --prompt "..." --id <asset-id> [--ref a.png] [--seconds 4] [--budget <usd>]`.
3. Exit 3 means a quote was printed and nothing was sent. Show the quote to the user and ask. Only if they say yes to that exact total, re-run with `--approve <total>`. There is no `--yes`, and you never approve for them.
4. A repeat of the same prompt, seed and references is served from the cache at $0.
5. Report the path, the model, the cost and the running total in `generation-log.jsonl`.

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

- `generate.mjs` exited 0 (or 3 with the quote shown to the user) and `video.json` lists the asset with `aiGenerated: true`.
- No key was read, printed or written; no paid call ran without the user's approval of its exact total.
