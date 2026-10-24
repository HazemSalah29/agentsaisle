---
name: review
description: Review a diff for correctness, clarity and risk, and report findings by severity. Use when asked to review changes, a pull request or a commit. Do not use to write the fix; report first, change code only when asked.
model: sonnet
effort: high
allowed-tools: Read Grep Glob Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git status *)
---

# Review

## Use when
- You are asked to review a diff, a branch, a pull request or a commit.
- The user wants a second pair of eyes before merging.

## Don't use when
- The user wants the problems fixed. Report first; edit only when asked.
- There is no change to look at.

## Steps
1. Get the diff (`git diff`, a branch comparison or the pull request) and read the description or commit messages for intent.
2. Check correctness first: wrong conditions, missing error paths, off-by-one errors, empty or null cases, concurrency, resource leaks.
3. Check the tests: do they cover the new behavior and the failure cases, and would they fail if the code were wrong?
4. Check risk: security, data loss, breaking changes to public behavior, performance on large inputs.
5. Only then note clarity: naming, structure, duplication, comments that no longer match.
6. For each finding give where (`file:line`), what is wrong, a concrete input that triggers it and a suggested fix. Say plainly when a point is a preference.

## Budget
- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.
- Read the diff first and open surrounding code only for the lines you question.

## Output
- Findings ordered by severity, each with location, problem, trigger and fix.
- If nothing serious turned up, say so. Do not invent findings to look thorough.

## Done when
- Every changed file was considered and each finding names a line.
- No file was edited unless the user asked.
