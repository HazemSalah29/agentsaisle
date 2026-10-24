---
name: implement
description: Carry out an agreed plan in small steps, checking each one before the next. Use after a plan is approved, or when asked to build or change something with clear requirements. Do not use when the requirements are still unclear; plan or ask first.
model: sonnet
effort: medium
allowed-tools: Read Grep Glob Edit Write Bash(git diff *) Bash(git status *) Bash(node *) Bash(npm run *) Bash(pnpm *) Bash(yarn *) Bash(bun *)
---

# Implement

## Use when
- A plan is approved and it is time to build.
- The user gives a change with clear requirements.

## Don't use when
- The requirements are unclear or conflict. Plan first or ask.
- The change is a review, an explanation or a question.

## Steps
1. Take the next step only. Make the smallest change that completes it.
2. Match the surrounding code: naming, structure, comment density, error handling. Do not introduce a second way to do something.
3. Run the checks for that step (tests, type check, lint) before moving on. If one fails, fix it now; never stack changes on a broken step.
4. Add or update tests alongside the code, not at the end.
5. If the code shows the plan is wrong, stop, say what you found and propose a change. Do not work around it quietly.
6. After the last step, summarize what changed, what you ran and what is left for the user to decide.

## Budget
<!-- include: _shared/read-budget.md -->
- Do not add features, refactors or dependencies the plan did not ask for.

## Output
- The changed files, the checks you ran with their results, and anything left open.

## Done when
- Every plan step is done and its check passes.
- Tests cover the new behavior.
- Nothing outside the plan was changed.
