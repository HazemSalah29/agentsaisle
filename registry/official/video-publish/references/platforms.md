# Platform data

`assets/platforms.json` holds each platform's shapes, length limit, text limits, whether it has chapters and a made-for-kids question, and the disclosure wording. **`verified` is false.** A web search on 2026-11-02 found only third-party pages, and they disagree: Shorts say 3 minutes (several agree, none official), Reels say 90 seconds, 3 minutes or 20 minutes, TikTok 3, 10 or 60 minutes. The limit used is the smaller one, so a video that passes is accepted on every account. YouTube's 15 minute figure is the usual limit for accounts that are not verified.

Each platform lists what is unverified. Before relying on a number, check the platform's own help page and change the file (`TODO(verify)`), then record the date in `checked`.

## What each pack contains

`video.mp4` (H.264, yuv420p, AAC 48 kHz, scaled down to the platform's width if wider, at most 30 fps, bitrate capped at 8 Mb/s), `thumbnail-1..3.jpg` (frames chosen at 15%, 45% and 75% of the video), `thumbnail-card.jpg` (a designed title card rendered with the project's brand, when HyperFrames is installed), `copy.json`, `captions.srt` and `.vtt`, `CREDITS.txt`, `disclosure.md`. `exports/publish.json` lists every file with its size and SHA-256.

## Disclosure

`disclosure.md` repeats the guidance from `credits.json` (computed from the assets, not guessed) and the platform's own question wording. The "made for kids" answer comes from the audience in `brief.json`: yes for kids, no for clearly adult audiences such as developers, otherwise "ask" and the owner decides. The owner always answers on the platform; this library only prepares the answer.
