# Acting a puppet scene

A `puppet` scene is one backdrop with up to four characters. The props live in `storyboard.md` (then `video.json`); the full list is in `video-core/references/scene-kinds.md`.

```
{"backdrop":{"preset":"meadow"},
 "cast":[{"rig":"nour","x":0.3,"y":0.78,"height":0.45,"speaks":["k1","k2"],
          "acts":[{"at":0.5,"do":"wave"},{"at":3,"do":"walk","to":0.6},{"at":6,"do":"emote","mood":"happy"}]}]}
```

- `x`: across the stage, 0 to 1. `y`: where the feet are, 0.2 to 1 (keep 0.8 or less on a 9:16 film so captions clear the feet). `height`: the share of the scene height. `flip`: face left at the start.
- `speaks`: narration line ids of this scene. The mouth follows `voice/visemes.json` for those lines only, so make it after voicing.
- Backdrops: `meadow` (day), `room` (indoors), `night`. Their layers drift slowly, so the picture is never still.
- Blinks happen by themselves. The body breathes a little at rest.

## Acts

One at a time per character; `at` is seconds from the start of the scene and a `dur` is optional.

| Act     | Needs             | What it does                                                                                                                  |
| ------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `walk`  | `to` (0 to 1)     | Walks to a place, turns to face the way it goes, swings arms and legs. Its length follows the distance unless `dur` is given. |
| `wave`  | none              | Raises the right arm and waves.                                                                                               |
| `jump`  | `lift` (optional) | Squashes, springs, stretches and lands.                                                                                       |
| `nod`   | none              | Nods twice.                                                                                                                   |
| `dance` | none              | Bounces with both arms up and a head sway.                                                                                    |
| `emote` | `mood`            | `neutral`, `happy`, `sad`, `surprised` or `sleepy` (eyes stay closed until the next mood).                                    |

## Pace and shape of an episode

- Scenes last at least 3 seconds (QA warns below). A single scene may hold the whole story; change backdrop between beats only when the place changes.
- Give the acts room: a wave 1.6 s, a jump 0.9 s, a walk across half the stage about 2 s.
- A character that speaks should be on screen with a visible mouth; a listener can `nod` or `emote`.
- Keep peril small and the tone kind. The learning goal is said once, in the `lesson` line.
