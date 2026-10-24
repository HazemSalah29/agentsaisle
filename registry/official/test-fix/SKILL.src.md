---
name: test-fix
description: Fix failing tests from trimmed runner output, find the real cause, and never weaken an assertion without asking. Use when tests fail, CI is red, or the user asks to fix failing tests. Do not use to write new tests or to make a red suite green by deleting or skipping tests.
model: sonnet
effort: medium
allowed-tools: Read Write Edit Glob Grep Bash(node *) Bash(git diff *) Bash(npm *) Bash(pnpm *) Bash(npx *) Bash(python *) Bash(go test *)
---

# Fix failing tests

## Use when

- One or more tests fail and the cause is unknown.

## Don't use when

- There are no tests yet (use `test-write`).
- The user wants a skip or deletion. Ask first and record why.

## Steps

1. Run the failing tests and pipe the output through `node <skill>/scripts/trim-test-output.mjs`. Work from that summary; do not read the full log.
2. For each failure decide: is the code wrong, the test wrong, or the environment? Read the test and the code it calls. Say which, with the evidence.
3. Fix the code when the code is wrong. Fix the test only when its expectation is provably outdated or incorrect, and explain why.
4. Never remove an assertion, loosen a matcher, skip a test or raise a timeout to get green. If you think one is needed, stop and ask.
5. Re-run the same tests, then the wider suite.
6. Run `git diff | node <skill>/scripts/weakened-assertions.mjs`. Any finding must be shown to the user and approved.

## Budget

<!-- include: _shared/read-budget.md -->

- Trim output first; read only the failing tests and the code they call.

## Output

- Per failure: cause, fix, and the file changed. Then the final pass counts and the weakened-assertions result.

## Done when

- The failing tests pass and the wider suite has no new failures.
- `weakened-assertions.mjs` reports none, or the user approved each finding.
