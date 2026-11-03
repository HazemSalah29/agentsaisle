# Showcase mode

For a demo of the user's own app. Required beats, in order: `hook`, at least one `feature`, `close`; optional `problem` (after the hook), `proof` and `cta`.

| Beat      | What it is                                                                     |
| --------- | ------------------------------------------------------------------------------ |
| `hook`    | The pain, not the product: "Your users find outages before you do."            |
| `problem` | One line on what it costs them (optional).                                     |
| `feature` | One benefit per line, said while it happens on screen ("Paste any endpoint."). |
| `proof`   | A real number or quote only, with a source in `facts.md` (optional).           |
| `close`   | The product's name and its promise, short enough for a slab.                   |
| `cta`     | Where to get it, at most 3 seconds (optional).                                 |

4 to 6 lines, 20 to 40 seconds. Each `feature` line gets a `say <id>` in `demo.md` right before its actions, so the voice and the action land together. No storyboard table is needed: the showcase chain builds `video.json` (`video` skill, `references/showcase.md`).
