# The story pipeline

A story short from a premise makes a short from original characters shown in still images (made by `video-generate`, or supplied by the user), with slow camera motion on the stills, or short generated clips. Make `projects/<slug>/`. The pipeline script does not list these steps yet; follow the table and ask the user at each pause.

| Step                                         | Skill and command                                                           | Hands over                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| write                                        | `video-write` in story mode                                                 | `brief.json`, `script.md`, `style-bible.md`, `storyboard.md`    |
| references                                   | `video-story` `refpack.mjs`, then `video-generate image` for each view      | `refpack/<name>/*.png` (front view first; the user approves it) |
| shots                                        | `video-story` `shots.mjs`, `continuity.mjs`                                 | `shots.json`, `continuity.json`                                 |
| stills                                       | `video-generate image` (one per shot, `--ref` from `continuity.mjs --next`) | `generated/*.png`, `generation-log.jsonl`                       |
| clips (optional)                             | `video-generate video`, only for a non-stills generator                     | `generated/*.mp4`                                               |
| assemble                                     | `video-story` `shots.mjs --build`                                           | `video.json` of `broll` scenes                                  |
| voice, timing, captions, render, QA, publish | the same skills as the explainer                                            | MP4, QA report, pack                                            |

Pauses: the character front view, the shot list with its plan, and before any Higgsfield generation (the shot list and credit total). With no connector or a no use the `test` provider or the user's own images. Never retry a generation without asking. AI assets are marked `aiGenerated`; realistic people or places need the synthetic-content label.
