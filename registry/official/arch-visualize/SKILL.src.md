---
name: arch-visualize
description: Map a project's architecture from its code and config and generate one interactive, offline web page that shows each component with its technology icon, animated request flows between them, and possible risks such as a single database or missing rate limiting. Use when the user asks to visualize, map or explain a system's architecture or request flow. Don't use for UI mockups, live production monitoring or code-level call graphs.
disable-model-invocation: true
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Architecture visualizer

Reads a project's files as text, builds a model of its components and request flows, and renders `docs/architecture.html`. Scripts gather facts and render; you connect the components and judge the flows. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- The user asks to visualize, map or explain how a system fits together, or how a request travels through it.
- A project has more than one moving part: an app plus a database, cache, queue, worker or outside service.

## Don't use when

- The user wants a UI mockup, live production monitoring, a code-level call graph or a cloud-account scan. This shows how requests would travel from the code, not real traffic.
- The project is a single static page with no services. Say so instead of drawing one box.

## Steps

1. If `docs/architecture.json` exists, copy it to `docs/architecture.base.json` first (for the Changes view later).
2. Run `node <skill>/scripts/discover.mjs --root . --out docs/architecture.draft.json`. Read its summary: components, **edge candidates** (high, medium, low), files read and skipped. It never opens `.env` files; do not open them either.
3. Read only the files needed to connect components: entry points, route handlers, data-access and queue modules, `docker-compose.yml`. Search first (`references/discovery.md`). Never run or import project code.
4. Write `docs/architecture.json` from the draft (`references/model-schema.md`):
   - Give each node a plain `label` (what it does, not its package name).
   - Settle every candidate: confirm it as an `edge` with its evidence (file and line), or delete it. Keep a low-confidence one only in `inferred`. Count confirmed, dropped and inferred.
   - Fill zones, data labels, `auth`, `tls`, `replicas` and `ai` only where a file shows it. If nothing does, leave the field out.
   - Add 1 to 5 `flows` (`references/flows.md`): page load, login, a write, a background job.
   - Anything without a file to point at goes in `inferred` and is drawn dashed.
5. Run `node <skill>/scripts/model-check.mjs --model docs/architecture.json`. Fix every problem it lists (it fails while any candidate is left) and run it again until it passes.
6. Run `node <skill>/scripts/risk-check.mjs --model docs/architecture.json --root .`. It adds rule-based possible risks. Add your own only with evidence (`references/risks.md`), then run model-check again.
7. Run `node <skill>/scripts/simulate.mjs --model docs/architecture.json --down <id>` for the one or two components with the most serious risks. Report the result as a what-if from the model (`references/simulation.md`).
8. Run `node <skill>/scripts/render.mjs --model docs/architecture.json --out docs/architecture.html`. Options: `--lang ar`, `--flow-dir rtl`, `--lens <name>`. If it refuses to overwrite a file, pick another `--out`; use `--force` only when the user says to replace it.
9. If `docs/architecture.base.json` exists, offer the Changes view: `node <skill>/scripts/diff.mjs --base docs/architecture.base.json --head docs/architecture.json --out docs/architecture.diff.json`, then render again with `--diff docs/architecture.diff.json`. For pull requests see `references/ci.md`.
10. Tell the user the file path and to open it in a browser (it works offline). See `references/lenses.md` for the views and `references/export.md` for exports.

## Budget

<!-- include: _shared/read-budget.md -->

- Let `discover.mjs` find components; do not read every file looking for them.
- Read to connect components and write flows, not to review code quality.
- Update an existing model instead of starting over: keep its labels, edges and flows, then re-run steps 5 to 8.
- Run `simulate.mjs` at most twice.

## Output

- The path of `docs/architecture.html` and `docs/architecture.json`.
- Counts: components, connections, flows, possible risks (rule-based and your own), and edge candidates (confirmed, dropped, inferred).
- The views on the page (System, and Flows, Security, Failure, AI or Changes when the model has something for them), and the export options: SVG, PNG, JSON, print.
- The what-if result for the components you tried, worded as "what the model says would happen", not a prediction.
- Which nodes or edges are inferred, and what the scripts could not see (for example Terraform, Python or Go code, anything not in a file).
- One line: generated from code, not live traffic; every risk is something to check, not a verdict. If you used `--lang ar`, say the Arabic text is a machine draft that needs a native speaker's review.

## Done when

- `model-check.mjs` exits 0 on the final model (so no candidate is left), and `risk-check.mjs` ran after the last change to nodes or edges.
- Every node and edge has evidence or is listed in `inferred`, every flow step points at a real edge, and no zone, auth, tls, data or AI fact is there without a file behind it.
- No secret value appears in the model, the page or your reply. `.env` files were not opened.
- `docs/architecture.html` was written and the user knows how to open it.
