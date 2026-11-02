# The localize flow

`/video localize <project> --to ar|en [--dialect msa|egyptian]` is handled by `video-localize`; this table is the whole order. The pipeline script does not list it.

| Step      | Skill and command                                       | Hands over                              |
| --------- | ------------------------------------------------------- | --------------------------------------- |
| plan      | `video-localize` `localize.mjs plan`                    | `<project>.<lang>/translate.json`       |
| translate | the agent fills each `target`                           | `translate.json`                        |
| apply     | `localize.mjs apply` (pauses on problems)               | `video.json`, `script.md`, review notes |
| voice     | `video-voice` (3arab for Arabic, Kokoro for English)    | `voice/*.wav`, `words.json`             |
| timing    | `timing.mjs`, `captions.mjs`, `visemes.mjs` for puppets | `timing.json`, `captions.json`          |
| check     | `video-core` check, render, then `video-qa`             | MP4 and QA report                       |

Pause after `translate.json` is written (show the user a few lines) and after `translation-review.md`. Lip sync and voice cloning are not built; say so if asked.
