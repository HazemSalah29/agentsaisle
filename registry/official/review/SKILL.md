---
name: review
description: Review a diff for correctness, clarity and risk, and report findings by severity. Use when asked to review changes, a pull request or a commit.
---

# Review

Read the change as if you will maintain it.

1. Get the diff (`git diff`, a branch comparison, or the pull request) and read the description or commit messages for intent.
2. Check correctness first: wrong conditions, missing error paths, off-by-one errors, unhandled empty or null cases, concurrency and resource leaks.
3. Check the tests: do they cover the new behavior and the failure cases? Would they fail if the code were wrong?
4. Check risk: security, data loss, breaking changes to public behavior, performance on large inputs.
5. Only then note clarity: naming, structure, duplication, comments that no longer match the code.
6. Report findings ordered by severity. For each: where it is (`file:line`), what is wrong, a concrete input that triggers it, and a suggested fix. Say plainly when a point is a preference, not a defect.

If you find nothing serious, say so. Do not invent findings to look thorough, and do not edit files unless asked.
