# storyboard.md

A markdown table. The header names the columns (case does not matter); `scene` and `kind` are required.

```
| scene | kind | narration | visual | seconds | transition | props |
| --- | --- | --- | --- | --- | --- | --- |
| intro | title | l1 | big title | | | `{"text":"Rate limiting"}` |
| steps | list | l3,l4,l5 | three steps | | fade | `{"items":["Take","Refill","Reject"],"numbered":true}` |
```

- `scene`: lowercase letters, digits, hyphens. `kind`: one of `title`, `list`, `number`, `versus`, `steps`, `code`, `terminal`, `chart`, `nodes`, `request-flow`, `rate-limit`, `sequence`, `quote`, `broll`, `kinetic` (props for each: `video-core/references/scene-kinds.md`).
- `narration`: comma-separated line ids from `script.md`. Every script line must be used by one scene.
- `seconds`: with narration it is a minimum length; without narration it is the fixed length.
- `transition`: `slide` (the default), `fade`, `whip`, `zoom-through`, `slash`, `shatter` or `cut` (`video` skill, `references/craft.md`, says when to use which).
- `props` is a JSON object inside backticks; a `|` inside it is fine.
- `visual` and any other columns are notes for the user and are ignored.

The user approves this table before `storyboard.mjs` writes `video.json`.

## Technical kinds

For a beat that explains an algorithm, a code change, a message exchange or a request path, use `rate-limit`, `code`, `sequence` or `request-flow` instead of a list. Write the props you know and leave the rest to `video-explain` (it runs the simulation and imports the flow, so no result is typed by hand):

- `rate-limit`: write `{}`; `video-explain` fills it with `simulate.mjs`.
- `request-flow`: write `{}`; `video-explain` fills it with `arch-import.mjs` from `docs/architecture.json`.
- `sequence`: `{"source": "A->B: text"}`; `code`: `{"language": "ts", "code": "..."}`.

`video.json` will not pass `check.mjs` until `video-explain` has filled the empty ones.

## Picking the kind from what the line says

| The line says ...                        | Kind                                                        |
| ---------------------------------------- | ----------------------------------------------------------- |
| a hook, a section turn, a call to action | `title`                                                     |
| one number that matters                  | `number`                                                    |
| a short, punchy claim or the takeaway    | `kinetic` (`bg: accent` for the hardest-hitting one)        |
| "X or Y", "instead of", "vs"             | `versus`                                                    |
| "first, then, finally", a process        | `steps`                                                     |
| three or four named things               | `list` (spotlight)                                          |
| how the code does it                     | `code` (`focus` on the lines being said)                    |
| a command and what comes back            | `terminal`                                                  |
| numbers compared or over time            | `chart`                                                     |
| parts of a system and how they connect   | `nodes`, or `request-flow` from a real architecture         |
| who sends what to whom, in order         | `sequence`                                                  |
| an algorithm under load                  | `rate-limit` (or another simulation `video-explain` offers) |

- Numbers, values and labels are only ever the ones in the user's facts. Never invent a stat to fill a `number` or a `chart`.
- Every item enters on the word that names it. Give `on` (the spoken words) only when the item's own words are not said.
- One idea per scene, no more than 6 items, and never two scenes of the same kind back to back (kinetic beats excepted).

## Pace

`write-check.mjs` warns when a scene carries more than about 3.5 s of narration per item (a list, steps, chart, nodes or versus scene) or more than 7 s in one scene: the picture would wait on the voice. Fixes, in order: `"layout":"spotlight"` on `list` (one item fills the frame at a time), split the scene so the picture changes with the idea, or cut words.
