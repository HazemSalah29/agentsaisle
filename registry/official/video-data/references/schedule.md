# Sources and the weekly run

`live.config.json` fields: `id`, `title`, `source` (`npm`, `github` or `url`), `items`, `metric`, `unit`, `format`. For `url`: `url`, `allowedHosts`, `labelField`, `valueField`, optional `previousField`.

- `npm`: 2 to 5 package names. Reads `api.npmjs.org` daily downloads for the last 14 days, so "this week" is the last 7 complete days and the change is against the 7 before. TODO(verify): npm's download counts are for the registry only and the API terms may change.
- `github`: 2 to 5 `owner/repo` names. Reads stars and the latest release, unauthenticated (60 requests an hour per address; a rate limit stops the run). The change since last week appears from the second run on, when the earlier `data/<id>-<date>.json` exists.
- `url`: one https URL whose host you list in `allowedHosts`: JSON (an array of objects, or `{ "data": [...] }`) or CSV with a header row. No ports, IP addresses, credentials or redirects.
- Up to 8 items are drawn, largest first. Every fetch is noted in `data/ledger.jsonl`.

## Weekly run

```
node <skill>/scripts/fetch.mjs --config live.config.json
node <skill>/scripts/live.mjs build --config live.config.json --data data/<id>.json --out projects/<id>-$(date +%F)
```

Then the usual steps on that project: `video-write` (reword), `video-voice`, `video-core` timing, `video-captions`, `check.mjs`, render, `video-qa`. Wire it to a schedule yourself (a cron entry, or Claude Code's `/schedule` with the same prompt). Nothing here creates a schedule, and a scheduled run still stops at `video-qa` for a human look before publishing.

Rights: public APIs, numbers and the source cited on screen. Check each API's terms before republishing (TODO(verify)); never present the chart as your own measurement.
