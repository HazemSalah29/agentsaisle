---
name: video-data
description: "Part of the video library (loaded by /video, not run directly): a chart video from fresh public data (npm, GitHub, an approved CSV/JSON host); re-runnable."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Live-data chart video

Builds a draft project from a dataset fetched today: title, a bar `chart` (source and date in its title), "what changed" when a previous value exists, and "where this comes from". `fetch.mjs` is the only script that uses the network (GET, https, no keys, no redirects, 15 s, 1 MB). `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user wants a "this week in ..." chart video from npm downloads, GitHub stars or a data file they name.

## Don't use when

- The data is private, paid, behind a login, or needs a key or token. Nothing here sends credentials.
- The host is not one the user approved in `allowedHosts`. Never add a host yourself.
- The user wants only the script, voice or render: `video-write`, `video-voice`, `video-core`.

## Steps

1. If there is no `live.config.json`, run `node <skill>/scripts/live.mjs init --source npm|github|url`, then ask the user to confirm the title, the items and (for `url`) the hosts they approve.
2. Tell the user the fetch will read the named public pages, then run `node <skill>/scripts/fetch.mjs --config live.config.json`. If a source is rate limited or changes shape, report it; do not retry in a loop or work around it.
3. Run `node <skill>/scripts/live.mjs build --config live.config.json --data data/<id>.json --out projects/<id>-<date>`. Stale data (older than 8 days) is refused.
4. Reword `script.md` with `video-write`; keep every `fact:` id and number.
5. Continue: voice, timing, captions, `<video-core>/scripts/check.mjs`, draft render, `video-qa`. For a weekly run, follow `references/schedule.md`; this skill schedules nothing itself.

## Budget

<!-- include: _shared/read-budget.md -->

- Fetch once per run. Do not open the data files into the conversation.

## Output

- The files written, the sources fetched with their dates, and the computed changes.

## Done when

- `check.mjs` exits 0 and every number in the narration appears in `facts.md` with its source.
- Each chart shows its source and date on screen.
