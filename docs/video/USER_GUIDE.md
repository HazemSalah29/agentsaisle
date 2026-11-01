# Agent Aisle video library: user guide (draft, M2)

This is a draft. In this version you can set up a studio folder, write a script and storyboard, make a voice track and captions, and render a video. Animated diagrams, code scenes, QA and publishing come in later versions.

## 1. Where it runs

Video needs real programs on your computer (FFmpeg, Node, a headless browser), so use **Claude Code on your own machine**:

- The Claude desktop app, **Code** tab, **Local** environment, with your studio folder open. The Cloud environment cannot see your folders.
- Or Claude Code in a terminal or VS Code, started in the studio folder.

Claude chat with an uploaded skill runs in a cloud sandbox and cannot render. (`TODO(verify)` sandbox limits.)

## 2. One-time install (about 15 minutes)

1. Install the tools. HyperFrames needs **Node 22 or newer**.
   - macOS: `brew install node ffmpeg python`
   - Windows: `winget install OpenJS.NodeJS.LTS Gyan.FFmpeg Python.Python.3.12`
   - Linux: your package manager.
     (`TODO(verify)` package names and versions.)
2. Install the renderer at the tested version: `npm install --global hyperframes@0.8.226`
3. Install the skills: `aisle add video` and `aisle add video-core` in the studio folder, or with `--global` for every folder.

## 3. Create the studio

Open any empty folder (for example `Documents/AisleVideos`) and type `/video init`. It creates `brand/`, `characters/`, `recipes/`, `library/`, `inbox/`, `projects/`, `exports/`, a `CLAUDE.md` with your defaults, `brand/brand.json` and `providers.yaml`. You never create folders by hand. Running it again changes nothing that exists, so it is safe.

Then type `/video doctor`. It lists what is installed, your hardware tier (not ready, $0 laptop, local GPU) and one install line for anything missing. It only says "found" or "missing" for API keys and never shows them.

## 4. Make a video

Each step is a command; each reads the files of the one before, so you can stop and edit between steps. A project is a folder `projects/<slug>/`.

1. **Write** (`/video-write explain "how rate limiting works"`). It writes `brief.json`, `script.md` (one `[id] line` per sentence with a `beat:`), `facts.md` (a source for every technical claim), `hooks.md` (5 openings) and `storyboard.md`. A checker runs and lists errors, such as a claim with no source or a missing beat. Read the storyboard, change what you want, then say go: it writes `video.json`. Only the `explain` and `story` modes exist, and only five scene kinds (`title`, `quote`, `list`, `chart`, `broll`).
2. **Voice** (`/video-voice`). English uses Kokoro, Arabic uses 3arab-TTS, both on your own computer. `--provider test` makes a plain tone instead of speech, which is enough to check timing. Lines you did not change are kept, so re-running is cheap. Nothing can clone a voice, and a clone request is refused without consent.
3. **Lengths**: `timing.mjs` sets each scene's length from the audio.
4. **Word times and captions** (`/video-captions --style karaoke`). With whisper.cpp set up the word times are measured; without it they are estimated, and the tool says so in capital letters. Three styles: `karaoke`, `pop`, `clean`. You also get `captions.srt` and `captions.vtt`.
5. **Brand** (`/video-brand init`, `/video-brand check`): colours, a font and a logo for every video. Colours that are hard to read are refused. For Arabic put an Arabic font in `brand/fonts/`.
6. **Render**: a 540p draft first (`--draft`), look at it, then the final. Captions are burned in unless you chose subtitle files only.
7. **Credits**: `credits.json` and `CREDITS.txt`, with the disclosure advice.

The same project and assets always give the same video, byte for byte.

### Setting up voices and captions (once)

`/video doctor` shows which of these are ready. None are required: without them you can still use the test tone and estimated captions.

- Kokoro (English voice) needs Python 3.10 to 3.12 and about 1.5 GB for the libraries plus 350 MB of weights.
- whisper.cpp with the `base` model (150 MB) gives measured word times. On one test, 83% of words were within 100 ms of the reference and the median error was 35 ms; estimated times were within 100 ms for 35% of words.
- 3arab-TTS (Arabic voice) is about 1 GB of model plus libraries and runs slowly on a CPU.
- The exact steps, versions and the measured numbers are in `registry/official/video-voice/references/engines.md`. Voices are machine voices; Arabic text and speech are a draft that a native speaker should review before you publish.

## 5. Troubleshooting

- **"FFmpeg not found"**: run `/video doctor`.
- **"HyperFrames is not installed"**: run the install line it prints.
- **Arabic letters look wrong or missing**: put an Arabic font (for example Cairo, OFL licence) in `brand/fonts/` and point `meta.brand` at your `brand.json`; `/video-brand check --lang ar` tells you if none is there.
- **Captions drift from the voice**: the word times were estimated. Set up whisper.cpp (see the setup notes above) and run the voice step's alignment again.
- **"kokoro is not installed"**: run `/video doctor`; use `--provider test` meanwhile.
- **A render is slow**: use `--draft` while you edit.
- **Disk is full**: delete `projects/*/out/` and `projects/*/cache/`.

## 6. Costs

Everything in this version is local and free. Paid AI generation does not exist yet; when it arrives it will ask before spending and keep a log in `projects/<slug>/spend.json`.

## 7. Rights and labels, in plain words

- Every asset needs a licence in `video.json`, or the build fails. Music and sound effects need one too.
- Use only original characters, music and logos, or ones you hold a licence for. No real person's voice or likeness without their consent.
- Disclosure advice (the "altered or synthetic content" label, kids' content) is worked out from your assets and printed in `CREDITS.txt`. Platform rules change; check the platform's own help page before publishing (`TODO(verify)`).
- Nothing is ever uploaded for you.
