# Code scenes

- `language`: `javascript`, `typescript`, `json`, `bash` or `python` (also `js`, `ts`, `sh`, `py`). Another language is refused by `check.mjs`.
- Give either `code` or `diff` (`{"before": "...", "after": "..."}`), not both.
- At most 20 lines, 60 characters wide, 1,500 characters. Longer code is unreadable on a phone: show the part that matters and say where it comes from in `file`.
- Use the user's real code. Do not invent code that "would look right"; if you wrote it as an illustration, say so in the narration.
- `focus`: `[{"lines":[2,4],"line":0},{"lines":[5,7],"line":2}]`. From the start of narration line 0 (counting from 0 within the scene) lines 2 to 4 stay bright and the rest dim; line 2 moves the focus. Use `"at": seconds` instead of `"line"` when the scene has no narration lines.
- `diff` is by line. Removed rows show first (red), then added rows (green) at the middle of the scene. Keep a diff to the lines that changed plus a line of context.
- The code panel is always dark; its colours do not follow the brand. Letter shapes come from the machine's monospace font, so the same project can look slightly different on another computer.
