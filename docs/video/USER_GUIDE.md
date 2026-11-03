# Agent Aisle video: user guide

You make a short video with **one command**: type `/video` and say what you want. It makes three kinds of short, each with a tested look, and holds every one to the same quality bar (a strong hook, fast pace, big readable type, real sound design):

- **Explainer**: an idea, algorithm or API, shown working with code, diagrams and real simulations. `/video explain how a rate limiter saves your API`
- **Kinetic**: bold words that hit as they are spoken, with full-colour slabs and hard cuts. `/video a 15 second hype short: done beats perfect`
- **Showcase**: your own app, recorded from a script, with the camera following the action. `/video a showcase of my app at http://localhost:3000`

Nothing is uploaded, ever: the last step prepares a pack you post by hand.

## 1. Where it runs

Video needs real programs on your computer (Node, FFmpeg, a headless browser), so use **Claude Code on your own machine**: the Claude desktop app's **Code** tab with the **Local** environment and your studio folder open, or Claude Code in a terminal. A cloud sandbox cannot render.

## 2. One-time setup (about 15 minutes)

1. **Node 20+ and FFmpeg** (and Python 3.10+ for the voice).
   - macOS: `brew install node ffmpeg python`
   - Windows: `winget install OpenJS.NodeJS.LTS Gyan.FFmpeg Python.Python.3.12`
   - Linux: your package manager.
2. **The skill**: `aisle add video` in the studio folder (or with `--global`).
3. **The Remotion engine**: the first time you ask for a video, Claude writes the engine's `package.json` to `~/.aisle-video/remotion` and shows you two commands to run there: `npm install --no-audit --no-fund` and `npx remotion@4.0.540 browser ensure` (about 350 MB in all). Remotion is free for individuals and companies of up to 3 people; larger companies need a [Remotion company licence](https://www.remotion.dev/license).
4. **The free voice (Kokoro)**: `pip install kokoro-onnx soundfile`, then download `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the [kokoro-onnx releases](https://github.com/thewh1teagle/kokoro-onnx/releases) into `~/.aisle-video/kokoro/`. It runs on any laptop CPU. Your own recorded voice needs no setup and sounds better than any synthetic one.
5. **Optional**: whisper.cpp for measured word times (captions land exactly on the words), and `playwright-core` in `~/.aisle-video` for showcase screen capture.

`/video doctor` lists what is ready and one install line for anything missing. Nothing is ever installed for you.

## 3. The studio

Open an empty folder (for example `Documents/AisleVideos`) and ask for a video. The first time, Claude creates `brand/`, `library/`, `inbox/`, `projects/` and `exports/`, plus a `CLAUDE.md` with your defaults. Each video is a folder `projects/<slug>/` whose `video.json` is the whole video as data: edit it (or ask Claude to) and render again.

## 4. How a video gets made

1. **Plan**: Claude picks the format and tells you the plan in three lines.
2. **Script**: written to a short-form bar: the payoff in the first 1.5 seconds, about 3 words a second, a turn every few seconds, one call to action. Every number needs a source. You see the script (and for explainers, the storyboard) once before anything is voiced.
3. **Voice**: Kokoro on your computer (`am_michael`, `af_heart` and others), or your own recording.
4. **Draft**: a half-size render in a minute or two. Claude makes a contact sheet and scores it on hook, clarity, pace, variety, polish and payoff; anything under 4 out of 5 is fixed and rendered again (at most three rounds).
5. **Final**: the full 1080x1920 render with burned captions, an original music bed under the voice, sound effects on every cut and reveal, loudness at -14 LUFS, plus `.srt` and `.vtt` subtitle files.
6. **Check**: `video-qa` measures the file (format, loudness, black or frozen frames, flashing, margins) and makes a contact sheet.
7. **Publish pack**: per platform: the file, thumbnails, title and description, subtitles, credits and disclosure advice. You upload it yourself.

## 5. The look

- Presets: `volt` (lime), `ember` (orange), `ice` (cyan), `grape` (violet), or your colours and font in `brand/brand.json`.
- Every frame moves: a living background, film grain, a slow push-in, springy entrances and motion-blurred transitions (slide, whip, zoom-through, slash, shatter).
- Captions: `pop` (default), `karaoke`, `clean` or `none`. Kinetic videos have none; the words are the picture.
- Music: the generated bed, your own licensed track (`library/music/`), or none.

## 6. Troubleshooting

- **"The Remotion engine is not ready"**: run the two commands Claude showed you in `~/.aisle-video/remotion`, then `/video doctor`.
- **"FFmpeg not found"**: run `/video doctor` for the install line.
- **Captions drift a little from the voice**: the word times were estimated. Set up whisper.cpp and Claude re-aligns them.
- **A render is slow**: drafts are half size and about four times faster; only the final is full size. A 35-second final takes a few minutes on a laptop.
- **"kokoro not set up"**: see step 4 of the setup, or record the script yourself.
- **Disk is full**: delete `projects/*/out/`.

## 7. Rights and labels, in plain words

- Every asset needs a licence in `video.json`, or the build fails. The generated music and sound effects are original and need none.
- Use only your own app, footage, logos and voice, or ones you hold a licence for. No real person's voice or likeness without consent.
- Disclosure advice (the "altered or synthetic content" label) is worked out from your assets and printed in `CREDITS.txt`; synthetic voices are labelled. Check each platform's own help page before publishing.
- Nothing is ever uploaded for you.
