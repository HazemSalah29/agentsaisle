# Live-data demo (npm downloads)

A real run of `/video data` on 2026-11-02: `fetch.mjs` read three public npm download counts from `api.npmjs.org` (one GET each, no key), and `live.mjs build` made the project. `facts.md` names the sources, and `check.mjs` accepts `video.json`.

The week-over-week changes are computed from the API's own 14 daily counts. Two of them are large (more than 100% for `commander`); they come straight from the API and have not been checked against another source, so treat them as unverified before publishing. `live-data.mp4` was rendered on 2026-11-02 (Kokoro voice, whisper.cpp timings, HyperFrames 0.9.1, ffmpeg 9.0.2). It runs 41 s and passes `video-qa` with one pacing warning (the bar chart holds still for 3 s). Big numbers are said in words ("728 million") and `facts.md` keeps the exact figure next to the spoken one. The chart scene is small in the vertical frame: that is the existing `chart` scene, not changed here.
