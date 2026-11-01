# Agent Aisle video library: user guide (draft, M1)

This is a first draft. In this version you can set up a studio folder, check your tools, and render a video from a `video.json` file. Writing scripts, voices, captions and diagrams come in later versions, so the steps below are by hand for now.

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

## 4. Make a video (by hand, for now)

1. Make a folder `projects/my-first/` with a `video.json` (see `registry/official/video-core/references/video-json.md` for every field). Five scene kinds work today: `title`, `quote`, `list`, `chart`, `broll`.
2. `/video-core` checks it: every problem is listed with its place, such as `$.scenes[1].props.items: at least 1 item(s)`.
3. If scenes take their length from a voice, put one audio file per script line in `voice/` (named `l1.wav`, `l2.wav`, ...) and let timing run. If every scene has a fixed `seconds`, no audio is needed.
4. Render a draft (540p, fast), look at `out/my-first-draft.mp4`, then render the final.
5. Credits: `credits.json` and `CREDITS.txt` are written next to the video. They fail if any asset has no licence.

The same `video.json` and assets always give the same video, byte for byte.

## 5. Troubleshooting

- **"FFmpeg not found"**: run `/video doctor`.
- **"HyperFrames is not installed"**: run the install line it prints.
- **Arabic letters look wrong or missing**: put an Arabic font (for example Cairo, OFL licence) in `brand/fonts/` and point `meta.brand` at your `brand.json`. Captions for Arabic arrive with the captions skill.
- **A render is slow**: use `--draft` while you edit.
- **Disk is full**: delete `projects/*/out/` and `projects/*/cache/`.

## 6. Costs

Everything in this version is local and free. Paid AI generation does not exist yet; when it arrives it will ask before spending and keep a log in `projects/<slug>/spend.json`.

## 7. Rights and labels, in plain words

- Every asset needs a licence in `video.json`, or the build fails. Music and sound effects need one too.
- Use only original characters, music and logos, or ones you hold a licence for. No real person's voice or likeness without their consent.
- Disclosure advice (the "altered or synthetic content" label, kids' content) is worked out from your assets and printed in `CREDITS.txt`. Platform rules change; check the platform's own help page before publishing (`TODO(verify)`).
- Nothing is ever uploaded for you.
