# What each check means and what fixes it

Numbers are working defaults in `assets/rules.json` (`TODO(verify)`: confirm each against the platform's current help pages). They are not platform rules.

| Check                          | Fails when                                                                                                                    | Fix                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| resolution, fps, codec         | The file is not the size, rate or h264/yuv420p the project says (a `--draft` only has to have the same shape)                 | Render again with `video-core` `render.mjs`; do not re-encode by hand.                                 |
| duration                       | Differs from `timing.json` by more than 0.35 s, or over the platform's limit                                                  | Re-run `timing.mjs` and render; shorten the script.                                                    |
| audio                          | The project has voice or music but the file has no audio track                                                                | Render again after `voice` or `music` is set; check `voice/` exists.                                   |
| loudness                       | Integrated loudness is more than 4 LU from -14 LUFS (warns past 2)                                                            | Re-mix with `render.mjs`; do not change the voice files.                                               |
| clipping                       | True peak is 0 dBTP or above (warns above -1)                                                                                 | Lower the music or the voice level in `video.json` and render again.                                   |
| black                          | A black picture lasts 0.4 s or more                                                                                           | A scene has no content or a missing asset; fix the scene.                                              |
| freeze                         | Nothing changes for 3 s or more (a warning)                                                                                   | Shorten the scene, add a step or a caption change, or accept it for a code scene the viewer must read. |
| idle                           | Nothing moves for more than 1.2 s (the last 2 s and full-frame media are exempt). A warning                                   | Add a slow push, a highlight, or bring the next item in sooner.                                        |
| speed                          | A move changes the picture hard for 0.3 s or more (cuts, transitions and product edits are exempt). A warning                 | Slow the move or give it more time.                                                                    |
| joins                          | The picture swaps in one frame where a scene starts with no transition. A warning                                             | Add a `transitionIn`, or keep the cut on purpose.                                                      |
| scene-length                   | A scene lasts under 2 s (a fail under 1 s)                                                                                    | Merge it with its neighbour or give it more narration.                                                 |
| flashing                       | More than 3 flashes in one second                                                                                             | Remove the strobe; use a fade.                                                                         |
| safe-zone                      | Something is drawn in the outer margin (4% on the sides and top, 8% at the bottom of vertical video) outside full-frame media | Move or shrink the content. The margins are the library's own, not verified platform UI margins.       |
| caption-size, caption-contrast | Captions under 4.5% of the height, or text against background under 4.5:1                                                     | Choose a bigger caption style or change brand colours.                                                 |
| project                        | `video-core` `check.mjs` finds a problem (props, assets, licences)                                                            | Fix what it lists.                                                                                     |
| disclosure                     | Disclosure flags say less than the assets imply                                                                               | Set the flags in `video.json`; run `credits.mjs`.                                                      |
| voiced                         | A narration line has no `voice/<id>.wav`                                                                                      | Run `video-voice` again.                                                                               |
| text                           | A leftover `TODO`, `TBD`, `[needs-source]` or `???`, or a doubled word                                                        | Fix the text; never publish a placeholder.                                                             |

## Not checked

- Spelling: no dictionary ships with the skill, so spelling is for you to read in the contact sheet.
- Accuracy of the content, whether a story suits a child, and rights beyond the licence field.

## Kids' videos

A project is a kids' video when `meta.type` is `kids` or `meta.audience` starts with `kids`. Everything above applies, with stricter numbers from the `kids` block of `assets/rules.json` (all working defaults, `TODO(verify)`), plus these checks. They read the project's files only.

| Check             | Fails or warns when                                                                                                  | Fix                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| kids-audience     | Fails when the audience names no age band (`kids-3-5` or `kids-6-9`)                                                 | Set `meta.audience`. It also makes the publish pack answer "made for kids: yes". |
| kids-pace         | A line runs over 2.0 (ages 3 to 5) or 2.6 (6 to 9) words a second: warns, fails past 30% over                        | Shorten the line or lengthen the scene; render again.                            |
| kids-sentences    | A sentence is over 9 (3 to 5) or 15 (6 to 9) words (a warning)                                                       | Split the sentence in `script.md`.                                               |
| kids-pressure     | "Like and subscribe", "follow us" or similar appears in the script or on screen                                      | Remove it. Children are never asked to act.                                      |
| kids-language     | Words from the unkind or frightening lists appear (a warning: read them in context)                                  | Reword, or accept it where the story needs the word and stays gentle.            |
| kids-cuts         | A scene is under 3 seconds (a warning)                                                                               | Merge scenes or hold longer.                                                     |
| kids-caption-size | Captions under 6% of the height, or none (a warning when none), flashing over 2 a second, caption contrast under 7:1 | Use `video-captions --style kids`; remove the strobe.                            |
| kids-characters   | A puppet character has no `characters/<name>/bible.md`                                                               | Run `video-kids` to write the bible; characters must be original.                |
| kids-footage      | A `broll` scene is present (a warning)                                                                               | Check no real child is shown and the licences are right.                         |

## Lessons

A project may keep `lessons.json` next to `video.json`: flat numbers that change the motion limits for that project only. Allowed: `minSceneSeconds` (0.5 to 10), `maxIdleSeconds` (0.5 to 10) and `maxFastDiff` (10 to 120). Anything else is ignored and reported. Write a lesson when the owner corrects something that a limit could have caught, and keep the plain-words version in `lessons.md` for the next build to read.
