# The demo script (`demo.md`)

One step a line, plain text. Blank lines and `# comment` lines are ignored. `capture.mjs` refuses anything else and names the line.

| Step                 | Meaning                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| `go /path`           | Open a path on the app. Only a path that starts with `/`; never another address. |
| `say <id>`           | Mark where narration line `<id>` starts (an id from `script.md`).                |
| `hover "Text"`       | Move the cursor to a target.                                                     |
| `click "Text"`       | Click a target.                                                                  |
| `type #email "text"` | Click a field and type (up to 120 characters).                                   |
| `scroll down 600`    | Scroll `down` or `up` by pixels (1 to 4000).                                     |
| `wait 1.5`           | Pause up to 10 s. Waiting is cut from the film.                                  |

A target is quoted text on the page (`"Start free trial"`) or a CSS selector that starts with `#`, `.` or `[` (or `css=`). A bare word is refused as ambiguous. The first step must be `go`. At most 60 steps.

Rules: never type into a password, card or key field (the script refuses); use dummy data on a normal field. Show a real, working path, one idea per beat; a showcase of 30 to 60 seconds needs 8 to 20 steps. Numbers and quotes shown on the page must be real; the writer's showcase mode keeps them in `facts.md`.
