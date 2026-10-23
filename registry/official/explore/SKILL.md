---
name: explore
description: Map an unfamiliar codebase before changing it. Use when asked to understand, survey or find where something lives in a repo.
---

# Explore

Build a short, accurate map of the code relevant to the user's question. Read; do not edit.

1. Restate the question in one line and name what would count as an answer.
2. Start from entry points: README, manifest files (package.json, pyproject.toml, go.mod), top-level folders.
3. Search before reading: grep for symbols, routes and config keys; open only the files that matter.
4. Follow one real path end to end (input -> handler -> storage) rather than skimming everything.
5. Report: where the relevant code lives (`path:line`), how data flows, conventions to follow, and open questions. Keep it under 30 lines.

Never modify files, run migrations or execute project scripts while exploring.
