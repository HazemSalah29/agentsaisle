---
name: budget
description: Strict low-cost mode for the rest of the session, with tighter reading limits and terse replies. Slash command only. Run it when you want the agent to spend as few tokens as possible.
disable-model-invocation: true
model: sonnet
effort: low
allowed-tools: Read Grep Glob
---

# Budget

## Use when
- The user runs `/budget` to turn on strict mode for the rest of the session.

## Don't use when
- The task needs broad exploration. Tell the user and ask whether to turn strict mode off.

## Steps
1. Confirm in one line that strict mode is on.
2. Before reading anything, search. Find the exact place with grep or a symbol search, then read only that range.
3. Keep every read narrow: at most 4 files per step and at most 120 lines per read.
4. If the scope is unclear, ask one short question instead of exploring.
5. After two failed attempts at the same problem, stop and report what you tried.
6. Stay in strict mode until the user says to stop.

## Budget
- At most 4 files and 120 lines per read. Never re-read a file you just wrote or edited.
- Do not restate the request, list what you are about to do, or explain code you did not change.
- The final reply is at most 10 lines: what changed, what you ran, what is left.

## Output
- Terse answers. Code and results first, no preamble, no recap of work the user can see.

## Done when
- Each reply is within the limits above.
- The user ended strict mode, or the session ended.
