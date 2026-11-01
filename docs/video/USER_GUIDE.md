# Agent Aisle video library: user guide (draft, M3)

This is a draft. In this version you can set up a studio folder, write a script and storyboard, add animated diagrams and code scenes, make a voice track and captions, render a video and have it checked automatically. Editing footage, other video types and publishing come in later versions. `/video explain "<topic>"` walks an explainer through all of it.

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

1. **Write** (`/video-write explain "how rate limiting works"`). It writes `brief.json`, `script.md` (one `[id] line` per sentence with a `beat:`), `facts.md` (a source for every technical claim), `hooks.md` (5 openings) and `storyboard.md`. A checker runs and lists errors, such as a claim with no source or a missing beat. Read the storyboard, change what you want, then say go: it writes `video.json`. Only the `explain` and `story` modes exist. Scene kinds: `title`, `quote`, `list`, `chart`, `broll`, and for technical steps `rate-limit`, `code`, `sequence` and `request-flow` (step 2).
2. **Diagram scenes** (`/video-explain`). Fills the technical scenes with real data, never hand-drawn numbers. A `rate-limit` scene runs the actual algorithm (token bucket, leaky bucket, fixed window or sliding window) on seeded traffic and draws what happened; `simulate.mjs` prints the numbers the narration may quote. A `request-flow` scene is imported from an `arch-visualize` model (`docs/architecture.json`): the packets travel the connections of one flow and each step shows the `file:line` it came from. `code` scenes show real code with focus and diff; `sequence` scenes draw a message exchange from a few lines of text. See "Diagram scenes" below.
3. **Voice** (`/video-voice`). English uses Kokoro, Arabic uses 3arab-TTS, both on your own computer. `--provider test` makes a plain tone instead of speech, which is enough to check timing. Lines you did not change are kept, so re-running is cheap. Nothing can clone a voice, and a clone request is refused without consent.
4. **Lengths**: `timing.mjs` sets each scene's length from the audio.
5. **Word times and captions** (`/video-captions --style karaoke`). With whisper.cpp set up the word times are measured; without it they are estimated, and the tool says so in capital letters. Three styles: `karaoke`, `pop`, `clean`. You also get `captions.srt` and `captions.vtt`.
6. **Brand** (`/video-brand init`, `/video-brand check`): colours, a font and a logo for every video. Colours that are hard to read are refused. For Arabic put an Arabic font in `brand/fonts/`.
7. **Render**: a 540p draft first (`--draft`), look at it, then the final. Captions are burned in unless you chose subtitle files only; scenes keep clear of them. The sound is brought to about -14 LUFS.
8. **Credits**: `credits.json` and `CREDITS.txt`, with the disclosure advice.
9. **Check** (`/video-qa`). Measures the render and writes `qa/report.json` and a contact sheet (`qa/contact-sheet.png`), one picture per scene plus one every 2 seconds. See "The check" below.

The same project and assets always give the same video, byte for byte.

### Setting up voices and captions (once)

`/video doctor` shows which of these are ready. None are required: without them you can still use the test tone and estimated captions.

- Kokoro (English voice) needs Python 3.10 to 3.12 and about 1.5 GB for the libraries plus 350 MB of weights.
- whisper.cpp with the `base` model (150 MB) gives measured word times. On one test, 83% of words were within 100 ms of the reference and the median error was 35 ms; estimated times were within 100 ms for 35% of words.
- 3arab-TTS (Arabic voice) is about 1 GB of model plus libraries and runs slowly on a CPU.
- The exact steps, versions and the measured numbers are in `registry/official/video-voice/references/engines.md`. Voices are machine voices; Arabic text and speech are a draft that a native speaker should review before you publish.

### Diagram scenes

![A token bucket simulated on 60 random requests](images/m3-rate-limit.jpg) ![The bucket in code](images/m3-code.jpg) ![Fixed against sliding window](images/m3-fixed-vs-sliding.jpg) ![A request flow from the code of aisle add](images/m3-request-flow.jpg)

- **Rate limit.** `node video-explain/scripts/simulate.mjs --seed 42 --count 60 --pattern poisson --rate 6 --algo token-bucket --capacity 5 --refill 3 --into projects/<slug>/video.json --scene s3`. The footer of the scene says how much real time is shown in how many seconds; do not narrate it as real time. The same seed gives the same video. Say "in this simulation", and do not claim one algorithm is better in general from one seed.
- **Request flow.** Run `/arch-visualize` on your project first. `arch-import.mjs --list` shows the flows; `--flow <id> --into ... --scene <id>` fills the scene with only the components the flow touches. It shows what the code says, not live traffic, and it has no timings.
- **Code.** At most 20 lines of 60 characters. The panel is always dark. The colours come from a bundled highlighter (Shiki, MIT) and nothing is downloaded.
- **Sequence.** `A->B: text` for a request, `B-->A: text` for a reply, `Note over A,B: text`. A subset of Mermaid sequence diagrams also works.

### The check

`/video-qa` fails the video on: a wrong size, frame rate or codec; sound that is silent, far from -14 LUFS or clipping; a black stretch; more than 3 flashes in a second; anything drawn in the outer margins; captions too small or low in contrast; a narration line with no voice; a missing licence; a leftover `TODO` or `[needs-source]`. It warns when nothing changes for 3 seconds. It does not check spelling, platform user-interface margins or the truth of the content, and the loudness target and margins are working defaults, not confirmed platform rules (`TODO(verify)`).

![The contact sheet of the rate-limit demo](images/m3-contact-sheet.png)

## 5. Troubleshooting

- **"FFmpeg not found"**: run `/video doctor`.
- **"HyperFrames is not installed"**: run the install line it prints.
- **A code scene looks different on another computer**: it uses that computer's monospace font; the colours and layout are the same.
- **`/video-qa` says "could not run video-core checks"**: install `video-core` next to `video-qa` in the same skills folder.
- **A QA failure on loudness or clipping after you changed the voice**: render again; the mix is rebalanced at render time.
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
