# Video library: M0 research check (2026-11-01)

Checked against the pages linked in each row. Anything not confirmed stays `TODO(verify)`. Not legal advice.

## Verified facts

| Item                                                                    | Result                                                                                                                                                                                                                                                                                                                                                    | Status                                                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| HyperFrames                                                             | Canonical repo is `github.com/heygen-com/hyperframes` (the brief cited a mirror). Apache 2.0, "no per-render fees". Needs Node 22+ and FFmpeg. CLI: `init`, `preview`, `render`, `add`, `skills update`. Animation: GSAP, CSS, Lottie, Three.js, Anime.js, WAAPI, custom frame adapters. Compositions register a paused timeline on `window.__timelines`. | Changed (repo URL, `skills update` command). Latest version `TODO(verify)` (page shows none). |
| GSAP licence                                                            | Standard licence allows use on any website, web app or digital interface. Prohibited: use in tools that let users **build visual animations without code** and help compete with Webflow's animation tools. Code-only tools (including AI-generated code) are not prohibited per its FAQ. No clause on redistribution or video rendering.                 | Verified, with a risk.                                                                        |
| Remotion                                                                | Free for individuals, non-profits and for-profits of up to 3 employees; companies with more need a licence. Terms change in Remotion 5.0.                                                                                                                                                                                                                 | Unchanged.                                                                                    |
| Kokoro-82M                                                              | Apache 2.0, 82M parameters, 8 languages and 54 voices in v1.0. Arabic not confirmed. CPU speed not stated.                                                                                                                                                                                                                                                | Partly verified. CPU speed `TODO(verify)`.                                                    |
| 3arab-TTS-500M-v2                                                       | Apache 2.0, ~553M parameters, MSA strongest, Egyptian improved. Arabic text only, numbers as words, some words need diacritics, built-in SilentCipher watermark. Base-model licence (3arab-TTS-500M-v1) not stated. Install uses a CUDA 12.8 extra, so **CPU use is unconfirmed**.                                                                        | Partly verified. Base licence and CPU speed `TODO(verify)`.                                   |
| Manim Community                                                         | MIT (also carries a 3b1b copyright line). Needs system libraries (FFmpeg, Cairo, Pango, usually LaTeX for maths). Latest version and Python range `TODO(verify)`.                                                                                                                                                                                         | Partly verified.                                                                              |
| YouTube disclosure                                                      | Creators must disclose realistic altered/synthetic content, kids' content included. Disclosing does not limit reach or monetization. Sources disagree on dates (Jan 2026, May 2026), so the 27 May 2026 auto-label claim is unconfirmed. COPPA is a data-collection rule, not the disclosure rule.                                                        | Partly verified. Read YouTube's own help pages before M4 (`video-publish`).                   |
| Higgsfield Katana, Meta/C2PA, loudness target, flash limits, safe zones | Not checked in M0 (not needed before M7/M4/M6).                                                                                                                                                                                                                                                                                                           | `TODO(verify)`                                                                                |

## Decisions recorded

- **D1 HyperFrames first**, Remotion as the second adapter in M9.
- **D2 GSAP chosen by you.** Our scene components are code the agent writes, so they should be allowed. The risk: a future visual editor on top of the library could cross the "visual animation builder" line. Do not build one without asking GSAP. GSAP is **not** bundled by us: scenes load a pinned copy (see D8 table); if redistribution is disallowed, scenes use our own tween helpers instead.
- **D3 Kokoro (EN) + 3arab-TTS (AR), local. D4 Manim in 0.1. D5 explainer first. D6 SVG puppets only. D7 new `video` aisle.**
- Naming: single niche `video`, aisle `video` (replaces `media`'s `video`; `image` stays under a "coming later" aisle). **Needs your OK** (the brief's four niches break the `<niche>-<task>` rule).

## Dependency table for approval (D8)

| Name                                        | Licence                          | Size                   | Why                           | Needed from     |
| ------------------------------------------- | -------------------------------- | ---------------------- | ----------------------------- | --------------- |
| FFmpeg (system)                             | LGPL/GPL by build                | ~80 MB                 | encode, audio, QA             | M0 hello render |
| `hyperframes` (npm, pinned later)           | Apache 2.0                       | `TODO(verify)`         | render engine                 | M0 hello render |
| GSAP (npm, pinned later)                    | GSAP standard                    | ~70 KB                 | animation inside scenes       | M1              |
| Puppeteer/Chromium (comes with HyperFrames) | Apache 2.0 / BSD                 | ~150-400 MB            | headless render               | M0              |
| Kokoro (Python pkg + weights)               | Apache 2.0                       | ~330 MB `TODO(verify)` | English voice                 | M2              |
| 3arab-TTS-500M-v2                           | Apache 2.0                       | ~1-2 GB `TODO(verify)` | Arabic voice                  | M2              |
| whisper.cpp + model                         | MIT                              | 150 MB-1.5 GB          | captions                      | M2              |
| Manim Community (+ Cairo, Pango, LaTeX)     | MIT                              | ~1 GB with LaTeX       | maths scenes                  | M3              |
| Shiki, D3, rough.js                         | MIT, MIT/ISC, MIT `TODO(verify)` | small                  | code, charts, hand-drawn look | M3              |

Nothing in this table is installed yet. Your machine today: Node 24.17, Python 3.9.6, no FFmpeg. Python 3.9 may be too old for the TTS packages and Manim (`TODO(verify)`); `brew install python` would fix that.

## Hello render

Not done yet. Needs your yes to the table rows marked "M0" and `brew install ffmpeg` run by you.
