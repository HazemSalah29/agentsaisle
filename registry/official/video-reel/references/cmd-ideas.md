---
description: New reel ideas into your ideas folder, real lessons and made-up stories, with no repeats.
argument-hint: "[how many] [theme, or made-up story about X]"
---

# /video reel ideas

Finds new reel ideas and saves one note per idea in `00 - notes/ideas/`.

Input: $ARGUMENTS (a number, a theme, or "made-up stories about X"; all optional).

Read `<video-reel>/references/agent-idea-scout.md` and do its job with this input. In short:

1. It reads `brand.md`, `taste.md`, the ledger and the ideas already saved.
2. It mixes real lesson ideas with made-up story ideas (the `video-reel-parable` skill in Scout mode). If the user asked only for made-up stories, all of them are stories.
3. It drops any idea already in `## Posts` in `00 - notes/ledger.md` or already in an idea note.
4. It writes every note from `00 - notes/ideas/_template.md` with every key filled, and adds a line to `log.md`.
5. It shows the list with a score and one pick.

End with a numbered choice: make the pick now (`/video reel reel`), more ideas, or done.
