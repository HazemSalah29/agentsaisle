# Incident replay demo

An animated timeline of a **fictional** outage, made by the `video` skill's incident recipe from [`postmortem.md`](postmortem.md) (no real incident, company or customer). 35 seconds, 1080x1920, Kokoro voice (synthetic), burned captions. Only the times in the postmortem and the minutes computed between them are shown; `facts.md` lists them.

`video-qa` passes with no warnings (`qa/report.json`, `qa/contact-sheet.png`).

Reproduce (from a studio folder, with ffmpeg and HyperFrames set up):

```
node <video>/scripts/incident.mjs --postmortem postmortem.md --out projects/incident --title "A checkout slowdown"
node <video-voice>/scripts/voice.mjs projects/incident --provider kokoro
node <video-voice>/scripts/align.mjs projects/incident
node <video-core>/scripts/timing.mjs projects/incident
node <video-captions>/scripts/captions.mjs projects/incident --style clean --both
node <video-core>/scripts/render.mjs projects/incident
node <video-qa>/scripts/qa.mjs projects/incident
```
