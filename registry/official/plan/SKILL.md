---
name: plan
description: Turn a request into an ordered, checkable plan before touching any files. Use when a task spans several files or steps, or when asked to plan first.
---

# Plan

Write the plan before the code. Do not edit files while planning.

1. Restate the goal in one sentence and list what "done" means as checks someone could run.
2. Read just enough of the code to ground the plan: the files you expect to change and their neighbors.
3. Break the work into steps small enough to verify on their own. Each step names the files it touches and how you will know it worked.
4. Order the steps so the project builds and tests pass after each one.
5. List risks and open questions. If a question blocks the plan, ask it now instead of guessing.
6. Show the plan and wait for approval before implementing.

Keep it short: one screen for a normal task. A plan the reader skims is better than a plan nobody reads.
