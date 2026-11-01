# Baseline: arch-visualize 0.1.1

Measured on 2026-11-01 (M0 of `ARCH_VISUALIZE_V2_BRIEF.md`). Everything in `RESULTS-0.2.0.md` is compared with this file.

## Screenshots

`evals/baseline-0.1.1/`: the fixture model and the DevPath demo at 1440×900 and 390×844, light and dark (8 PNGs, taken with Chromium via the Playwright already installed for `apps/web`).

## Numbers

| Measure                                       | Fixture (`fixture-model.json`) | DevPath demo |
| --------------------------------------------- | ------------------------------ | ------------ |
| `viewer.html` template, bytes                 | 60,768                         | same         |
| Rendered page                                 | 78 KB                          | 73 KB        |
| `render.mjs` wall time (node, cold start)     | 0.03 s                         | 0.02 s       |
| Components / connections / flows in the model | 9 / 11 / 3                     | 12 / 13 / 4  |

## Discover recall

| Run                                         | Components | Connections |
| ------------------------------------------- | ---------- | ----------- |
| Fixture (`discover.mjs` vs `expected.json`) | 9 of 9     | 5 of 5      |
| DevPath (from the demo notes)               | 11 of 12   | 2 of 13     |

Finding: the fixture is too easy to show the weakness. `expected.json` lists 5 edges while the hand-written fixture model has 11, and all 5 are compose or Prisma links the draft already finds. The 0.8 target in section 8.1 is already met at 1.0 on the current fixture, so M6 must grow the fixture (and `expected.json`) first, otherwise the number says nothing. The honest edge baseline is the DevPath 2 of 13.

## Layout (crossings)

Measured in Chromium at 1440×900: every edge path is sampled at 80 points with `getPointAtLength` and counted with `ArchGeometry.polylineCrossings` (crossings within 10 px of an edge's start or end are ignored, so edges that meet at one node do not count). The same counter and the same sampling are used before and after.

| Page         | Crossings 0.1.1 | Crossings M2 | Edges through boxes 0.1.1 | M2  |
| ------------ | --------------- | ------------ | ------------------------- | --- |
| Fixture      | 9               | 4            | 0                         | 0   |
| DevPath demo | 26              | 6            | 0                         | 0   |

Straight-line count in Node (no curve sampling): fixture 3, DevPath 6. A random 150-node, 300-edge graph lays out in about 80 ms (366 lane slots for the long edges).

## After M3 (new viewer)

| Measure                                               | 0.1.1  | After M3 |
| ----------------------------------------------------- | ------ | -------- |
| Viewer template (parts and libraries together), bytes | 60,768 | 122,405  |
| Rendered fixture page                                 | 78 KB  | 128 KB   |
| Rendered DevPath page                                 | 73 KB  | 124 KB   |
| `render.mjs` wall time (node, cold start)             | 0.03 s | 0.02 s   |

The D6 budget (300 KB for the viewer and its libraries, 1.5 MB for the fixture page) holds. Screenshots of every view that exists are in `evals/m3-viewer/`. The page grew about 50 KB: the layout, search, trace, link and detail modules, the Arabic text table and the new styles.

## Tokens and tool calls

No eval-run log exists for a full skill run, so there are no numbers. M8 will measure it by running the skill once on the fixture with the old and new version and reading the token and tool-call totals from the session transcript.
