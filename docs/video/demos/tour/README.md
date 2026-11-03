# Codebase tour demo

A 40-second tour made by the `video` skill's tour recipe from the architecture model [`../request-flow/docs/architecture.json`](../request-flow/docs/architecture.json) (the `aisle add` path, scoped by hand and checked by `arch-visualize`). Components, steps and the `file:line` evidence under each step all come from the model, and `facts.md` lists them; nothing is invented. Kokoro voice (synthetic), 1080x1920.

The tour says what the code says, not live traffic, and covers only the `aisle add` flow, not the whole repository. `video-qa` passes with no warnings (`qa/report.json`).

Reproduce:

```
node <video>/scripts/tour.mjs --model ../request-flow/docs/architecture.json --out projects/tour
# then voice, align, timing, captions, render and qa as in ../incident/README.md
```
