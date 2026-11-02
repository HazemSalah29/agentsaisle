# Demo videos for the explainer vertical (library 0.1.0)

Two short vertical explainers made by the library itself, with every file kept so anyone can look inside and re-run them. Each folder holds the final 1080x1920 MP4 (checked with `video-qa`) next to its sources.

| Demo                            | What it shows                                                                                                                                                                | Built from                                                                                                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`rate-limit/`](rate-limit)     | Ten requests get through a limit of five: a token bucket on random traffic, the bucket in code, a fixed window against a sliding window on the same burst. About 53 seconds. | `rate-limit` scenes drawn from the real simulator (seeds 42 and 1), a `code` scene, a Kokoro voice.                                                                                                            |
| [`request-flow/`](request-flow) | What `aisle add` does, one step per line of Agent Aisle's own source. About 44 seconds.                                                                                      | A `request-flow` scene imported from [`docs/architecture.json`](request-flow/docs/architecture.json), a model of the install path written for this demo and validated by `arch-visualize`'s checker.           |
| [`kids/`](kids)                 | A kids' cartoon: Nour the turtle learns to share a leaf with Pip the rabbit. About 31 seconds, ages 3 to 5.                                                                  | Two original puppet characters (bibles and rigs drawn by `video-kids`), three `puppet` scenes, a Kokoro voice at 0.65 speed, kids' captions. Draft frames only so far: see [`kids/README.md`](kids/README.md). |

## What is in each folder

`brief.json`, `script.md` (one line per sentence, with its beat and fact ids), `facts.md` (a source for every claim), `hooks.md`, `storyboard.md`, `video.json` (the whole video as data), `captions.srt` / `captions.vtt`, `credits.json` / `CREDITS.txt` (voice engine, licence, disclosure advice) and `qa/` (the check's report and a contact sheet).

## Reproduce

From a studio folder (`/video init`) with the video skills installed, and ffmpeg and HyperFrames set up (`/video doctor`):

```
node <video-write>/scripts/storyboard.mjs projects/rate-limit      # video.json from the storyboard
node <video-explain>/scripts/simulate.mjs --seed 42 --count 60 --pattern poisson --rate 6 --algo token-bucket --capacity 5 --refill 3 --title "A token bucket, simulated" --into projects/rate-limit/video.json --scene s3
node <video-explain>/scripts/simulate.mjs --seed 1 --count 15 --pattern burst --burst-size 5 --burst-every 0.2 --burst-offset 0.9 --rate 1 --algo fixed-window --limit 5 --window 1 --algo2 sliding-window --limit2 5 --window2 1 --title "Same traffic, two windows" --into projects/rate-limit/video.json --scene s5
node <video-voice>/scripts/voice.mjs projects/rate-limit --provider kokoro
node <video-voice>/scripts/align.mjs projects/rate-limit
node <video-core>/scripts/timing.mjs projects/rate-limit
node <video-captions>/scripts/captions.mjs projects/rate-limit --style karaoke --burn
node <video-core>/scripts/render.mjs projects/rate-limit
node <video-qa>/scripts/qa.mjs projects/rate-limit
```

For the request flow, replace the two `simulate.mjs` lines with `node <video-explain>/scripts/arch-import.mjs --model docs/architecture.json --flow aisle-add --into projects/request-flow/video.json --scene s2`.

## Honest limits

- The numbers on screen come from `simulate.mjs` (seeded): a token bucket of 5 refilling 3 a second let 29 of 60 requests through (seed 42); a fixed window of 5 a second let 10 of 15 through where a sliding window let 5 (seed 1). They are results of a simulation on that traffic, not a claim about every workload.
- The code on the `rate-limit` demo's code scene is the token-bucket step of the simulator, simplified, and says so on screen.
- The request-flow model covers only the install path (5 components, 4 connections); `arch-visualize`'s automatic discovery found 86 components in this repository, mostly test fixtures and skill folders, so the model was scoped by hand. Each line number was checked against the source when it was written. It shows what the code says, not live traffic.
- The voice is a computer-generated English voice (Kokoro, Apache 2.0). Loudness, margins and caption sizes were checked with `video-qa` using working defaults that are not confirmed platform rules.

## Editing, publishing and analyzing the rate-limit demo (video library, M4)

Run on `rate-limit/rate-limit.mp4` with the real tools on one machine (Apple Silicon, ffmpeg 9.0.2, whisper.cpp base model). These are measurements of that run, not promises for other footage.

| Command                                                         | Result                                                                                                                                                                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cut` (dry run, whisper words trimmed to the sound)             | 52.7 s to 41.55 s: 16 pauses, no fillers (the voice is synthetic). `--apply` wrote a 41.64 s file, within 0.1 s of the plan, in about 4 s.                                                                                  |
| `audio` on the cut file                                         | -14.3 LUFS integrated, the file's length unchanged (target -14, +-1).                                                                                                                                                       |
| `gif` (12 s to 17 s, width 320)                                 | 5 s, 320x569, 235 KB.                                                                                                                                                                                                       |
| `scenes`                                                        | 0 cuts. The demo changes scene with fades on a dark background, and the detector looks at brightness, so it misses them; an honest limit of `scenes`, not a property of the video.                                          |
| `analyze --rights own`                                          | moving 0.37, sound 0.76, speech 0.75; palette #101215 (79%), #222325, #36383a; tempo guess 158 BPM at confidence 0.27 (a heuristic on narration, meaningless here). See [`rate-limit/recipe.json`](rate-limit/recipe.json). |
| `publish --platforms shorts,reels,tiktok,linkedin` (both demos) | Four packs each, 10 files per platform including a designed thumbnail card; about 30 s per demo. The MP4 in each pack is re-encoded (about 3 MB for rate-limit, 2.4 MB for request-flow).                                   |

What is committed from the packs: [`rate-limit/exports/`](rate-limit/exports) and [`request-flow/exports/`](request-flow/exports) hold `publish.json` (sizes and SHA-256 of every file, including the videos) and, for Shorts, the checked `copy.json`, `disclosure.md`, the four thumbnails, captions and credits. The re-encoded videos are not committed (they would repeat the demo MP4); run `publish` again to regenerate them. The text in `publish/copy.json` was checked by the tool: every number in it appears in the script or facts.

Platform limits used by `publish` are unverified (see `video-publish/assets/platforms.json`).
