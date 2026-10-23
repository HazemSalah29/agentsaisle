---
name: commit
description: Write a clear git commit for the current changes. Use when asked to commit, or to split work into logical commits.
---

# Commit

1. Run `git status` and `git diff` (staged and unstaged) to see exactly what changed.
2. Group changes into logical units. If a unit mixes concerns, propose splitting it and stage by file or hunk.
3. Write the message: a subject of at most 72 characters in the imperative ("Add retry to fetcher"), a blank line, then a body explaining why, not what.
4. Match the repository's existing style (check `git log --oneline -10`), including any conventional-commit prefixes.
5. Never commit secrets, `.env` files or build output. Never push, amend or rewrite history unless asked.
