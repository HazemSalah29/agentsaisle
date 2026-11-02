# Session details

Accepted logs (text only, up to 100 MB (real sessions are large), never run):

- Claude Code JSONL (`~/.claude/projects/<project>/<session>.jsonl`): `user` and `assistant` lines with `timestamp` and `message.content`. The format is not documented as stable, so unknown line types and missing fields are skipped. TODO(verify)
- Plain text: lines starting with `HH:MM:SS` or an ISO date, then text. `$ cmd` is a command; a later line with "error"/"failed" or "passed"/"ok" marks it failed or fine.

Key moments (at most 8, fixed rules): first prompt, last assistant message, a failed check and the pass that fixed it, other passing checks, and file changes grouped by run ("Edited 3 files"). Checks are commands that mention test, build, lint, tsc, vitest, jest, pytest and similar.

Privacy: secrets (the patterns `check.mjs` also scans for), e-mail addresses, `KEY=value` style variables and home folders are replaced before any text is kept. Tool output and thinking blocks are never read for captions; only whether a tool call failed. Redaction reduces risk and does not guarantee it: the owner reads the captions before publishing.

Not built: subagent sessions (skipped), screen capture of the terminal, speed-ramp numbers.
