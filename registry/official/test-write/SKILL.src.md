---
name: test-write
description: Write tests only for the code that changed, using the project's own test framework and conventions, then run them. Use when the user asks to add tests, or after changing logic that has no tests. Do not use to rewrite a whole test suite or to chase coverage numbers.
model: sonnet
effort: medium
allowed-tools: Read Write Edit Glob Grep Bash(node *) Bash(git diff *) Bash(npm *) Bash(pnpm *) Bash(npx *) Bash(python *)
---

# Write tests

## Use when
- Logic was added or changed and nothing tests it.
- The user asks for tests for a function, module or bug fix.

## Don't use when
- Tests exist and are failing (use `test-fix`).
- The goal is a coverage percentage rather than behavior.

## Steps
1. Run `node <skill>/scripts/changed-files.mjs`. It lists changed source files, which already have tests, the framework and the run command.
2. Read one existing test file in the project to copy its style: imports, naming, setup, mocks.
3. For each file marked "needs tests", read only the changed functions. Write tests for behavior: the normal case, edge cases (empty, boundary, invalid input) and the bug being fixed. A bug fix gets a test that fails without the fix.
4. Keep tests deterministic: no real network, clock or randomness unless controlled.
5. Run only the new and changed test files with the command the script printed. Fix test mistakes, not the code under test, unless the test found a real bug (then say so).
6. Do not weaken or delete existing tests.

## Budget
<!-- include: _shared/read-budget.md -->
- Read changed functions and one sample test, not whole modules.

## Output
- Test files written, the run result (pass counts), and any real bug the tests found.

## Done when
- Every changed source file has at least one test that exercises it.
- The new tests pass, and fail when the behavior is broken.
- No existing assertion was removed or loosened.
