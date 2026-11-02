# Changes demo (PR and release video)

A "what changed" video made by `video-changes` from a **real diff of this repository** ([`change.diff`](change.diff): the commit that added the `timeline` scene kind to `scenes.mjs`) and a short changelog section ([`CHANGELOG.md`](CHANGELOG.md), written for the demo). 18 seconds, 1080x1920, Kokoro voice (synthetic). Every number (1 file, 5 lines added, 1 removed) is counted from the diff by the script.

`video-qa` passes (`qa/report.json`). The code scene is small in the vertical frame: that is how the existing `code` scene lays out a hunk, not changed here.

Reproduce:

```
node <video-changes>/scripts/changes.mjs --diff change.diff --changelog CHANGELOG.md --release 0.6.0 --out projects/changes --title "video-core 0.6.0"
# then voice, align, timing, captions, render and qa as in ../incident/README.md
```
