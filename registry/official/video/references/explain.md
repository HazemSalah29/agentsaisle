# The explainer pipeline

`pipeline.mjs` reads the project folder and prints each step as `done`, `todo`, `stale` (a file it depends on changed after it) or `blocked` (a skill is not installed, or the step is not built). It runs nothing. Run it, do what `Next:` says, run it again.

| Step           | Skill and command                                                            | Hands over                                                         |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| write          | `video-write` (explain mode)                                                 | `brief.json`, `script.md`, `facts.md`, `hooks.md`, `storyboard.md` |
| storyboard     | the user approves, then `video-write` `storyboard.mjs`                       | `video.json`                                                       |
| diagram scenes | `video-explain`, for each `rate-limit` or `request-flow` scene still empty   | filled props in `video.json`                                       |
| voice          | `video-voice`                                                                | `voice/<line>.wav`, `voice/words.json`                             |
| timing         | `video-core` `timing.mjs`                                                    | `timing.json`                                                      |
| captions       | `video-captions --burn`                                                      | `captions.json`, `.srt`, `.vtt`                                    |
| draft          | `video-core` `render.mjs --draft`, `review.mjs stills`, `review.mjs approve` | `out/<project>-draft.mp4`, `approval.json`                         |
| render         | `video-core` `render.mjs` (refuses a stale approval)                         | `out/<project>.mp4`, `out/<project>.validation.json`               |
| QA             | `video-qa`                                                                   | `qa/report.json`, `qa/contact-sheet.png`                           |
| publish        | `video-publish` (never uploads)                                              | `exports/<platform>/`, `exports/publish.json`                      |

A change to `video.json` or to a voice file makes timing, captions, render and QA `stale`; redo them in that order. Captions come before the final render because they are burned into it.

## What you pass between steps

Nothing but the project folder. Every skill reads its inputs from files there, so the user can stop and edit between steps. Say what the user can edit at each pause (the script, the storyboard, `brand/brand.json`).

## When something fails

Name the failing file or check in one line, say which step fixes it, and go back to that step. Do not patch `video.json` by hand to make a check pass.

## Pace and transitions

- Pick the kind from what the line says (`video-core/assets/scene-catalog.json`). When a scene has several seconds of narration per item, use `"layout":"spotlight"`; keep the default stack for short items said quickly.
- Between idea scenes use `fade` by default, one `whip` for a change of topic, and a `slash` only where it is more than 2.5 s from the last one. Never put a transition on every scene.
- If `video-qa` reports an idle stretch, name the scene it gives, then: leave `focus` on, use spotlight, or split the scene. Do not add decoration to hide a long hold.
