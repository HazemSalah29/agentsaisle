# Incident replay video

Builds the draft project from the timeline section of a postmortem: title, a `timeline` scene (one event per narration line), and a "by the clock" list. Times are shown exactly as written; the only computed numbers are minutes between two written times. `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user asks for a video of an outage, a postmortem or a release gone wrong.
- A postmortem exists with a timeline of timed events (`references/incident.md` shows the line format).

## Don't use when

- Events have no times. Ask the user for them; never estimate.
- The user wants root cause, blame or names of people on screen. Keep it about systems and actions.
- The user wants only the script, voice or render: `video-write`, `video-voice`, `video-core`.

## Steps

1. Read the postmortem's timeline section only, to check that every event line starts with a time. Do not read logs or secrets.
2. Run `node <skill>/scripts/incident.mjs --postmortem postmortem.md --out projects/<slug> --title "Checkout outage"`. If it lists problems, ask the user to fix those lines; do not fix times yourself.
3. Reword `script.md` with `video-write`; keep the `fact:` ids, the times and the computed minutes.
4. Continue: voice, timing, captions, `<video-core>/scripts/check.mjs`, draft render, `video-qa`.

## Budget

- Run `incident.mjs` once. Do not read the whole postmortem.

## Output

- The folder written, the number of events, and the durations the script computed.

## Done when

- `check.mjs` exits 0 and every time and duration in the narration appears in `facts.md`.
- No time, cause or number was added that the postmortem does not hold.

## Details

Timeline lines, under a heading that contains "timeline":

```
- 14:02 [action] Deploy 2.3 rolled out | api
- 14:09 [alert] Error rate above 5%
- 14:31 [fix] Rolled back
```

- A line is a time (HH:MM or HH:MM:SS, optional UTC), an optional `[type]` (`failure`, `alert`, `action`, `fix`, `info`; default `info`) and the text, with an optional `| where` (a component, up to 24 characters).
- 2 to 10 events. Times must go forward; across midnight, trim the timeline or split the video.
- Computed: minutes from the first failure (or first event) to the first later alert and to the last fix.
- Not built: logs as input, an overlay on the architecture diagram, severity or customer impact numbers.
