---
name: explore
description: Map an unfamiliar codebase before changing it, reading only what the question needs. Use when asked to understand, survey or find where something lives in a repository, or before changing code you have not seen. Do not use when you already know where the change goes.
model: sonnet
effort: low
allowed-tools: Read Grep Glob Bash(git log *) Bash(git ls-files *)
---

# Explore

## Use when
- You are asked how something works or where it lives.
- You are about to change code in an area you have not read.

## Don't use when
- You already know the files involved.
- The task is to change code, not to understand it.

## Steps
1. Restate the question in one line and say what would count as an answer.
2. Start from entry points: the README, manifest files (package.json, pyproject.toml, go.mod) and the top-level folders.
3. Search before reading: look for symbols, routes and config keys, then open only the files that matter.
4. Follow one real path end to end (input to handler to storage) instead of skimming everything.
5. Note conventions to follow and anything surprising.

## Budget
<!-- include: _shared/read-budget.md -->
- Never edit files, run migrations or execute project scripts while exploring.

## Output
- Where the relevant code lives (`path:line`), how data flows, conventions to follow, open questions.
- At most 30 lines.

## Done when
- The question is answered with specific files and lines.
- No file was changed.
