---
name: commit
description: Write a clear git commit for the current changes, splitting unrelated work into separate commits. Use when asked to commit or to split work into logical commits. Do not use to push, amend or rewrite history unless the user asks.
model: sonnet
effort: low
allowed-tools: Read Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git add *) Bash(git commit *)
---

# Commit

## Use when
- You are asked to commit the current changes.
- Several unrelated changes are mixed and should become separate commits.

## Don't use when
- The user asks to push, amend, rebase or rewrite history. Do that only when asked.
- There is nothing to commit.

## Steps
1. Run `git status` and `git diff` (staged and unstaged) to see exactly what changed.
2. Group the changes into logical units. If a unit mixes concerns, say so and stage by file or hunk.
3. Check `git log --oneline -10` and match the repository's style, including any prefix convention.
4. Write the message: a subject of at most 72 characters in the imperative ("Add retry to fetcher"), a blank line, then a body that says why, not what.
5. Never commit secrets, `.env` files or build output. If you see one staged, stop and tell the user.

## Budget
- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.
- Read the diff, not whole files.

## Output
- The commit hash and subject for each commit you made, and anything left uncommitted.

## Done when
- Each commit holds one logical change with a message in the repository's style.
- No secret, `.env` file or build output was committed.
- Nothing was pushed or rewritten.
