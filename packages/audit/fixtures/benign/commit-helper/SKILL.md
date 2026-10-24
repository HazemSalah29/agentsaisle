---
name: commit-helper
description: Write a clear git commit message from the staged diff. Use when the user asks for a commit message. Don't use for rewriting history.
allowed-tools: Read Grep Bash(git diff *) Bash(git status *)
---

# Commit helper

## Use when

- The user asks for a commit message for staged changes.

## Steps

1. Run `git status` and `git diff --staged`.
2. Write a subject line of at most 72 characters in the imperative mood.
3. Add a short body only when the why is not obvious.

## Done when

- The message describes what changed and why, with no invented details.
