# The kids' pipeline

A kids' cartoon (age 3-5 or 6-9) makes a cartoon for children from original puppet characters. Only `--budget $0` exists: local tools, no paid service, no generated pictures. Make `projects/<slug>/`, then run `node <skill>/scripts/pipeline.mjs projects/<slug> --kids` before and after each step (the flag is only needed until `brief.json` exists).

| Step         | Skill and command                                      | Hands over                                                                                  |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| characters   | `video-kids` (new character)                           | `characters/<name>/bible.md`, `puppet.json`, `sheet.svg`                                    |
| write        | `video-write` in kids mode                             | `brief.json` (with `audience` and `learningGoal`), `script.md`, `hooks.md`, `storyboard.md` |
| storyboard   | the user approves, then `video-write` `storyboard.mjs` | `video.json` (type `kids`, captions style `kids`)                                           |
| acting       | `video-kids` (`references/acting.md`)                  | acts, backdrop and `speaks` in each `puppet` scene                                          |
| voice        | `video-voice` (a gentle voice; then align the words)   | `voice/<line>.wav`, `voice/words.json`                                                      |
| mouth shapes | `video-kids` `visemes.mjs`                             | `voice/visemes.json`                                                                        |
| timing       | `video-core` `timing.mjs`                              | `timing.json`                                                                               |
| captions     | `video-captions --style kids --burn`                   | `captions.json`, `.srt`, `.vtt`                                                             |
| render       | `video-core` `render.mjs` (a `--draft` first)          | `out/<project>.mp4`                                                                         |
| QA           | `video-qa` (kids' checks run by themselves)            | `qa/report.json`, `qa/contact-sheet.png`                                                    |
| publish      | `video-publish` (never uploads)                        | `exports/<platform>/`; the pack says "made for kids: yes"                                   |

Pauses, in order: the character sheet (the user opens `sheet.svg` and says yes), the storyboard, then a draft frame per scene before the final render. Never skip QA. The pipeline names an `acting` step through `video.json` and the `puppet` check, not as a row of its own: `check.mjs` lists what is still missing.

Rules that hold for the whole run: original characters only, nothing asks children to like, subscribe or follow, one learning goal, a kind tone, nothing uploaded. If a rule is hit, name it in one line and go back to the step that fixes it.
