# Agent Aisle video library: user guide

You make a video with **one command**: type `/video` and say what you want, in your own words. Claude reads the request, picks the right tools from the library (script writer, voice, captions, footage editing, renderer, quality check, and so on) and uses them for you. You never type the name of a tool, and you stay in charge at the few points that matter: you approve the storyboard, any price before it is spent, and the rights to any footage.

Examples of what you can type:

- `/video explain how a rate limit works, with a real simulation`
- `/video a showcase video for my app at http://localhost:3000, using our brand colours`
- `/video bring in https://example.com/my-talk.mp4 and cut it into a 30 second vertical short with captions`
- `/video turn our README into a one minute video`
- `/video a chart video of this week's npm downloads for react, vue and svelte`
- `/video the same video in Arabic`

Nothing is uploaded, ever: the last step prepares a pack you post by hand. This guide describes what happens behind the scenes, so you know what to expect and what you can edit. The tools are listed in the sections below by what they do.

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
3. Install the library: `aisle add video` in the studio folder, or with `--global` for every folder. It brings all its parts (26 of them) with it; you only ever type `/video`.

## 3. Create the studio

Open any empty folder (for example `Documents/AisleVideos`) and type `/video` followed by what you want. The first time, Claude sets up the studio for you (`/video init` does only that). The setup creates `brand/`, `characters/`, `recipes/`, `library/`, `inbox/`, `projects/`, `exports/`, a `CLAUDE.md` with your defaults, `brand/brand.json` and `providers.yaml`. You never create folders by hand. Running it again changes nothing that exists, so it is safe.

`/video doctor` (or just ask what your machine can do) lists what is installed, your hardware tier (not ready, $0 laptop, local GPU) and one install line for anything missing. It only says "found" or "missing" for API keys and never shows them.

## 4. Make a video

Behind your one request there is a chain of steps; each reads the files of the one before, so you can stop and edit between steps (ask Claude to pause where you want). A project is a folder `projects/<slug>/`.

1. **Write**. It writes `brief.json`, `script.md` (one `[id] line` per sentence with a `beat:`), `facts.md` (a source for every technical claim), `hooks.md` (5 openings) and `storyboard.md`. A checker runs and lists errors, such as a claim with no source or a missing beat. Read the storyboard, change what you want, then say go: it writes `video.json`. Only the `explain` and `story` modes exist. Scene kinds: `title`, `quote`, `list`, `chart`, `broll`, and for technical steps `rate-limit`, `code`, `sequence` and `request-flow` (step 2).
2. **Diagram scenes**. Fills the technical scenes with real data, never hand-drawn numbers. A `rate-limit` scene runs the actual algorithm (token bucket, leaky bucket, fixed window or sliding window) on seeded traffic and draws what happened; `simulate.mjs` prints the numbers the narration may quote. A `request-flow` scene is imported from an `arch-visualize` model (`docs/architecture.json`): the packets travel the connections of one flow and each step shows the `file:line` it came from. `code` scenes show real code with focus and diff; `sequence` scenes draw a message exchange from a few lines of text. See "Diagram scenes" below.
3. **Voice**. English uses Kokoro, Arabic uses 3arab-TTS, both on your own computer. `--provider test` makes a plain tone instead of speech, which is enough to check timing. Lines you did not change are kept, so re-running is cheap. Nothing can clone a voice, and a clone request is refused without consent.
4. **Lengths**: `timing.mjs` sets each scene's length from the audio.
5. **Word times and captions**. With whisper.cpp set up the word times are measured; without it they are estimated, and the tool says so in capital letters. Three styles: `karaoke`, `pop`, `clean`. You also get `captions.srt` and `captions.vtt`.
6. **Brand**: colours, a font and a logo for every video. Colours that are hard to read are refused. For Arabic put an Arabic font in `brand/fonts/`.
7. **Render**: a 540p draft first (`--draft`), look at it, then the final. Captions are burned in unless you chose subtitle files only; scenes keep clear of them. The sound is brought to about -14 LUFS.
8. **Credits**: `credits.json` and `CREDITS.txt`, with the disclosure advice.
9. **Check**. Measures the render and writes `qa/report.json` and a contact sheet (`qa/contact-sheet.png`), one picture per scene plus one every 2 seconds. See "The check" below.

The same project and assets always give the same video, byte for byte.

### Setting up voices and captions (once)

`/video doctor` shows which of these are ready. None are required: without them you can still use the test tone and estimated captions.

- Kokoro (English voice) needs Python 3.10 to 3.12 and about 1.5 GB for the libraries plus 350 MB of weights.
- whisper.cpp with the `base` model (150 MB) gives measured word times. On one test, 83% of words were within 100 ms of the reference and the median error was 35 ms; estimated times were within 100 ms for 35% of words.
- 3arab-TTS (Arabic voice) is about 1 GB of model plus libraries and runs slowly on a CPU.
- The exact steps, versions and the measured numbers are in `registry/official/video-voice/references/engines.md`. Voices are machine voices; Arabic text and speech are a draft that a native speaker should review before you publish.

10. **Publish**. Prepares one folder per platform. See "Publishing" below.

### Diagram scenes

![A token bucket simulated on 60 random requests](images/m3-rate-limit.jpg) ![The bucket in code](images/m3-code.jpg) ![Fixed against sliding window](images/m3-fixed-vs-sliding.jpg) ![A request flow from the code of aisle add](images/m3-request-flow.jpg)

- **Rate limit.** `node video-explain/scripts/simulate.mjs --seed 42 --count 60 --pattern poisson --rate 6 --algo token-bucket --capacity 5 --refill 3 --into projects/<slug>/video.json --scene s3`. The footer of the scene says how much real time is shown in how many seconds; do not narrate it as real time. The same seed gives the same video. Say "in this simulation", and do not claim one algorithm is better in general from one seed.
- **Request flow.** Run `/arch-visualize` on your project first. `arch-import.mjs --list` shows the flows; `--flow <id> --into ... --scene <id>` fills the scene with only the components the flow touches. It shows what the code says, not live traffic, and it has no timings.
- **Code.** At most 20 lines of 60 characters. The panel is always dark. The colours come from a bundled highlighter (Shiki, MIT) and nothing is downloaded.
- **Sequence.** `A->B: text` for a request, `B-->A: text` for a reply, `Note over A,B: text`. A subset of Mermaid sequence diagrams also works.

### The check

The check fails the video on: a wrong size, frame rate or codec; sound that is silent, far from -14 LUFS or clipping; a black stretch; more than 3 flashes in a second; anything drawn in the outer margins; captions too small or low in contrast; a narration line with no voice; a missing licence; a leftover `TODO` or `[needs-source]`. It warns when nothing changes for 3 seconds. It does not check spelling, platform user-interface margins or the truth of the content, and the loudness target and margins are working defaults, not confirmed platform rules (`TODO(verify)`).

![The contact sheet of the rate-limit demo](images/m3-contact-sheet.png)

### Editing footage

Editing works on files you already have (a screen recording, a talking clip). Each command reads the original and writes a new file; the original is never changed.

- `cut` tightens a talking clip: it shrinks long pauses and takes out "um"s (Arabic fillers too). It is a dry run first and prints what it would remove; add `--apply --out tight.mp4` to render it. On the rate-limit demo it found 16 pauses worth 11 seconds. Without whisper.cpp use `--silence-only`.
- `reframe` turns 16:9 into 9:16. With OpenCV installed (`/video doctor` says) it follows the speaker's face; otherwise use `--mode center|left|right|x=0.4`. It tells you how often a face was found, and it can miss profiles and several people.
- `audio` brings the sound to -14 LUFS without squashing it (two passes), with optional `--denoise` and music under the voice. `color` has three looks (warm, cool, film), your own `.cube` LUT, and an automatic white balance. `stabilize`, `jumpcut` (eased zooms at times you give), `trim`, `join`, `speed`, `gif` and `scenes` are there too.

### Showcase: a demo of your own app

A showcase turns a short demo script into a polished screen demo. You write `demo.md` (one step a line: `go /`, `click "Start free trial"`, `type #email "me@example.com"`, `scroll down 600`, `wait 1`; the agent can draft it, you approve it). `capture.mjs` plays it on your app in a headless browser and records the screen plus an interaction log of every click, keystroke and scroll. `plan.mjs` then cuts waiting over 1.2 seconds, plays typing three times faster, eases a camera in on each click, draws a smooth cursor with a click ripple, and puts the recording in an original, generic phone, laptop or browser frame (a `screen` scene). `beats.mjs --audio track --snap` finds the beat of a music track (60 to 180 BPM) and moves scene cuts to the nearest beat.

One-time setup for capture (you run this yourself; the skills never install anything): `npm install --prefix ~/.aisle-video playwright-core`, plus a Chromium it can start (`/video doctor` shows a `playwright` line). Without it, record your screen yourself and give `plan.mjs` a log.

What it will not do: record a site that is not yours (localhost only, or `--own-site --rights "why"`; requests to other addresses are blocked while recording), type into password, card or key fields, or record a native desktop app. The cursor is drawn from the log, not recorded, and the camera follows the log, not what is on screen. Beat detection can be wrong on complex music, so check by ear.

### Using your own voice

Record the script once, start to finish, in any audio or video file. Claude asks whose voice it is (yours, or someone who agreed: then give a note of their consent), then cuts the recording into one clip per line and measures every word's time with whisper.cpp, so captions and word-synced type work exactly as with a synthetic voice. If a line is not in the recording, it names the line and writes nothing. The recording is never uploaded.

### Agent session timelapse

A session timelapse turns a saved Claude Code log (`~/.claude/projects/<project>/<session>.jsonl`) or a timestamped text log into a short with up to 8 key moments, one code diff and "the session in numbers". Idle gaps over a minute count as one second. Secrets, e-mail addresses and home folders are replaced before anything is kept, and tool output is never used, but prompts and code can still be private: read `script.md` before you publish, and only use sessions that are yours to show. Logs up to 100 MB are read; nothing is run or sent anywhere.

### Weekly data videos

A data video makes a chart video from a fresh public dataset: npm downloads, GitHub stars, or a CSV/JSON file on a host you approve in `live.config.json`. One script (`fetch.mjs`) reads the data with plain GET requests: https only, no keys or tokens, no redirects, 15 seconds, 1 MB. The video shows only those numbers and the changes computed from them, with the source and date on screen and in `facts.md`. Data older than 8 days is refused. Large changes (100% or more) are flagged: real data can glitch, so look at the source before publishing. Nothing is scheduled for you; `references/schedule.md` in the skill gives the weekly commands to put in cron or `/schedule`.

### Product and launch edits

Say something like `/video a fast launch edit for my coffee, photos in ~/photos/ember, price $18, shop now`. Claude cuts each product out of its photo, then builds a short edit with camera moves, a 3D-feeling parallax between the product and its background, big type, grain, flashes and RGB glitches timed to your music (or a steady beat), original sound effects made by the library, and an end card with your price and call to action. It renders from HTML to MP4 on your own computer (Claude desktop app, Code tab, Local environment; Windows, Linux or macOS), checks the result, looks at its own contact sheet and fixes what fails, at most twice, before showing you.

Three looks: `snap` (fast launch), `glide` (calm, premium) and `glitch` (tech, street). Best results come from 3 or more photos with the product on a plain background; the cutout tells you when a photo is too busy. Every word on screen is yours: name, up to three short lines, price, call to action. Photos and music must be yours to use; the library never downloads music or uses another creator's edit (a reference edit can be analysed for pace numbers only). This is motion design on your photos, not AI-generated video: it cannot make people or characters move.

### Kinetic videos (bold words that pop as they are spoken)

Say something like `/video a punchy motion-graphics video about what Agent Aisle does, bold words popping in as they are spoken, slash cuts between points`. Claude writes a short script from your facts, voices it, and builds a video where every word pops in at the moment it is said in a heavy display font, key words glow in an accent colour with a spark, and between points a glowing slash cuts the screen in two (or it shatters, whips or zooms through). Your script can also list rows for a tilted 3D card or a chain of steps for a flow. Three looks: `volt` (lime), `ember` (orange), `ice` (cyan), or your own accent colour. It uses the local synthetic voice, or your own recording once the recording option lands. Sound effects are original and made by the library; the display font is Anton (SIL Open Font License, shipped with the library). Everything on screen comes from your script, and nothing is uploaded.

### Publishing

Publishing needs a final render, a passing check and `credits.json`. You (or the agent) write `publish/copy.json` with a title, description and hashtags; the tool checks it against each platform's limits and refuses any number that is not in your script or facts. Per platform you get the encoded video, three thumbnails and a designed title card, the checked text (with YouTube chapters made from your scenes), captions, credits, a `disclosure.md` with the questions to answer on the platform (including "made for kids"), and `exports/publish.json` with file hashes. It never uploads. The platform limits are unverified (third-party sources disagree, and the smaller limit is used); check each platform's own page before relying on them.

![The thumbnails and card of the rate-limit demo](images/m4-thumbnails.jpg)

### Learning a format

Analysis (`--rights own|permission|cc|public-domain` says why you may use the video) measures how a video you have the right to use is made: cuts a minute, shot length, hook length, how much moves and how much is speech, five colours and a (rough) tempo guess. It writes `recipes/my-format.json` with numbers only. It never keeps or reuses the footage, sound, words or characters, and it does not measure text on screen or caption style. The rights you state are recorded, not verified.

### Stories and AI images

A story short plans a short from original characters shown in images: a style bible, a reference pack per character (made first, so every shot starts from the same look), a shot list of 3 to 8 seconds per shot, and a continuity log (outfit, props, place, time of day). With `--generator stills-only` the images get a slow push-in and no video is generated. the generator (`video-generate`, `image` or `video`) makes the images or clips. Its only offline provider is `test` (a coloured gradient, to try the flow); real providers go in `providers.yaml`, which has no keys (the key is read from an environment variable such as `GEMINI_API_KEY`). The two real adapters (`gemini-image` and `veo`) were written without access to the providers' documents and are marked `TODO(verify)`: run one cheap call and check before you rely on them. Results can miss; the skill makes one try per shot and asks before any retry. Music, sound effects and lip sync are not built.

### Bringing in footage (ingest)

Bringing in footage (a link or a file) copies footage into `<project>/ingest/` and writes `rights-ledger.json`. It asks which of four rights bases is true: `own`, `permission`, `cc` or `public-domain` (the last three need a note of at least 15 characters: the licence and link, or who agreed). With no basis, nothing is downloaded. Paid, DRM-protected and login-only services are refused. Downloads need `yt-dlp`, which you install yourself (`/video doctor` shows whether it is there). `--analysis-only` keeps a reference copy for `video-analyze`; `check.mjs` refuses to put it in a scene. `--verify` checks every ledger file against its recorded hash. The ledger records your statement; it cannot check that it is true.

### Arabic and English versions (localize)

Dubbing a project to Arabic (or English) makes a sibling folder, `<project>.ar/`, so both versions stay editable. Claude translates the script and on-screen text into `translate.json`; a script checks the result (length limits, brand names, no digits in Arabic narration). Then the usual voice, timing, captions, render and QA steps run in the new folder, and the scenes retime to the new audio. Read `translation-review.md`: the translation is a machine draft that needs a native speaker before you publish. Not built: lip sync, cloning your own voice, and languages other than Arabic and English.

## 5. Troubleshooting

- **"FFmpeg not found"**: run `/video doctor`.
- **`reframe` says no face was found**: OpenCV may not be installed (`/video doctor`), or the face is small or sideways. Use `--mode center`, `left`, `right` or `x=0.4`.
- **Publishing refuses**: read each `REFUSED` line; it names the missing QA, credits or copy, the wrong shape for the platform, or a number that is not in your script.
- **"HyperFrames is not installed"**: run the install line it prints.
- **A second renderer (Remotion).** `--engine remotion` is optional and you install it yourself (`remotion` and `@remotion/cli`, version 4.x, same version). It draws the same scenes, so nothing in your project changes. Remotion's licence is free for individuals and companies of up to 3 people and paid above that; the note is printed each time. This adapter has not been tried against a real Remotion install yet, so treat the first render as a test.
- **A code scene looks different on another computer**: it uses that computer's monospace font; the colours and layout are the same.
- **The check says "could not run video-core checks"**: install `video-core` next to `video-qa` in the same skills folder.
- **A QA failure on loudness or clipping after you changed the voice**: render again; the mix is rebalanced at render time.
- **Arabic letters look wrong or missing**: put an Arabic font (for example Cairo, OFL licence) in `brand/fonts/` and point `meta.brand` at your `brand.json`; the brand check (`--lang ar`) tells you if none is there.
- **Captions drift from the voice**: the word times were estimated. Set up whisper.cpp (see the setup notes above) and run the voice step's alignment again.
- **"kokoro is not installed"**: run `/video doctor`; use `--provider test` meanwhile.
- **A render is slow**: use `--draft` while you edit.
- **Disk is full**: delete `projects/*/out/` and `projects/*/cache/`.

## 6. Costs

Everything is local and free except AI image or clip generation (`video-generate`) with a real provider. Before any paid call it prints the quote (units x price from your `providers.yaml`; no price is built in) and stops. It runs only when you say yes to that exact total and the agent re-runs with `--approve <total>`; there is no `--yes`. It refuses when the project budget (`--budget`) or the monthly cap in `providers.yaml` is 0 or would be passed. A repeat of the same prompt, seed and reference images comes from the cache at no cost. Every call is logged in `projects/<slug>/generation-log.jsonl` (never the key).

## 7. Rights and labels, in plain words

- Every asset needs a licence in `video.json`, or the build fails. Music and sound effects need one too.
- Use only original characters, music and logos, or ones you hold a licence for. No real person's voice or likeness without their consent.
- Disclosure advice (the "altered or synthetic content" label) is worked out from your assets and printed in `CREDITS.txt`. Platform rules change; check the platform's own help page before publishing (`TODO(verify)`).
- Nothing is ever uploaded for you.
