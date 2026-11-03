# Using the user's own recording

`recorded.mjs` turns one recording of the whole script into the per-line files every other step expects.

- **One read-through, in order.** The whole recording is transcribed once with whisper.cpp; the script's own words are matched to what was heard (the text on screen is always the script's, never whisper's). Retakes are not handled: ask for one clean pass, or cut the best take first (`video-edit cut`).
- **Every line must be found.** A line with under 60% of its words heard stops the run and is named, and nothing is written. Fix the line in the script or record it again.
- **Cutting.** Each line keeps 0.15 s before its first word and 0.3 s after its last; the gap between two lines is split in the middle. Word times are measured, never estimated.
- **Whose voice.** `--speaker self` for the user's own voice. For anyone else: `--speaker other --consent <file>`, a note or recording of that person agreeing; the script stores only its hash. Never use a recording of a public figure or of someone who has not agreed.
- **Output.** `voice/<id>.wav`, `voice/words.json`, `voice/manifest.json` (provider `recorded`, the speaker, a hash of the source) and `video.json` `voice.provider` set to `recorded`. `voice.mjs` refuses such a project so it never overwrites the recording with a synthetic voice.
- **Disclosure.** A human recording needs no "synthetic voice" label; `credits.mjs` says so, and keeps a note to hold the consent record for another speaker.
- **Needs** whisper-cli and a ggml model (`references/engines.md`) and ffmpeg. The recording is read from disk only: no upload, no download, no URLs.
