---
name: video-session
description: "Part of the video library, used by the video skill (not run directly). Make a sped-up \"watch an AI build this\" video from a saved agent session log (Claude Code JSONL or timestamped text) with captioned key moments and secrets redacted first. Don't use without timestamps, on a session the user does not own, or without the user's OK to show it."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Agent session timelapse

Builds the draft project from a session log: title, a `timeline` of up to 8 key moments (the first prompt, file changes, failed and fixed checks, the result), one code diff if a small edit exists, and "the session in numbers". Idle gaps over 60 seconds count as one second. `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user asks for a timelapse or showcase of an AI coding session.
- A saved log exists (`references/session.md` lists the accepted formats).

## Don't use when

- The log has no times. Ask for another log; never invent times.
- The session belongs to someone else, or holds customer data. Ask first.
- The user wants only the script, voice or render: `video-write`, `video-voice`, `video-core`.

## Steps

1. Ask which log file and that it is theirs to show. Do not open the log yourself; the script reads it as text.
2. Run `node <skill>/scripts/session.mjs --log session.jsonl --out projects/<slug> --title "Building a todo app"`. If it refuses, tell the user why; do not edit the log.
3. Tell the user how many items were redacted and ask them to read `script.md` before anything is published: prompts and code can still hold private details.
4. Reword `script.md` with `video-write`; keep the `fact:` ids, times and counts.
5. Continue: voice, timing, captions, `<video-core>/scripts/check.mjs`, draft render, `video-qa`.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run `session.mjs` once. Never read the log into the conversation.

## Output

- The folder written, the key moments, active and removed time, and the redaction count.

## Done when

- `check.mjs` exits 0 and every time and count in the narration appears in `facts.md`.
- The user has read the captions and agreed they are safe to publish.
