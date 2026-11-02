# VIDEO_SKILLS_LIBRARY_BRIEF.md: the Agent Aisle video library

A brief for Claude Code, describing a library of agent skills that write, produce, edit and publish videos. It covers kids' animations, technical explainers with animated diagrams and code, AI-generated stories, product showcases, and short-form social clips.

Read all of it before you start. Work in milestones (section 13). Start each milestone in plan mode and get the plan approved. Stop after each one with **built / tested / decisions needed**.

Facts about tools come from research done on 1 November 2026. They change fast: check current docs before relying on any of them. Anything not yet confirmed is marked `TODO(verify)`.

---

## 1. Goal

A user types one command, such as `/video explain "how rate limiting works" --format reel`, and gets a finished, publishable video. Along the way they also get a script they can edit, a storyboard, a project file they can re-render, captions, a thumbnail, and a credits and licences file.

Every step can also run alone:
- write the script;
- voice it;
- caption it;
- cut and reframe it;
- render it;
- check it;
- export it.

These are the four principles the whole library rests on. They mirror how `arch-visualize` works.

1. **The LLM writes a plan, and code renders it.** The agent writes a JSON project (`video.json`, section 4). Deterministic scripts and renderers turn it into frames. The agent never "draws" a frame by guessing, so a re-render gives the same video.
2. **Text-first and editable.** Script, storyboard, captions and timeline are all text files the user can change and re-render, a bit like a doc.
3. **Truthful explainers.** Diagrams and code animations are driven by real data. A rate-limiting animation is driven by actually running a token-bucket simulation, and a request-flow video can come from an `arch-visualize` model. Nothing the video shows should be wrong.
4. **Clean rights.** Every asset (voice, music, image, clip, font) is logged with its source and licence in `credits.json`. Disclosure flags are worked out, not guessed.

## 2. The video types to cover, and what each one needs

The example links the user gave were not viewable from the research environment: Instagram blocks automated reading and the YouTube page showed no details. The categories below come from the user's own descriptions.

To match a specific style, the user downloads their own copy and runs `/video-analyze` on it (section 6.13). That builds a "style recipe" (pacing, cut rate, caption style, palette, structure) and never copies the content.

| Type | Looks like | Main engine | Key pieces |
|---|---|---|---|
| **Kids animation** | Bright 2D characters, simple story, songs, counting, morals | Cutout/puppet animation in HTML/SVG (deterministic). AI image-to-video optional. | Character bible, rigged SVG puppets, mouth shapes synced to voice, a gentle voice, music, big readable captions |
| **Tech explainer** | Animated diagrams: requests travelling server ↔ client, rate-limit graphs, code typing and highlighting | HyperFrames or Remotion. Manim or Motion Canvas for maths-heavy scenes. | Diagram components, simulation-driven animation, code "magic move", charts, voiceover, captions |
| **Story video** | Narrated story with AI-generated scenes, mood music, cinematic captions | AI stills, then image-to-video or Ken Burns motion, assembled in the timeline | Story writer, a style bible for consistency, shot list, AI generation adapters, SFX, music |
| **Showcase** | Product/app demo: screen recording with smooth zooms, device frames, kinetic text, upbeat cuts | Playwright screen capture, then auto-zoom from clicks, then the timeline | Recording script, cursor smoothing, zoom-on-action, device mockups, beat-synced cuts |
| **Talking-head edit** | The user's own footage, cut tight, with captions and b-roll | ffmpeg plus Whisper | Silence and filler removal, jump cuts, captions, reframing to 9:16, b-roll insertion |
| **AI trend formats** | Viral AI shorts: "what if" scenarios, historical POV, tier lists, data stories | Mixed | Format templates, from the writer and the analyzer |

## 3. Tool landscape (researched; pick per decision D1–D8)

### 3.1 Rendering: code to video

| Tool | What it is | Licence | Use for |
|---|---|---|---|
| **HyperFrames** (HeyGen) | Plain HTML with data attributes for timing. Animation through GSAP, Lottie, CSS or Three.js. Deterministic render via Puppeteer and FFmpeg. CLI: `init`, `preview`, `render`, `add`, `lint`, `transcribe`, `tts`. Ships its own agent skills. Needs Node 22+ and FFmpeg. | Apache 2.0 | **Default engine candidate.** Any web skill works, and its licence is clean for redistribution. |
| **Remotion** | Videos as React components, rendered in headless Chromium. Studio, Player, Lambda rendering. Official agent skills (`npx skills add remotion-dev/skills`). | Custom licence: free for individuals and companies of up to 3 people; larger companies pay (`TODO(verify)` current terms) | The richest ecosystem. Fine for Hazem himself, but **users of the library at larger companies would need a licence**. |
| **Motion Canvas** | Generator-function animations on a canvas. Great for choreographed explainers. | MIT | Precise technical animations |
| **Revideo** | A fork of Motion Canvas with a Node `renderVideo()` API and templates. Version 0.x. | MIT | Batch and server rendering. `TODO(verify)` that it is still maintained. |
| **Manim (Community)** | Python maths animation, the 3Blue1Brown style. `manim-voiceover` plugin. | MIT `TODO(verify)` | Maths, algorithms, graphs |
| **FFmpeg** | Cutting, encoding, filters, audio. The backbone of every pipeline. | LGPL/GPL, depending on the build | Everything |
| Lottie (lottie-web), Rive runtimes, Three.js, D3, rough.js, Shiki | Animation, 3D, charts, a hand-drawn look, code highlighting | Mostly MIT, `TODO(verify)` each one | Components inside HTML scenes |
| GSAP | The animation library HyperFrames uses | Free "standard" licence, **with use restrictions** `TODO(verify)`: check that a video *tool* is allowed to use it | Animation, if the licence allows it |

### 3.2 Voice, speech and audio

- **Speech to text, for captions and edits:**
  - **WhisperX**: word-level timestamps through forced alignment, plus speaker diarization. BSD-2.
  - **whisper.cpp**: CPU, portable. MIT.
  - **faster-whisper**: fast, with approximate word timestamps. MIT.
  - Model: `large-v3-turbo` for speed, `large-v3` for accuracy.
- **Text to speech:**
  - **Kokoro**: Apache 2.0. Very fast, good quality, no cloning. Arabic not listed.
  - **Chatterbox** (Resemble AI): MIT. Cloning from a short sample, with a built-in watermark.
  - **CosyVoice2**: Apache 2.0, multilingual.
  - **Dia**: Apache 2.0, multi-speaker dialogue with laughs and pauses.
  - **Arabic: 3arab-TTS-500M-v2**, from 2026. Apache 2.0, Modern Standard and **Egyptian Arabic**, voices designed from a text description. Cloning is still experimental, and numbers are best written out as words.
  - Paid APIs such as ElevenLabs as an option (`TODO(verify)` Arabic quality and terms).
- **Music:** ACE-Step 1.5 (open, `TODO(verify)` licence), Stable Audio Open (`TODO(verify)` licence), or royalty-free libraries with their licences logged. AI music needs disclosure on YouTube.
- **SFX:** Freesound (licence per sound, CC0 preferred) or a bundled CC0 pack.
- **Clean-up:** FFmpeg `loudnorm` (two passes), `afftdn` or `arnndn`, DeepFilterNet (`TODO(verify)`), and `sidechaincompress` to duck music under the voice.

### 3.3 AI image and video generation (optional, paid, through adapters)

Prices from a September 2026 comparison, per second at 720p:

| Model | Price per second | Native audio | Notes |
|---|---|---|---|
| Veo 3.1 (Google) | Lite $0.05, Fast $0.10, Standard $0.40 | Yes, always on | "Ingredients", or character and scene references |
| Kling 3.0 (Kuaishou) | $0.084 silent, $0.126 with audio | Optional | "Elements" reference images (1 to 4) |
| Wan 3.0 (Alibaba) | $0.083 | Yes | — |
| LTX-2.5 (Lightricks) | $0.09 Fast, $0.12 Pro | Yes | Open weights |
| MiniMax H3 | $0.08 | Yes | Open weights |
| Seedance 2.0 / 2.5 (ByteDance) | ~$0.15 / ~$0.23 | Yes | — |
| Runway Gen-4.5 | $0.12 | No | Strong image-to-video, keyframes, video-to-video |
| Luma Ray 3.2 | $0.06 | No | Keyframes, "modify" |
| HunyuanVideo 1.5 (Tencent) | — | — | Open weights, no official API |

**Higgsfield Katana** is an optional paid provider, reached through an MCP connector rather than an API. Higgsfield is an AI video company; Katana is its editing skill.

- **What it does:** remakes a reference edit (the user's own video or a Higgsfield preset) around up to 5 photos of the user's product, clothing or character, using Higgsfield's models. Fixes are made by chatting. Results are MP4s saved to the user's Higgsfield Assets.
- **What it needs:**
  - a **paid Higgsfield plan**: Starter $15 a month for 200 credits, Plus $49 for 1,000, Ultra $129 for 3,000. The free plan and "Unlimited" access don't cover Katana.
  - the Higgsfield connector, at `https://mcp.higgsfield.ai/mcp`, signed in with the user's Higgsfield account. No API key is needed.
- **How the library uses it:** because it is an MCP tool, *the agent* calls it, not our scripts. If the connector is present, `/video-showcase` and `/video-story` may offer "remix with Katana" for product-launch and trend edits. The cost card Higgsfield shows is what the user approves, and the output comes back into `inbox/` as an asset with `licence: higgsfield-plan`.
- **To check (`TODO(verify)`):** whether the connector works in Claude Code (`claude mcp add --transport http higgsfield https://mcp.higgsfield.ai/mcp`) and not only in Claude chat. Also what Higgsfield's terms say about commercial use of outputs.
- **Rights:** never use a reference the user doesn't own or have permission for.

**Sora 2 was removed from the API on 24 September 2026.** Prices and models change monthly, so the adapters read a `providers.yaml` the user edits; nothing is hard-coded.

Rules for this section:
- **Consistent characters:** fix the identity in still images first (a reference pack: front, three-quarter and side views, an expression sheet, poses), then animate each shot. Shots are 3 to 8 seconds long, with prompts that describe only the motion. Generate multiple characters separately and composite them. Training a LoRA is rarely needed for cartoons.
- **Image generation:** an adapter for any provider. `TODO(verify)` licences of open models (some FLUX variants are non-commercial).
- **Lip sync:**
  - LatentSync (ByteDance, Apache 2.0): about 8 GB of VRAM for version 1.5, about 18 GB for 1.6. No release since June 2025.
  - MuseTalk (`TODO(verify)` licence).
  - Hosted endpoints (Replicate, fal) as options.
- **Post-processing:**
  - Real-ESRGAN for upscaling;
  - RIFE for frame interpolation;
  - rembg or SAM 2 to cut out backgrounds;
  - PySceneDetect for scene cuts;
  - `auto-editor` for silence cuts (`TODO(verify)` licences).

### 3.4 Sourcing and capture

- **yt-dlp:** only for content the user owns, has permission for, or that is clearly licensed (Creative Commons, public domain). Every download records its URL, uploader and licence in `credits.json`. The skill **refuses** to re-upload someone else's video, and it is honest that it can't verify rights: it asks the user to confirm them.
- **Screen capture for showcases:**
  - Playwright `recordVideo`, or a Chrome DevTools Protocol screencast of the user's local app;
  - a scripted interaction log (clicks, typing, scrolls) that drives the auto-zoom and cursor smoothing.

### 3.5 Platform rules (build them into the QA and publish skills)

**YouTube**, as of 2026 (`TODO(verify)` before release):
- **Disclose** realistic synthetic content: a fake real event, a real person saying something they didn't, photoreal scenes, a voice imitating a real person, and AI music.
- **No disclosure needed** for clearly animated or fantasy content, AI help with scripts or thumbnails, captions, upscaling, or cloning your own voice.
- Since 27 May 2026, YouTube can **auto-label** undeclared photoreal AI.
- **Monetization** fails for "inauthentic" content: generic, template-driven videos with only surface differences.

  **So the library must produce varied, original work, not mass templates.** That is a product rule, not just a legal one.

**Kids' content:**
- Mark videos "made for kids" where it applies. That affects comments and ads (`TODO(verify)` the current YouTube and COPPA rules).
- No frightening realism, no dark patterns, no "like and subscribe" pressure aimed at children.
- **No well-known characters** (no Peppa, no Bluey, nothing that resembles them). Only original characters.

**Instagram/Meta:** AI labels and C2PA metadata (`TODO(verify)`).

## 4. Core format: `video.json` (the project file)

One schema, versioned, in `video-core/assets/video.schema.json`. Engine adapters read it. The agent writes it, and scripts check it.

```jsonc
{
  "version": 1,
  "meta": { "title": "...", "type": "explainer|kids|story|showcase|edit|custom",
            "format": "reel-9x16|short-9x16|youtube-16x9|square-1x1",
            "fps": 30, "lang": "en|ar|...", "dir": "ltr|rtl", "audience": "general|kids-3-5|kids-6-9|devs|...",
            "brand": "brand.json" },
  "script": "script.md",                // the writer's output; scenes reference its lines
  "voice": { "provider": "kokoro|chatterbox|3arab|elevenlabs|none", "voiceId": "...", "speed": 1.0 },
  "music": { "asset": "assets/music/x.mp3", "duckUnderVoiceDb": -14 },
  "scenes": [
    { "id": "s1", "kind": "title|diagram|code|chart|character|broll|screen|talking|ai-shot|quote|list|custom",
      "durationFrom": "voice|fixed", "seconds": 4,
      "narration": "line ids from script.md",
      "props": { /* typed per kind, validated */ },
      "transitionIn": "cut|fade|slide|zoom|whip|match",
      "captions": "auto|off|custom" }
  ],
  "captions": { "style": "karaoke|pop|clean|cinematic|kids", "maxWordsPerLine": 4, "safeZone": "reel" },
  "assets": [ { "id": "a1", "path": "...", "source": "generated|user|download|library",
                "licence": "...", "attribution": "...", "aiGenerated": true } ],
  "disclosure": { "realisticSynthetic": false, "aiMusic": false, "voiceClone": "none|self|consented" }
}
```

`video-core` scripts:
- **`check.mjs`:** validates the schema, finds missing assets, scenes with no narration, an unknown `kind`, and assets without a licence. Fails on any of them.
- **`timing.mjs`:** after the voice is made, sets each scene's length from the audio. Writes `timing.json`.
- **`render.mjs --engine hyperframes|remotion`:** builds a project for that engine from `video.json`, renders it, then muxes the audio with FFmpeg.
- **`credits.mjs`:** writes `credits.json` and `CREDITS.txt`, and computes the disclosure flags from the assets.

**Scene components** (the library's real value): each scene `kind` is a component with typed props, built once per engine adapter. Start with HyperFrames.

## 5. Library layout

The library ships as a new aisle in the Agent Aisle registry, for example aisle `video`, with niches `writing`, `production`, `post`, `publish`. Follow the house standard:
- each `SKILL.md` at most 150 lines, written as `SKILL.src.md` with shared includes;
- `references/` one level deep;
- deterministic scripts with stdout capped at 40 lines;
- tests under `registry/skill-tests/`;
- the build passes `skills:build`, `skills:check` and `lint:skills`.

```
registry/official/
  video/                 # orchestrator: /video
  video-write/           # content writer: /video-write
  video-core/            # schema, check, timing, render, credits (used by the others)
  video-voice/           # TTS + alignment
  video-captions/        # whisper + caption styles
  video-explain/         # diagrams, code, charts, simulations
  video-kids/            # characters, puppets, kids rules
  video-story/           # AI stills and shots, consistency
  video-showcase/        # screen capture, zooms, mockups
  video-edit/            # cut, silence, reframe, b-roll, color, audio
  video-generate/        # AI image/video/music adapters (network)
  video-analyze/         # reverse-engineer a format into a style recipe
  video-localize/        # translate + dub + RTL captions
  video-qa/              # automated checks + contact sheet
  video-publish/         # exports, thumbnail, metadata, credits, disclosure
  video-ingest/          # yt-dlp with rights ledger (network)
```

**Security grade:** keep network access only in `video-generate` and `video-ingest`, so every other skill stays network-free and scores well in `aisle audit`. Only scripts call external binaries (ffmpeg, whisper, the TTS CLIs), and they do so through one wrapper in `video-core` that takes an allow-list of programs and a fixed argument list (no shell strings).

## 6. Skills and commands

Each skill is a slash command, and options are arguments. Every skill also works on its own folder of files, so the user can stop and edit between steps.

### 6.1 `/video`: the orchestrator

`/video <type> "<topic or idea>" [--format reel|short|youtube|square] [--lang en|ar] [--length 30s|60s|3m] [--style <recipe>] [--engine hyperframes|remotion] [--budget $0|$5|...]`

It routes to the steps in order:
1. write;
2. storyboard (the user approves it);
3. assets;
4. voice;
5. timing;
6. render;
7. captions;
8. QA;
9. publish.

It also has two setup subcommands, described in section 15:
- `/video init`: creates the studio folder.
- `/video doctor`: checks the tools and prints the hardware tier.

It pauses at the storyboard and before any paid generation. It creates `videos/<slug>/` holding `brief.json`, `script.md`, `storyboard.md`, `video.json`, `assets/`, `out/` and `credits.json`.

`--budget $0` means local-only tools.

### 6.2 `/video-write`: the content writer

`/video-write <mode> "<topic>"`, where mode is `story`, `explain`, `showcase`, `kids`, `ad`, `tutorial`, `hot-take`, `listicle`, `data-story` or `remix-format`.

Outputs:
- `brief.json`: audience, goal, one-line promise, length, tone, call to action;
- `script.md`: narration lines with ids, on-screen text and visual notes;
- `storyboard.md`: one row per scene, with kind, visual, motion, duration and SFX;
- `hooks.md`: 5 alternative first 3 seconds.

Writing rules (in `references/`):
- **Hooks:** open with the payoff, a surprising fact, a counter-take ("most people think X; actually Y") or a visual question.
  - Avoid generic-curiosity hooks. One 2026 analysis reports their completion rate fell about 40% year on year.
  - Avoid "storytime" intros.
- **Retention:** a new visual or idea every 1.5 to 3 seconds in shorts, open loops, and payoff before the call to action.
- **Explain mode:**
  1. the misconception;
  2. a real-world analogy;
  3. the mechanism, step by step, each step mapped to one animation beat;
  4. an edge case or failure;
  5. a one-line takeaway.
  
  Each technical claim gets a source in `facts.md`, and the video can show a small on-screen citation.
- **Story mode:**
  - **60 seconds:** hook, setup, turn, climax, button.
  - **3 to 5 minutes:** three acts.
  - Write a **style bible**: the world, palette, lens and lighting words, and character sheets, so AI shots stay consistent.
- **Showcase mode:**
  - problem, then "watch this", then 3 features each shown as a benefit, then proof (a number or a quote **only if real**), then the call to action;
  - writes the **demo script** that `/video-showcase` performs.
- **Kids mode:**
  - age band (3–5 or 6–9) sets vocabulary, sentence length, pace and repetition;
  - one learning goal per video;
  - a kind tone and no scary peril;
  - original characters only;
  - optional song lyrics, written originally (not to an existing song's tune) unless that song is public domain.
- **Arabic:** writes natively in Arabic (Modern Standard or Egyptian, as asked), not a translation. Writes numbers as words for TTS, and adds diacritics where pronunciation is ambiguous.
- **Honesty:** never invents statistics, testimonials or reviews. Marks claims that need checking.

### 6.3 `/video-voice`

`/video-voice [--provider kokoro|chatterbox|cosyvoice|dia|3arab|elevenlabs] [--voice <id>] [--clone my-sample.wav]`

- Makes one audio file per script line, then aligns the words, using either the TTS engine's own timings or WhisperX.
- Writes `voice/*.wav` and `voice/words.json`.
- **Cloning is allowed only with the user's own voice, or a recorded consent from the speaker.** The skill asks, records the answer in `credits.json`, and never clones a public figure.
- `--dialogue` (Dia/CosyVoice) for multi-character stories and kids' episodes.

### 6.4 `/video-captions`

`/video-captions [--style karaoke|pop|clean|cinematic|kids] [--lang] [--burn|--srt|--both]`

- Uses word timings, from the voice step or from transcribing the user's footage.
- Styles live as data in `brand.json`: font, size, stroke, highlight colour, maximum words per line, position inside the platform safe zone.
- **Arabic and RTL:** render captions in the browser engine (HyperFrames/Remotion) or through libass with HarfBuzz, so letters join correctly. Never use plain `drawtext` for Arabic.
- Writes `.srt` and `.vtt` files too, for accessibility and for upload.

### 6.5 `/video-explain`: diagrams, code and simulations

The best part of the library: a set of explainer components, each a scene `kind` with typed props.

- **`request-flow`:** clients, servers, caches and databases with packets travelling along edges, responses coming back, and latency labels.
  - It can **import an `arch-visualize` model** (`docs/architecture.json`) so a project's real architecture becomes a narrated video.
- **`rate-limit`:** token bucket, leaky bucket, fixed and sliding window.
  - Requests arrive as dots, the bucket fills and drains, and rejected requests bounce with a 429.
  - A live line chart shows allowed against rejected requests.
  - **Driven by `simulate/rate-limit.mjs`**, which runs the real algorithm on a seeded arrival pattern. The animation is the simulation's event log, so it is correct by construction.
- **Other simulations**, each a small deterministic simulator plus a renderer:
  - `load-balancer`: round robin, least connections, a failing node;
  - `cache`: hit, miss, TTL expiry, stampede;
  - `queue`: producer, consumer, backlog, retries, dead-letter queue;
  - `circuit-breaker`;
  - `retry-backoff`;
  - `db-index`: full scan versus B-tree lookup;
  - `cdn`;
  - `oauth-flow`;
  - `tcp-handshake`;
  - `dns-lookup`;
  - `consistent-hashing`;
  - `big-o-race`: sorting algorithms racing.
- **`code`:**
  - code typed in or revealed, with highlighting (Shiki);
  - token-level morphs between versions ("magic move" style; `TODO(verify)` the library and licence, or write it ourselves);
  - focus and highlight on lines, and a "diff" view;
  - a terminal component that replays recorded command output.
- **`chart`:** animated line, bar, race and area charts from CSV/JSON (D3 inside the scene).
- **`sequence`:** an animated sequence diagram from a small DSL or from Mermaid sequence syntax.
- **`concept`:** labelled shapes, arrows, callouts and a hand-drawn style (rough.js), plus a "whiteboard" mode that draws strokes in.
- **`math`:** routes to Manim when equations or graph theory are needed (per D4).

### 6.6 `/video-kids`

`/video-kids new-character | episode "<idea>" --age 3-5|6-9 [--song] [--lang ar|en]`

- **The character bible** (`characters/<name>/bible.md`): shape language, a palette of 3 to 5 colours, outfits, catchphrase, personality, and a list of things never to do.
- **Puppet rigs, recommended as the default:** an SVG character split into parts (head, eyes, brows, mouth set, arms, legs) with pivots. Poses and expressions are data.
  - Animation is deterministic: walk cycles, waves, jumps, blinks, squash and stretch.
  - **Lip sync from the voice track:** phonemes or amplitude become mouth shapes (visemes).
  - This gives perfectly consistent characters, runs free on a laptop, and is fully editable.
- **Character sources:**
  - the agent draws an original SVG character from the bible;
  - the user supplies one;
  - or an AI image is traced or split into parts (D6).
- **The AI path, optional:** keyframe stills from the reference pack, animated with image-to-video for richer scenes, per section 3.3.
- **Backgrounds:** layered SVG parallax scenes (sky, hills, house, room).
- **Kids' rules, checked in QA:**
  - captions large and high-contrast;
  - pace limits;
  - no flashing above safe thresholds (`TODO(verify)` the WCAG 2.3.1 flash limits);
  - kind language;
  - the "made for kids" flag set at publish.

### 6.7 `/video-story`

`/video-story "<premise>" [--style "<style words>"] [--length 60s|3m] [--generator veo|kling|ltx|wan|stills-only]`

The pipeline:
1. the writer's story mode;
2. the style bible and character reference packs;
3. a shot list (3 to 8 seconds each, with camera, action, mood);
4. keyframe stills;
5. image-to-video per shot, or Ken Burns motion on the stills with `--generator stills-only` for $0;
6. narration, music and SFX;
7. cinematic captions.

Additional requirements:
- **Continuity:** a continuity log (outfit, props, time of day) per shot. Each new shot starts from the best previous frame or an anchor image.
- **Cost guard:** before any paid generation, print the shot count × seconds × price from `providers.yaml`, and ask.

### 6.8 `/video-showcase`

`/video-showcase --url http://localhost:3000 --script demo.md | --recording my-screen.mp4`

- Plays the demo script with Playwright on the user's **local or own** app, recording the video and an **interaction log**.
- Post-processing:
  - **auto-zoom** to each click or typing area, with smooth eased camera moves;
  - cursor smoothing and a click ripple;
  - typing sped up;
  - waiting time cut out.
- Device frames (an original, generic phone, laptop and browser chrome; no Apple or other brand artwork), kinetic feature titles, cuts timed to the music's beats (beat detection on the track).
- Optional: a picture-in-picture webcam from a recording the user supplies.

### 6.9 `/video-edit`: FFmpeg post-production

Subcommands:
- `cut`: tighten silence and fillers ("um", "يعني") using WhisperX words, with an adjustable pause threshold.
- `reframe`: 16:9 to 9:16, following the speaker's face (detection on sampled frames, smoothed path) or a fixed crop.
- `broll`: lay b-roll over transcript keywords.
- `jumpcut`: punch-in zooms on emphasis.
- `color`: LUTs, auto white balance, `--look warm|cool|film`.
- `audio`: `loudnorm` to the platform target (`TODO(verify)`, roughly -14 LUFS for social), denoise, ducking.
- `join`, `trim`, `speed`, `stabilize` (vidstab), `scenes` (scene detection), `gif`.

Encoding defaults:
- H.264, `yuv420p`, `-movflags +faststart`, AAC at 48 kHz;
- CRF around 20 with `-preset veryfast`, unless `--best`.

### 6.10 `/video-generate`

`/video-generate image|video|music|sfx|lipsync --provider <id> ...`

Adapters behind one interface, configured in `providers.yaml` (API keys read from the environment and never written to a file):
- every call is logged: provider, model, prompt, seed, cost, output hash;
- stays within the budget;
- caches results by prompt hash so a re-render doesn't pay twice;
- marks outputs `aiGenerated: true` in `video.json`.

### 6.11 `/video-localize`

`/video-localize --to ar|en|fr... [--keep-voice self] [--lipsync]`

1. Transcribe the source.
2. Translate, then have the writer adapt idioms (not word for word).
3. Run TTS in the target language (an Egyptian or Modern Standard Arabic voice).
4. Retime the scenes to the new audio lengths.
5. Mirror on-screen text and layout for RTL.
6. Lip sync only when the user asks.

The output is a separate `video.ar.json`, so both versions stay editable.

### 6.12 `/video-qa`: automatic checks before anything ships

- **Technical** (ffprobe): resolution, fps, codec, length within the platform limit, audio present, loudness and true peak within target, no black or frozen stretches (`blackdetect`, `freezedetect`), no clipping.
- **Visual:**
  - a **contact sheet**: one frame per scene plus every 2 seconds, saved as a PNG the agent views;
  - text inside the platform's **safe zones** (template overlays for reels and shorts, `TODO(verify)` current UI margins);
  - caption contrast and size, and text overflow (checked through the HTML layout);
  - flashing (luma change between frames).
- **Content:**
  - spelling of the on-screen text;
  - every narration line voiced;
  - every asset licensed;
  - disclosure flags consistent with the assets;
  - kids' rules for kids' videos.
- The result is a pass or fail report with timestamps. `/video` doesn't publish on a fail unless the user overrides it.

### 6.13 `/video-analyze`: learn a format, not the content

`/video-analyze my-reference.mp4` (a file the user has the right to use for analysis)

It measures:
- length;
- cuts per minute (scene detection);
- average shot length;
- hook length;
- talking against text against motion share;
- caption style (frame samples);
- palette (k-means on frames);
- music presence and tempo;
- the transcript structure (hook, body and call to action, with timings).

It writes `recipes/<name>.json` for the writer and renderer to use, for example:

```
"pace": { "cutsPerMin": 28 }, "captions": "pop-yellow-center", "structure": ["counter-take hook 2.5s", ...]
```

**It never reuses the reference's footage, audio, script or characters**, and says so in its output.

### 6.14 `/video-publish`

`/video-publish --platforms youtube,shorts,reels,tiktok,linkedin`

Per platform it produces:
- the export preset;
- a thumbnail (3 options from frames or a designed card);
- title, description, hashtags, chapters and the SRT file;
- `CREDITS.txt`;
- disclosure guidance: "Turn on *altered or synthetic content*" or "No label needed: fully animated", with the reason;
- the "made for kids" flag.

It never uploads by itself. Uploading through an API connector comes later and needs explicit confirmation each time.

### 6.15 `/video-ingest`

`/video-ingest <url> --rights own|permission|cc|public-domain`

Runs yt-dlp. It asks for the rights basis and records it, and refuses when the answer is "none" or the source is a paywalled or DRM site. Use cases: the user's own uploads, CC-licensed footage, and a reference copy for `/video-analyze`, which is used for analysis only.

### 6.16 `/video-brand`

`/video-brand init` writes `brand.json`: logo, colours, fonts (OFL fonts such as Inter, IBM Plex Sans Arabic or Cairo, embedded locally), caption style, intro and outro stingers, and lower-thirds. Every other skill reads it, so Hazem's videos look like a series.

## 7. New formats that are rare or don't exist yet (build later, in M10)

1. **Codebase tour:** `/video tour .` uses `arch-visualize` to model the repo, then writes a narrated walkthrough. The camera flies over the architecture and plays real request flows, with evidence `file:line` shown on screen. Agent Aisle owns both halves of this.
2. **Executable explainers:** every technical animation is a real simulation run (section 6.5), so the video can show "seed 42, 1,000 requests" and any viewer can re-run it. Nobody can catch the video being wrong.
3. **PR and release videos:** from a git diff and changelog, a 30-second "what changed" video with code morphs and an architecture diff (it can use `arch-visualize`'s diff). Teams can run it in CI.
4. **Incident replay:** from a postmortem plus log timestamps, an animated timeline of the outage over the architecture diagram: what failed, when alerts fired, and the fix.
5. **Agent-session timelapse:** turns a Claude Code or terminal session log into a sped-up "watch an AI build this app" showcase, with the key moments captioned.
6. **Bilingual learning videos:** Arabic and English side by side, with synced karaoke captions in both. Aimed at Arab learners of tech, or Arabic learners.
7. **Branching or interactive explainers:** the same project exports as an interactive HTML page (HyperFrames/Remotion player) where the viewer picks "token bucket or sliding window?" or slows a step down. A video and an interactive lesson from one source.
8. **Data-driven personalized videos:** one template plus a CSV, giving one video per row (for example a per-customer onboarding video). Limited to the user's own data, with privacy rules.
9. **"Explain my doc or paper":** a PDF or README becomes a 60-second explainer with cited figures.
10. **Kids co-creation:** a parent uploads a child's **drawing** (never a photo of the child). It becomes a puppet-rigged original character, starring in a short story with a learning goal. The drawing stays local and is deleted on request.
11. **Live-data shorts:** a scheduled task renders a fresh chart video from a public dataset each week (a "this week in npm downloads" type of video).
12. **Arabic calligraphy kinetic type:** animated Arabic lettering for quotes and titles, using proper shaping. Rare in AI video tools.

## 8. Quality bar ("professional" means these, and QA checks them)

- **Typography:** at most 2 typefaces, a type scale, captions at least 4.5% of frame height on 9:16 (`TODO(verify)` a good value), never a single orphan word on a caption line.
- **Motion:** eased curves (no linear moves), 6 to 12 frame transitions, one idea moving at a time, and motion that follows the narration beat.
- **Audio:** voice clear above music (ducking), no clipping, loudness on target, and SFX on visual events (whoosh on transitions, pop on reveals), kept subtle.
- **Pace:** set by the format recipe, with a visual change at least every 3 seconds in shorts.
- **Colour:** palette from `brand.json` and contrast checked.
- **No uncanny AI:** for stories, prefer stylized looks (illustration, claymation, anime-inspired *original* styles) over fake photorealism. That also avoids needing a disclosure label.

## 9. Hardware tiers

| Tier | Needs | What works |
|---|---|---|
| **$0 laptop** (CPU only) | Node 22+, FFmpeg, Python | HyperFrames/Remotion, Kokoro or 3arab-TTS (`TODO(verify)` CPU speed), whisper.cpp, every explainer, kids' puppets, showcase, edit, QA |
| **Local GPU** (8 to 24 GB) | CUDA | WhisperX, Chatterbox/CosyVoice, LatentSync, open video models (LTX/Wan/Hunyuan, `TODO(verify)` VRAM) |
| **API budget** | Keys | Veo, Kling, Runway, Luma, ElevenLabs, hosted lip sync |

`/video doctor` checks what is installed and prints which tier is available, plus the one-line install command for anything missing.

## 10. Decisions needed from Hazem (ask; don't assume)

- **D1 Default engine.**
  - HyperFrames: Apache 2.0, HTML, clean for redistribution. **Recommended.**
  - Remotion: biggest ecosystem, but its company licence applies to the library's users at companies of more than 3 people.

  Adapters let both work. Which one goes first?
- **D2 GSAP:** check its licence terms for use in a video *tool*. If it is not allowed, use the Web Animations API or our own tween helpers.
- **D3 TTS default:** Kokoro for English and 3arab-TTS for Arabic, both local. Or a paid API for the best quality?
- **D4 Maths scenes:** add Manim (a Python dependency) in 0.1, or later?
- **D5 First vertical:** what ships first? Recommended: **explainer**. It is closest to Agent Aisle's audience, needs no paid APIs, and shows off the "executable explainers" idea.
- **D6 Kids' characters:** SVG puppets only at first (recommended), or the AI path too?
- **D7 Registry placement:** a new `video` aisle in Agent Aisle, or a separate repo that the registry links to?
- **D8 Dependencies:** each external tool (Python packages, models, npm packages) needs a yes before it is added. Present them as a table: name, licence, size, why.

## 11. Rules (apply to every line)

- **No new dependency without asking** (D8). Pin versions. Record licences in `THIRD_PARTY.md`.
- **Never run anything the user didn't ask to run.** Scripts call only allow-listed binaries through `video-core`'s runner, with argument arrays and no shell strings.
- **Never read secrets.** API keys come from the environment only and are never logged, printed or written to `video.json`.
- **Rights:**
  - every asset has a licence in `credits.json`, or the build fails;
  - voice cloning only with the speaker's consent;
  - no real people put into fabricated scenes;
  - no copyrighted characters, songs or logos;
  - `yt-dlp` only with a stated rights basis.
- **Honesty:** no invented stats, quotes or testimonials. Disclosure flags are computed from the assets, not assumed.
- **Kids:** the rules in section 6.6 are enforced by QA, not just written down.
- **Determinism:** the same `video.json` and assets give the same frames. Seeds are recorded for every generation.
- **House standard:** every `SKILL.md` at most 150 lines with *Use when / Don't use when / Steps / Budget / Output / Done when*; scripts in Node 18+ (HyperFrames itself needs Node 22+); stdout capped at 40 lines.
- **External facts:** check current docs; mark anything uncertain `TODO(verify)`.
- **Process:** work on `stage` in small commits, with tests in each commit. Each skill is tagged `<name>@<version>` before merging to `main` by pull request.

## 12. Tests

- **`video-core`:**
  - the schema accepts and rejects the right cases;
  - `check` catches missing licences and assets;
  - `timing` hits known lengths for fixture audio;
  - the render of a 3-scene fixture is **frame-hash stable** across two runs;
  - `credits` and disclosure flags are right for mixed asset sets.
- **Simulations:** each simulator gives the same event log for the same seed. Hand-checked cases (a token bucket with capacity 5 and rate 1/s rejects request 6 at t=0).
- **Captions:** word timing within 100 ms on a fixture. Arabic caption snapshot shows joined letters (a screenshot compared with a reference).
- **Edit:** `cut` removes known silences in the fixture; `loudnorm` output measures within ±1 LU of target; `reframe` keeps a synthetic moving face inside the crop.
- **QA:** fixtures with black frames, clipped audio, text outside the safe zone and fast flashing are each caught.
- **Security:**
  - an API-key canary in the environment never appears in any output, log or `video.json`;
  - hostile strings in the script are rendered as text, never executed as HTML;
  - the runner refuses binaries that are not on the allow-list.
- **Rights:** `ingest` refuses without a rights basis; `voice --clone` refuses without consent recorded.
- **End to end:** `/video explain "token bucket" --budget $0` on a clean machine with the $0 tier gives a 9:16 MP4 that passes QA, plus SRT, credits and a thumbnail.

## 13. Milestones

Each starts in plan mode and ends with **built / tested / decisions needed**.

- **M0 Research check and decisions:**
  - re-verify sections 3 and 3.5 against current docs;
  - answers to D1–D8;
  - `/video doctor`;
  - a tiny "hello" render on Hazem's machine with the chosen engine.
- **M1 Core:** `/video init` and `/video doctor` (section 15); a first draft of `docs/USER_GUIDE.md`; the `video.json` schema; `check`, `timing`, `render` (one engine), `credits`; the runner; the first five scene kinds (`title`, `quote`, `list`, `chart`, `broll`).
- **M2 Writer, voice and captions:** `/video-write` (explain and story modes), `/video-voice` (local default plus Arabic), `/video-captions` (3 styles plus RTL), `/video-brand`.
- **M3 Explainer vertical:**
  - `/video-explain` with `request-flow` (including `arch-visualize` import), `rate-limit` (simulation-driven), `code`, `sequence`;
  - `/video-qa`;
  - `/video` orchestration for `explain`;
  - **ship 0.1.0 with a demo reel.**
- **M4 Edit and publish:** `/video-edit` (cut, reframe, audio, color), `/video-publish`, `/video-analyze`.
- **M5 Showcase:** Playwright capture, auto-zoom, device frames, beat sync.
- **M6 Kids:** the character bible, SVG puppet rig, visemes, parallax backgrounds, kids' QA rules, the writer's kids mode.
- **M7 Story and generate:** `/video-generate` adapters (start with one image and one video provider), cost guard, cache, reference packs and continuity, `/video-story`.
- **M8 Localize:** English ↔ Arabic dubbing, RTL layout mirroring, optional lip sync.
- **M9 Ingest and second engine:** `/video-ingest` with the rights ledger, and the second render engine adapter (per D1).
- **M10 New formats:** section 7, starting with the codebase tour, PR videos and executable explainers, which tie into Agent Aisle.

## 14. Definition of done (library 1.0)

- Every skill passes the house checks and its tests. `aisle audit` grades every skill A or B, and only `video-generate` and `video-ingest` use the network.
- `/video` makes a QA-passing video for each type (explainer, kids, story, showcase, edit) on the $0 tier, with stills-only stories and puppet-based kids' videos.
- Every output has an editable script, storyboard, `video.json`, captions, credits and disclosure guidance.
- A public demo page shows one video per type, each with its `video.json` and credits, so people can see it is real and reproducible.

## 15. Setup and use (becomes `docs/USER_GUIDE.md` and the README)

Claude Code: build the commands below, and write the user guide from this section in plain language, with screenshots in M3.

Facts about the Claude apps come from Anthropic's docs as of 1 November 2026. Re-check them before release (`TODO(verify)`).

### 15.1 Where the library runs

Video work needs real programs on the user's computer: FFmpeg, Node, a headless browser for rendering, and optionally Whisper and TTS models. So the library runs in **Claude Code**, which is available in two places:

| Where | How | Renders videos? |
|---|---|---|
| **Claude desktop app → Code tab → Local** (recommended for most users) | Install the Claude desktop app (macOS, Windows, Linux beta) and sign in. Click **Code** at the top of the sidebar. In the row under the prompt box, pick the **Local** environment, then **Open folder…** and choose the studio folder. It needs a Pro, Max, Team or Enterprise plan. Node and the CLI don't need installing for Claude itself (but the video tools still need Node, see 15.2). | **Yes.** Everything runs on the user's machine, with their files. |
| **Claude Code in a terminal or VS Code** | `claude` in the studio folder | **Yes.** |
| **Claude chat (desktop or web), with a skill uploaded as a ZIP** | **Customize → Skills → + → Create skill → Upload a skill**. Code execution must be on (**Settings → Capabilities**). | **Writing only.** This runs in Anthropic's cloud sandbox, which can't reach the user's folder or the installed tools, and can't run a long render (`TODO(verify)` sandbox limits). Upload only **`video-write`** here, for scripts, hooks and storyboards on the go. Then render in the Code tab. |

The Code tab's **Cloud** environment runs on Anthropic's machines, so it can't see the Desktop folder either. Use **Local** for videos.

### 15.2 One-time install (about 15 minutes)

1. **Install the prerequisites:**
   - **Windows:** `winget install OpenJS.NodeJS.LTS Gyan.FFmpeg Python.Python.3.12`
   - **macOS:** `brew install node ffmpeg python`
   - **Linux:** your package manager.

   HyperFrames needs **Node 22 or newer** (`TODO(verify)` the winget and brew package names and current versions).
2. **Install the skills.** Either:
   - **For every folder:** `aisle add video --global`, which puts the skills in `~/.claude/skills/` (`TODO(verify)`: build this `aisle` flag if it doesn't exist).
   - **Or only in the studio folder:** run `aisle add video` inside it, which puts them in `.claude/skills/`.

   Also install HyperFrames' own skills if D1 picked it: `npx skills add heygen-com/hyperframes`. Skills in `~/.claude/skills/` work in every project; skills in a folder's `.claude/skills/` work in that folder only.
3. **Create the studio folder:** open the Code tab (Local), open any empty folder (for example `Desktop/AisleVideos`) and type `/video init`. It creates the layout in 15.3. **The user doesn't need to create any folders by hand.**
4. **Check:** type `/video doctor`. It lists what is installed and the hardware tier, and gives one copy-paste install command for anything missing. Whisper and TTS models download on first use, after the user agrees, and it shows their sizes.
5. **Optional, for paid AI generation:** set API keys as **operating-system environment variables** (for example `KLING_API_KEY`), not in a file in the folder. The skills never read `.env` files and never print keys. `/video doctor` only says "found" or "missing".

### 15.3 The studio folder `/video init` creates

The default is `Desktop/AisleVideos`. Any folder works; Documents is better if Desktop syncs to OneDrive or iCloud, because renders are big.

```
AisleVideos/
  CLAUDE.md            # house rules for this studio: default format, language, voice, engine, budget
  brand/brand.json     # colours, fonts, caption style, logo, intro/outro  (/video-brand edits it)
  brand/fonts/         # local OFL fonts (Inter, Cairo, IBM Plex Sans Arabic) – no internet fonts
  characters/          # kids characters: bible.md + SVG puppet parts, one folder each
  recipes/             # style recipes from /video-analyze
  library/music/       # music YOU have a licence for (+ licence.txt next to each)
  library/sfx/         # sound effects (CC0 pack included)
  inbox/               # drop raw footage, screen recordings, reference videos here
  projects/<slug>/     # one folder per video: brief, script, storyboard, video.json, assets, out
  exports/             # final MP4s, SRT, thumbnails, CREDITS.txt, ready to upload
  providers.yaml       # which AI providers are allowed + price per second + monthly cap (no keys)
```

`/video init` is idempotent: it never overwrites files that already exist. It adds `projects/*/cache/` and `exports/` to a `.gitignore`, in case the user puts the folder under git.

### 15.4 Making a video, step by step (for the guide)

1. Open the Claude desktop app → **Code** → **Local** → **Open folder…** → `AisleVideos`.
2. Pick a permission mode. **Manual** is safest the first time: Claude asks before running each command. Switch to **Accept edits** or **Auto** once you trust it.
3. Type a command (the `/` menu lists every installed skill), for example:
   - `/video explain "how rate limiting works" --format reel --lang ar`
   - `/video kids "Nour the turtle learns to share" --age 3-5`
   - `/video showcase --url http://localhost:3000 --script demo.md`
   - `/video-edit cut inbox/my-talk.mp4`, then `/video-captions --style pop`
4. **Read and edit the storyboard.** Claude stops at `projects/<slug>/storyboard.md`. Change anything in the file, or just type the change ("make scene 3 shorter, use a darker palette"), then say "go".
5. **Preview while it builds.** Claude can start the engine's preview server, which opens in the desktop app's **Browser pane**, so you can watch scenes before the full render.
6. **Get the result.** The MP4, SRT, thumbnail options, `CREDITS.txt` and a `publish.md` (titles, description, hashtags, disclosure advice) go to `exports/<slug>/`. Upload them yourself; nothing is posted automatically.
7. **Change it later.** Open the project again and ask ("swap the music", "Arabic version", "make a 16:9 cut"). Only the affected steps re-run.

Tips for the guide:
- Keep the computer awake and the app open during a render, because local sessions stop if the machine sleeps.
- Use **Plan** mode for a big series ("plan 10 episodes").
- Drag the terminal pane open (**Ctrl+`**) to watch FFmpeg progress.

### 15.5 What the guide must also cover

- **Troubleshooting:**
  - "FFmpeg not found": run `/video doctor`.
  - Arabic captions look broken: fonts missing from `brand/fonts`.
  - Render is slow: lower the resolution for drafts with `--draft` (540p), and use full quality only for the final.
  - Disk is full: `/video clean` removes caches.
- **Costs:** the $0 tier versus paid generation, how the budget cap works, and where spend is logged (`projects/<slug>/spend.json`).
- **Rights and labels:** a one-page summary of section 3.5 and the rules in section 11, in plain words.
- **Arabic quick start:** a separate short page in Arabic.

## Sources (checked 1 November 2026)

- Claude desktop app, Code tab quickstart: https://code.claude.com/docs/en/desktop-quickstart
- Claude Code skills (locations, slash commands, arguments): https://code.claude.com/docs/en/skills
- Using skills in Claude chat (upload a ZIP, code execution): https://support.claude.com/en/articles/12512180-use-skills-in-claude

- HyperFrames (HeyGen), Apache 2.0, README: https://github.com/iflow-mcp/heygen-com-hyperframes (a mirror of heygen-com/hyperframes, `TODO(verify)` the canonical repo)
- Remotion updates, agent skills and licence: https://autoae.online/blog/remotion-updates-2026
- Remotion vs Motion Canvas vs Revideo: https://www.pkgpulse.com/guides/remotion-vs-motion-canvas-vs-revideo-programmatic-video-2026
- AI video models, prices (September 2026): https://www.teamday.ai/blog/best-ai-video-models-2026
- Open-source TTS guide 2026: https://tts.ai/blog/open-source-text-to-speech-guide-2026/
- 3arab-TTS (Arabic and Egyptian): https://huggingface.co/sherif1313/3arab-TTS-500M-v2-VoiceDesign
- Whisper variants compared: https://dev.to/jovan_chan_9500711396d4e6/faster-whisper-vs-whispercpp-vs-whisperx-2026-o29
- LatentSync lip sync: https://sync.so/blog/what-is-latentsync
- Consistent characters in AI video: https://www.neolemon.com/blog/how-to-create-consistent-characters-in-ai-videos-complete-guide/
- Short-form trends 2026: https://fluxnote.io/blog/state-of-short-form-video-2026
- YouTube AI disclosure 2026: https://air.io/en/youtube-hacks/youtube-ai-disclosure-in-2026-label-it-yourself-or-youtube-will
- ACE-Step music model: https://comfyui-wiki.com/en/models/ace-step/ace-step-v1-5
