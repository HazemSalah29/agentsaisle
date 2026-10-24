---
name: debug-trace
description: Debug a bug with hypotheses instead of guesses. Reproduce it, isolate it, verify the root cause, make the smallest fix and add a regression test. Use when the user reports a bug, an error, a crash or unexpected behavior and the cause is unknown. Do not use for planned features or refactors.
model: sonnet
effort: medium
allowed-tools: Read Write Edit Glob Grep Bash(node *) Bash(git *) Bash(npm *) Bash(pnpm *) Bash(npx *) Bash(python *)
---

# Debug trace

## Use when
- An error, crash, wrong output or flaky behavior with an unknown cause.

## Don't use when
- The work is a new feature or a refactor.
- The cause is already known and the fix is mechanical.

## Steps
1. Reproduce first. Get the exact command, input and error. If you cannot reproduce it, say so and ask for what is missing; do not guess a fix.
2. Shrink the output: pipe logs and traces through `node <skill>/scripts/trim-log.mjs`. Read the first error and the first project frame.
3. Write down two or three hypotheses, most likely first. For each, name the one check that would prove or kill it (a log line, a test, a smaller input, `git bisect`).
4. Run the checks one at a time. Cross out hypotheses that fail. Do not change code to "see what happens".
5. State the root cause with the evidence. Distinguish the cause from the symptom.
6. Make the smallest fix that removes the cause. Add a regression test that fails before the fix and passes after.
7. Re-run the original reproduction and the related tests.

## Budget
- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.
- Trim logs before reading; open only the files on the failing path.

## Output
- Reproduction, root cause with evidence, the fix, the regression test, and the verification result.

## Done when
- The original reproduction no longer fails.
- A regression test covers the cause and fails without the fix.
- Related tests still pass.
