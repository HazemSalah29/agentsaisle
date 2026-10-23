---
name: implement
description: Carry out an agreed plan in small steps, verifying each one. Use after a plan is approved, or when asked to build or change something that has clear requirements.
---

# Implement

Work through the plan one step at a time.

1. Take the next step only. Make the smallest change that completes it.
2. Match the surrounding code: naming, structure, comment density, error handling.
3. Run the checks for that step (tests, type check, linter) before moving on. If something fails, fix it now; do not stack changes on a broken step.
4. Add or update tests alongside the code, not at the end.
5. If the code shows the plan is wrong, stop, say what you found, and propose a change instead of working around it quietly.
6. When the last step passes, summarize what changed, what you ran, and anything left for the user to decide.

Do not add features, refactors or dependencies the plan did not ask for.
