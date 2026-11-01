# Scene kinds

Text is always shown as text, never as HTML. The first scene is fully visible at frame 0 (it moves in but does not fade), so the thumbnail is not empty.

| Kind    | Props                                                                           | Notes                                                                                                                   |
| ------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `title` | `text` (required, 120 chars), `subtitle`                                        | Big line, optional second line that follows 0.25 s later.                                                               |
| `quote` | `text` (required, 300), `by`, `source`                                          | Accent bar on the reading-start side. Only quote real, attributed words.                                                |
| `list`  | `items` (1 to 8), `heading`, `numbered`                                         | With one narration line per item, each item appears with its line; otherwise they spread over the scene.                |
| `chart` | `type` (`bar` or `line`), `data` (2 to 24 of `{label, value}`), `title`, `unit` | Bars grow, a line draws itself. Values are plotted as given; negative values go below the baseline. Use real data only. |
| `broll` | `asset` (an id from `assets`), `fit` (`cover` or `contain`), `caption`          | Image or video (mp4, webm, mov). Stills get a slow push-in. A video's own sound is not used.                            |

`custom` is accepted by the schema but not built yet; render refuses it.
