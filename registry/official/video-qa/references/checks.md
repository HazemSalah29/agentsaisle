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
| flashing                       | More than 3 flashes in one second                                                                                             | Remove the strobe; use a fade.                                                                         |
| safe-zone                      | Something is drawn in the outer margin (4% on the sides and top, 8% at the bottom of vertical video) outside full-frame media | Move or shrink the content. The margins are the library's own, not verified platform UI margins.       |
| caption-size, caption-contrast | Captions under 4.5% of the height, or text against background under 4.5:1                                                     | Choose a bigger caption style or change brand colours.                                                 |
| project                        | `video-core` `check.mjs` finds a problem (props, assets, licences)                                                            | Fix what it lists.                                                                                     |
| disclosure                     | Disclosure flags say less than the assets imply                                                                               | Set the flags in `video.json`; run `credits.mjs`.                                                      |
| voiced                         | A narration line has no `voice/<id>.wav`                                                                                      | Run `video-voice` again.                                                                               |
| text                           | A leftover `TODO`, `TBD`, `[needs-source]` or `???`, or a doubled word                                                        | Fix the text; never publish a placeholder.                                                             |

## Not checked

- Spelling: no dictionary ships with the skill, so spelling is for you to read in the contact sheet.
- Kids' rules (planned with the kids' skill), accuracy of the content, and rights beyond the licence field.
