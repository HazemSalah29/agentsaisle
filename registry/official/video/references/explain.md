# The explainer chain

`pipeline.mjs` reads the project folder and prints each step as `done`, `todo` or `stale` (a file it depends on changed after it). It runs nothing. Run it, do what `Next:` says, run it again.

| Step           | Skill and command                                                      | Hands over                                                         |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| write          | `video-write` (explain mode), held to `references/craft.md`            | `brief.json`, `script.md`, `facts.md`, `hooks.md`, `storyboard.md` |
| storyboard     | the user approves, then `video-write` `storyboard.mjs`                 | `video.json`                                                       |
| diagram scenes | `video-explain`, for each `rate-limit` or `request-flow` scene to fill | filled props in `video.json`                                       |
| voice          | `video-voice` (then `align.mjs`)                                       | `voice/<line>.wav`, `voice/words.json`                             |
| draft          | `video-core` `build.mjs --draft` (check, timing, render)               | `out/<project>-draft.mp4`                                          |
| review         | the score card in `references/craft.md`; then `review.mjs approve`     | `approval.json`                                                    |
| render         | `video-core` `build.mjs` (refuses a stale approval)                    | `out/<project>.mp4`, `.srt`, `.vtt`, credits                       |
| QA             | `video-qa`                                                             | `qa/report.json`, `qa/contact-sheet.png`                           |
| publish        | `video-publish` (never uploads)                                        | `exports/<platform>/`                                              |

## Shape of a 35-second explainer

| Beat      | Seconds  | Usual kind                                                                   |
| --------- | -------- | ---------------------------------------------------------------------------- |
| Hook      | 2 to 4   | `title` (number starred) or `kinetic`                                        |
| Stakes    | 2 to 3   | `kinetic` or `number`                                                        |
| Mechanism | 12 to 20 | 2 to 4 of `code`, `request-flow`, `sequence`, `nodes`, `steps`, `rate-limit` |
| Proof     | 4 to 7   | `rate-limit`, `chart`, `number` or `terminal`                                |
| Takeaway  | 2 to 4   | `kinetic` slab (`bg: accent`) or `versus`                                    |
| CTA       | 2 to 3   | `title` with a kicker                                                        |

Kinds and their props are in `video-core/references/scene-kinds.md`. Captions are burned in by the render (`style.captions`, default `pop`) and SRT/VTT files are written next to the MP4; kinetic scenes skip captions because their words are the picture.

## When something fails

Name the failing file or check in one line, say which step fixes it, and go back to that step. Do not patch `video.json` by hand to make a check pass.
