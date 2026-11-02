---
name: video-incident
description: Make an incident replay video from the timeline of a postmortem, which is an animated timeline of what failed, when the alert fired and the fix, with only the minutes computed from the times written. Use when the user runs /video incident or asks for an outage or postmortem video. Don't use without times in the postmortem, to assign blame, or for scripts, voice and rendering.
disable-model-invocation: true
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Incident replay video

Builds the draft project from the timeline section of a postmortem: title, a `timeline` scene (one event per narration line), and a "by the clock" list. Times are shown exactly as written; the only computed numbers are minutes between two written times. `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user runs `/video incident` or asks for a video of an outage, a postmortem or a release gone wrong.
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

<!-- include: _shared/read-budget.md -->

- Run `incident.mjs` once. Do not read the whole postmortem.

## Output

- The folder written, the number of events, and the durations the script computed.

## Done when

- `check.mjs` exits 0 and every time and duration in the narration appears in `facts.md`.
- No time, cause or number was added that the postmortem does not hold.
