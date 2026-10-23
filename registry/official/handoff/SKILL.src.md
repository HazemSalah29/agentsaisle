---
name: handoff
description: Write a short handoff note so a fresh session can resume cheaply, and read it at the start of the next one. Use when stopping work with something unfinished, when a session is getting long, or when asked to hand off. Do not use to record a finished task or to document the code.
model: sonnet
effort: low
allowed-tools: Read Write Bash(node *)
---

# Handoff

## Use when
- You stop with work unfinished and the next session should pick it up.
- The conversation is long and a fresh start would be cheaper.
- The user asks for a handoff.
- At the start of a session, `.agent-aisle/handoff.md` exists.

## Don't use when
- The task is finished and nothing carries over.
- The user wants documentation of the code, not of the work.

## Steps
1. Write `.agent-aisle/handoff.md`, at most 40 lines, with exactly these sections in this order:
   - `## Goal`: what we are trying to achieve, in one or two lines.
   - `## Done`: what is finished and verified, as short bullets with file paths.
   - `## Next`: the next concrete steps, in order, the first one specific enough to start on.
   - `## Open questions`: decisions or facts still needed, or `None.`
2. Write facts and file paths, not history or opinions. Do not copy code.
3. Run `node <this skill's folder>/scripts/check-handoff.mjs` and fix what it reports.
4. When a new session starts and the file exists, read it first, tell the user in one line what it says, and continue from `## Next`.

## Budget
<!-- include: _shared/read-budget.md -->
- A handoff is a pointer, not a diary. If you are near 40 lines, cut.

## Output
- The path of the note and a one-line summary of it.

## Done when
- `check-handoff.mjs` reports ok.
- Someone with no memory of this session could start from `## Next`.
