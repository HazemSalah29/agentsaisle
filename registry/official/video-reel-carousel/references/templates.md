# Templates

A template keeps the look of a carousel, so the next carousel drops new text into it. A user can have many templates and pick one by name.

A template keeps only the look. It never keeps the text, the shape, the hook or the drawings. Each new carousel gets its own shape, its own words and (for graphic looks) new art drawn for its own topic. If every carousel read the same, the template would hurt the page.

## What a template holds

Everything in `deck.json` except `slides`, plus two fields:

| Field | Value |
|---|---|
| `look` | `plain`, `themed` or `graphic` |
| `size` | `3:4`, `4:5` or `1:1` |
| `bg`, `ink`, `accent` | hex colours |
| `font_head`, `font_body` | font names |
| `handle` | the page handle |
| `progress` | `true` or `false` |
| `drawing` | `cover`, `every` or `some` (graphic only, else empty) |
| `style` | the style recipe name, or a short description of the user's own look (graphic only, else empty) |

## Save

When the user says "save this as a template" (offer it after every hand-over):

1. If the user already named the template (for example "Save this as my quotes template"), use that name and do not ask again. Else ask for a short name, with a pick made from the look (for example `calm-dark` or `sketch-cover`). Use lowercase letters, digits and hyphens.
2. If a template with that name exists, ask: replace it, or pick a new name.
3. Write the template (full or chat edition, below).
4. Write `template: <name>` in the carousel's `script.md`.
5. Tell the user the name, and how to use it: "use my <name> template".

### Full edition

One file per template: `00 - notes/context/declared/templates/<name>.md`. The fields go in the frontmatter. Under it, write one line on what the look is and which carousel it came from.

```markdown
---
look: graphic
size: 3:4
bg: "#10151c"
ink: "#f4f1ea"
accent: "#e8b04a"
font_head: Georgia
font_body: Helvetica Neue
handle: "@yourpage"
progress: true
drawing: cover
style: watercolour-bloom
---

Soft watercolour cover, dark text slides. From 2026-11-02-morning-habits-carousel.
```

### Chat edition

All templates live in one Project file, `templates.md`, with one `## <name>` section per template. Each section holds the same fields as `key: value` lines.

```markdown
## calm-dark
look: themed
size: 3:4
bg: #10151c
ink: #f4f1ea
accent: #e8b04a
font_head: Georgia
font_body: Helvetica Neue
handle: @yourpage
progress: true
drawing:
style:
```

The file is optional. The carousel flow works with no `templates.md`. The first save creates it. After each save, give the user the whole file and tell them to add it to the Project files (or replace the old one), so the next chat can read it.

## List

When the user asks which templates they have, list each name with its look, size and style, one line each. In the full edition, read `00 - notes/context/declared/templates/`. In the chat edition, read the `## ` headings in `templates.md`. If there are none, say so, and say how to save one.

## Use

When the user says "use my <name> template":

1. Find the template by name. If there is no exact match, show the closest names and ask.
2. Copy its fields into the new `deck.json`.
3. Skip the look, drawing and size questions in step 4 of the flow. Still write the text new (step 3), and still draw new art for a graphic look.
4. The user can change one thing for this carousel ("same template, but 4:5"). Change only that field. Do not change the saved template unless the user asks.
