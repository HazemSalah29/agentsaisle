# storyboard.md

A markdown table. The header names the columns (case does not matter); `scene` and `kind` are required.

```
| scene | kind | narration | visual | seconds | transition | props |
| --- | --- | --- | --- | --- | --- | --- |
| intro | title | l1 | big title | | | `{"text":"Rate limiting"}` |
| steps | list | l3,l4,l5 | three steps | | fade | `{"items":["Take","Refill","Reject"],"numbered":true}` |
```

- `scene`: lowercase letters, digits, hyphens. `kind`: `title`, `quote`, `list`, `chart`, `broll`, or the technical kinds `rate-limit`, `code`, `sequence` and `request-flow` (props for each: `video-core/references/scene-kinds.md`).
- `narration`: comma-separated line ids from `script.md`. Every script line must be used by one scene.
- `seconds`: with narration it is a minimum length; without narration it is the fixed length.
- `transition`: `cut` and `fade` are built; the others render as a cut.
- `props` is a JSON object inside backticks; a `|` inside it is fine.
- `visual` and any other columns are notes for the user and are ignored.

The user approves this table before `storyboard.mjs` writes `video.json`.

## Technical kinds

For a beat that explains an algorithm, a code change, a message exchange or a request path, use `rate-limit`, `code`, `sequence` or `request-flow` instead of a list. Write the props you know and leave the rest to `video-explain` (it runs the simulation and imports the flow, so no result is typed by hand):

- `rate-limit`: write `{}`; `video-explain` fills it with `simulate.mjs`.
- `request-flow`: write `{}`; `video-explain` fills it with `arch-import.mjs` from `docs/architecture.json`.
- `sequence`: `{"source": "A->B: text"}`; `code`: `{"language": "ts", "code": "..."}`.

`video.json` will not pass `check.mjs` until `video-explain` has filled the empty ones.
