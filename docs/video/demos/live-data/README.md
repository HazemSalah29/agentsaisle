# Live-data demo (npm downloads)

A real run of `/video data` on 2026-11-02: `fetch.mjs` read three public npm download counts from `api.npmjs.org` (one GET each, no key), and `live.mjs build` made the project. `facts.md` names the sources, and `check.mjs` accepts `video.json`.

The week-over-week changes are computed from the API's own 14 daily counts. Two of them are large (more than 100% for `commander`); they come straight from the API and have not been checked against another source, so treat them as unverified before publishing. No MP4 has been rendered (ffmpeg and HyperFrames are missing on this machine).
