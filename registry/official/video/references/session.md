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

- Run `session.mjs` once. Never read the log into the conversation.

## Output

- The folder written, the key moments, active and removed time, and the redaction count.

## Done when

- `check.mjs` exits 0 and every time and count in the narration appears in `facts.md`.
- The user has read the captions and agreed they are safe to publish.

## Details

Accepted logs (text only, up to 100 MB (real sessions are large), never run):

- Claude Code JSONL (`~/.claude/projects/<project>/<session>.jsonl`): `user` and `assistant` lines with `timestamp` and `message.content`. The format is not documented as stable, so unknown line types and missing fields are skipped. TODO(verify)
- Plain text: lines starting with `HH:MM:SS` or an ISO date, then text. `$ cmd` is a command; a later line with "error"/"failed" or "passed"/"ok" marks it failed or fine.

Key moments (at most 8, fixed rules): first prompt, last assistant message, a failed check and the pass that fixed it, other passing checks, and file changes grouped by run ("Edited 3 files"). Checks are commands that mention test, build, lint, tsc, vitest, jest, pytest and similar.

Privacy: secrets (the patterns `check.mjs` also scans for), e-mail addresses, `KEY=value` style variables and home folders are replaced before any text is kept. Tool output and thinking blocks are never read for captions; only whether a tool call failed. Redaction reduces risk and does not guarantee it: the owner reads the captions before publishing.

Not built: subagent sessions (skipped), screen capture of the terminal, speed-ramp numbers.
