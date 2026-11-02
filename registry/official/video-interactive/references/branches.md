# Branch details

`interactive.json` sits next to `video.json`:

```
{ "version": 1, "branches": [ { "id": "pick", "after": "s3", "question": "Which one?",
    "options": [ { "label": "Token bucket", "from": "s4", "to": "s5" },
                 { "label": "Sliding window", "from": "s6", "to": "s7" } ],
    "then": "s8" } ] }
```

- The question appears when scene `after` ends and the clock holds on its last frame. Choosing an answer plays that answer's scenes (`from` to `to`), then every path continues at `then` (or ends when `then` is `"end"`).
- Layout in `video.json`: `after`, then answer 1's scenes, then answer 2's, and so on, then `then`. The checker names the scene each part must start with.
- Limits: 4 branches a project, 2 to 4 answers, a question of 100 characters, a label of 40. Plain text only (no control or direction marks).
- Scrubbing: dragging into an answer plays that answer, then continues. Dragging past a question skips it.
- Speed: 0.5x to 2x. Keys: space plays or pauses, the arrow keys jump 5 seconds.
- Not built: branches that loop back, scores or state, a question inside a scene, video clips in the page.
