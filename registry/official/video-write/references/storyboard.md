# storyboard.md

A markdown table. The header names the columns (case does not matter); `scene` and `kind` are required.

```
| scene | kind | narration | visual | seconds | transition | props |
| --- | --- | --- | --- | --- | --- | --- |
| intro | title | l1 | big title | | | `{"text":"Rate limiting"}` |
| steps | list | l3,l4,l5 | three steps | | fade | `{"items":["Take","Refill","Reject"],"numbered":true}` |
```

- `scene`: lowercase letters, digits, hyphens. `kind`: `title`, `quote`, `list`, `chart` or `broll` (props for each: `video-core/references/scene-kinds.md`).
- `narration`: comma-separated line ids from `script.md`. Every script line must be used by one scene.
- `seconds`: with narration it is a minimum length; without narration it is the fixed length.
- `transition`: `cut` and `fade` are built; the others render as a cut.
- `props` is a JSON object inside backticks; a `|` inside it is fine.
- `visual` and any other columns are notes for the user and are ignored.

The user approves this table before `storyboard.mjs` writes `video.json`.
