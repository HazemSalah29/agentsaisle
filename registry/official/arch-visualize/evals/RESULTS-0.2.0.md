# Results: arch-visualize 0.2.0

Everything here was measured in this repository on the final tree, with the method described in `BASELINE.md` (same counter, same sampling, same models). Only these numbers may be used in the README, the skill page and any post. Where a number could not be measured, this file says so.

## Discovery (`discover.mjs`)

Measured on `evals/fixture-app`, grown in 0.2.0 to cover every pattern discovery looks for. `expected.json` lists 16 true connections; 14 are shown by a file and 2 are not.

| Measure                                                   | 0.1.1 method         | 0.2.0           |
| --------------------------------------------------------- | -------------------- | --------------- |
| Components found                                          | 9 of 9 (old fixture) | 14 of 14        |
| File-backed connections found by `edges` alone            | 5 of 14 (0.36)       | 5 of 14 (0.36)  |
| File-backed connections found by `edges` and `candidates` | not available        | 14 of 14 (1.00) |
| Candidates that are not a real connection                 | not available        | 0 of 11         |

- On the original, smaller fixture the 0.1.1 method found 5 of its 9 file-backed connections (0.56). I first wrote "5 of 5" for it in M0; that list was too short.
- DevPath: 11 of 12 components and 2 of 13 connections, recorded from the 0.1.1 run. DevPath's source is not in this repository, so it was **not run again** and no 0.2.0 number exists for it.
- The fixture was written by me, so 1.00 means the patterns I thought of are found, not that real projects reach 1.00. A spot check on this repository found one genuine candidate and no false one: one project, not a study.

## Page size and speed

| Measure                                                     | 0.1.1  | 0.2.0       |
| ----------------------------------------------------------- | ------ | ----------- |
| Viewer parts, libraries, styles, text (bytes, not rendered) | 60,768 | 198,425     |
| Rendered fixture page (9 components)                        | 78 KB  | 194 KB      |
| Rendered DevPath page (12 components)                       | 73 KB  | 190 KB      |
| `render.mjs` wall time, cold start                          | 0.03 s | 0.02 s      |
| 150 components, 300 connections: layout time (Node)         | n/a    | about 75 ms |

The budgets agreed before the work were 300 KB for the viewer and 1.5 MB for the fixture page; both hold. The page grew about 120 KB for the layout, search, trace, links, simulation, diff, export and text modules and the Arabic text table.

## Layout

Measured in Chromium at 1440×900, every edge path sampled at 80 points, crossings within 10 px of an end ignored.

| Page         | Crossings 0.1.1 | Crossings 0.2.0 | Edges through boxes 0.1.1 | 0.2.0 |
| ------------ | --------------- | --------------- | ------------------------- | ----- |
| Fixture      | 9               | 4               | 0                         | 0     |
| DevPath demo | 26              | 6               | 0                         | 0     |

## What was added

| Measure                                          | 0.1.1                            | 0.2.0                                         |
| ------------------------------------------------ | -------------------------------- | --------------------------------------------- |
| Commands (scripts you run)                       | 4                                | 6 (`simulate`, `diff` added)                  |
| Risk rules                                       | 10                               | 18                                            |
| Views on the page                                | 1 (plus the request flow player) | System, Flows, Security, Failure, AI, Changes |
| UI languages                                     | 1                                | 2 (Arabic is a machine draft)                 |
| Exports                                          | none                             | SVG, PNG, JSON, print                         |
| Tests in `registry/skill-tests` (whole registry) | n/a                              | 1,114 pass                                    |

## Not measured

- **Tokens and tool calls for a full skill run, before and after.** No run log of a full skill run exists for either version, and one would need a model session on the fixture. I did not estimate it. If it matters for a decision, it needs to be measured in a real session.
- **Time to read a diagram, or how easy the page is to understand.** No user study was done.

## Caveats

- The Arabic text and the right-to-left layout have not been read by a native speaker (`UI-TRANSLATION-REVIEW.md`).
- PNG export was checked in Chromium only; Firefox and Safari are `TODO(verify)`.
- Whether a code-scanning host shows the SARIF `help` text the same way is `TODO(verify)`. The CI recipe (`references/ci.md`) was not run on a real project and its action names and versions are `TODO(verify)`.
- Discovery reads text with patterns, for JavaScript and TypeScript code only. Wrappers, injected clients and dynamic names are missed, and an import can look like a connection when it is not; that is why each one is a candidate to confirm.
- The Security and AI views show only what the model records, and the model records only what a file shows. Zone shading is drawn per component, not as one region.
- The what-if is what the model says would happen. It is not a prediction about production.
- The DevPath demo is the committed model drawn with the current viewer; it was not discovered again.
- Not in 0.2.0: click-to-source links (`--source-links`), the `--title` flag, WebM export. See `LATER.md`.
