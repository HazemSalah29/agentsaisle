---
name: verify
description: Run the project's lint, type check and tests (and the route JavaScript budget when available) and print failures only, before calling work done. Use when finishing a coding task, before a commit or pull request, or when asked to check that everything still passes. Do not use as a substitute for reading the failures; fix what it reports.
model: sonnet
effort: low
allowed-tools: Read Grep Glob Bash(node *)
---

# Verify

## Use when
- You finished a change and are about to say it is done.
- You are about to commit or open a pull request.
- The user asks whether everything still passes.

## Don't use when
- You have not changed anything since the last clean run.
- The project has no lint, type check or test script. Say so instead.

## Steps
1. Run `node <this skill's folder>/scripts/verify.mjs`. It runs the project's lint, type check and test scripts, and the route JavaScript budget when the `web-performance` skill is installed and a production build exists.
2. If it reports a failure, fix the cause. Do not weaken a test, add `any` or silence a rule to get green.
3. Run it again. Stop and report after two attempts at the same failure.
4. Read the `note:` lines. A skipped check is not a pass; mention it in your summary.

## Budget
<!-- include: _shared/read-budget.md -->
- Never paste the full output of a check into your reply; quote the failing line.

## Output
- The result line, for example `verify: passed (lint, typecheck, test)`, plus any `note:` lines.
- For a failure: what failed and what you changed.

## Done when
- `verify.mjs` exits 0.
- Every skipped check is named in your summary.
