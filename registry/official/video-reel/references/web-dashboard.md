---
name: web-dashboard
description: Shows the user's reel boards, either in Obsidian or as one web page made from the vault notes (a Claude Artifact). Builds the same 7 boards as 01 - dashboards/Home.md (Posting plan, Make next, In progress, Posted, Dated ideas, Needs a source check, By kind) from the idea notes and the ledger. Use when the user asks for their boards or dashboard, a web dashboard, a page they can open on their phone or share, or asks to refresh that page.
---

# Web dashboard
The boards live in Obsidian, in `01 - dashboards/Home.md`. This skill can also show the same boards as one web page. The notes in the vault stay the real copy. The page is only a picture of them, made fresh each time.

## 1. Obsidian or web

Ask once, with buttons:

1. **Obsidian** (recommended on this computer): open `01 - dashboards/Home.md` in Obsidian. The boards fill in on their own. Stop here.
2. **Web page:** one page you can open in a browser or on your phone. Go to step 2.

## 2. Read the notes

- Every idea note in `00 - notes/ideas/` and its `_archived/` folder with `type: reel_idea`. Skip files whose name starts with `_`.
- From each note, read the frontmatter: `area`, `status`, `score`, `hook`, `source`, `source_url`, `source_status`, `season`, `slot`, `post_date`, `post_url`, `views`, `shares`, `saves`, and the file name as the title.
- `00 - notes/ledger.md`: the `## Posts` and `## Stats at 48 h` tables, to fill numbers a note does not have yet.
- `page_name` and `colours` from `00 - notes/context/declared/brand.md`, for the page title and accent colour.

## 3. The 7 boards

The same boards and rules as `01 - dashboards/Ideas.base`:

| Board | Which ideas | Order | Columns |
|---|---|---|---|
| Posting plan | has a `slot`, not dropped | slot, lowest first | title, slot, post date, kind, status |
| Make next | `status: idea` | score, highest first, top 10 | title, score, kind, hook |
| In progress | picked, building or built | status | title, status, kind, slot |
| Posted | `status: posted` | post date, newest first | title, post date, link (`post_url`), views, shares, saves |
| Dated ideas | has a `season`, not posted or dropped | season, soonest first | season, title, kind, status |
| Needs a source check | `source_status: lead`, not dropped | score, highest first | title, kind, source, source link, status |
| By kind | all ideas, grouped by `area` | score, highest first | title, status, score; a count and the average score per kind |

An empty board shows one plain line, such as "Nothing posted yet."

## 4. Build the page

- One HTML file, with the data written into it as plain tables. No outside data calls.
- A short header: the page name, "Made from your notes on YYYY-MM-DD", and "Ask Claude to refresh this page after you change your notes."
- The 7 boards as sections in the order above, with a small menu at the top to jump to each.
- Readable on a phone: one column, tables scroll on their own, text at least 15 px.
- Uses the brand's accent colour for headings. Works in light and dark mode.
- No em dashes in the page.

Save the file as `web-boards.html` in `01 - dashboards/`.

## 5. Publish

- Publish the file as a Claude Artifact with the Artifact tool. It starts private. The user can share the link when they choose.
- Keep the page link in a note called `Web boards.md` in `01 - dashboards/`, with one line: "Your web boards: <link>". Next time, update that same link instead of making a new page.
- If the Artifact tool is not there (for example in another app), open the HTML file in the browser instead and say so.
- One line in `log.md`: `YYYY-MM-DD | Web boards refreshed | 01 - dashboards/`.

## Refresh

To refresh, run this skill again. It reads the notes again and updates the same page. Never edit the page by hand, and never change a note from the page: the vault is the real copy.
