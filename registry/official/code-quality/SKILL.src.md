---
name: code-quality
description: Apply clear-code rules while writing or changing code, then run the project's own lint, type check and tests and fix what fails. Use when writing or editing code, when asked to clean up or tidy code, and before saying a coding task is done. Do not use for prose, design work or one-line fixes the user dictated exactly.
model: sonnet
effort: medium
allowed-tools: Read Grep Glob Edit Write Bash(node *) Bash(npm run *) Bash(pnpm *) Bash(yarn *) Bash(bun *)
---

# Code quality

## Use when

- You are writing or changing code in a project that has a lint, type check or test script.
- The user asks to tidy, clean up or review the quality of code.
- You are about to say a coding task is done.

## Don't use when

- The change is prose, config text or a design decision, not code.
- The user dictated an exact edit and wants nothing else touched.

## Rules (in order of impact)

1. **Names say what a thing is or does.** `retryCount`, `parseInvoice`. No `data`, `temp`, `handle2`. Rename before you add a comment to explain a name.
2. **One job per function.** If you need "and" to describe it, split it. Aim for a function you can read without scrolling.
3. **No dead code.** Delete unused functions, imports, flags and commented-out blocks. Version control remembers them.
4. **Type the boundaries.** Data from users, files, networks and environment variables is validated at the edge (for example with zod) and typed after that. Inside the program, trust the types.
5. **Never swallow an error.** Handle it, or rethrow it with context. An empty `catch` is a bug. Return or throw errors; do not return `null` for "something went wrong".
6. **No magic numbers or strings.** Name constants where they are used, or in one config file when several places share them.
7. **Follow the project's structure.** Put new files where similar files live, use the same naming and the same patterns. Do not introduce a second way to do something.
8. **Test the logic you add or change.** New branches and bug fixes get a test that fails without the change. Do not test the framework.
9. **Keep changes small.** Touch only what the task needs. No drive-by renames or formatting sweeps.

## Steps

1. Find where the change belongs: search first, then read only the relevant line ranges.
2. Make the change following the rules above. If you break a rule on purpose, say why in one line.
3. Run the checks: `node <this skill's folder>/scripts/check.mjs`. It runs the project's lint, type check and test scripts and prints only failures.
4. Fix each failure at its cause. Never weaken or delete a test, add `any`, or silence a lint rule to get green; if a check seems wrong, say so and ask.
5. Run the checks again until they pass. A repeated identical failure after two attempts means stop and report what you tried.

## Budget

<!-- include: _shared/read-budget.md -->

- Do not paste whole check output into your reply. Quote the failing line and fix it.

## Output

- What changed, in a short list of files.
- The check result in one line, for example `check: passed (lint, typecheck, test)`.
- Anything you chose not to fix, and why.

## Done when

- `scripts/check.mjs` reports `passed`, with no new warnings compared to before your change.
- If the project has no lint, type check or test script, you said so plainly instead of reporting success.
- Every new or changed branch has a test.
