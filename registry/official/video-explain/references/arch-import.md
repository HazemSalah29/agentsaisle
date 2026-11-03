# Request flows from an arch-visualize model

1. The model is `docs/architecture.json`, written by `/arch-visualize` (skill `arch-visualize`). If it does not exist, stop and ask the user to run that first. Do not guess an architecture.
2. `node <skill>/scripts/arch-import.mjs --model docs/architecture.json --list` shows the flows (a flow is one journey, 4 to 10 steps).
3. Import one: `--flow <id> --into <project>/video.json --scene <scene-id>` (the scene must exist, with kind `request-flow`). The script keeps only the components and connections the flow touches and writes `file:line` evidence under each step.
4. Write one narration line per step so each step plays with its line. Use the step labels as they are.

## Say what the picture is

The model is built from the project's code and config. It shows how requests would travel according to the code, not live traffic, and it has no timings. Say that once in the narration ("according to the code"). Never add milliseconds; the scene accepts an `ms` on a step only for a number the user measured and gave you.

## Limits

At most 10 components and 14 steps in one scene. Split a long flow in two scenes. Components appear in rows by tier (clients, edge, frontend, backend, async, data, external).
