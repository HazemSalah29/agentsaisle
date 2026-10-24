---
name: plan
description: Turn a request into an ordered, checkable plan before touching any files. Use when a task spans several files or steps, when requirements are unclear, or when asked to plan first. Do not use for one-step changes or for questions that need an answer rather than a plan.
model: sonnet
effort: medium
allowed-tools: Read Grep Glob
---

# Plan

## Use when
- A task touches several files or has several steps.
- The request is vague and the plan will show what is really being asked.
- The user asks to plan first.

## Don't use when
- The change is one obvious step.
- The user wants an answer or an explanation, not a plan.

## Steps
1. Restate the goal in one sentence, then list what "done" means as checks someone could run.
2. Read just enough code to ground the plan: the files you expect to change and their neighbors. Search first.
3. Break the work into steps small enough to verify on their own. Each step names the files it touches and how you will know it worked.
4. Order the steps so the project builds and its tests pass after each one.
5. List risks and open questions. If a question blocks the plan, ask it now instead of guessing.
6. Show the plan and wait for approval. Do not edit any file while planning.

## Budget
<!-- include: _shared/read-budget.md -->
- A normal plan fits on one screen and has at most 12 steps. If it needs more, split the task.

## Output
- Goal, the done checks, then numbered steps with files and how each is verified.
- Risks and open questions, if any.

## Done when
- Every step names its files and a way to check it.
- The user approved the plan or answered the open questions.
- No file was changed.
