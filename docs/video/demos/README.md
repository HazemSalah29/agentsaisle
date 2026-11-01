# Demo videos for the explainer vertical (library 0.1.0)

Two short vertical explainers made by the library itself, with every file kept so anyone can look inside and re-run them. Each folder holds the final 1080x1920 MP4 (checked with `video-qa`) next to its sources.

| Demo                            | What it shows                                                                                                                                                                | Built from                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`rate-limit/`](rate-limit)     | Ten requests get through a limit of five: a token bucket on random traffic, the bucket in code, a fixed window against a sliding window on the same burst. About 53 seconds. | `rate-limit` scenes drawn from the real simulator (seeds 42 and 1), a `code` scene, a Kokoro voice.                                                                                                  |
| [`request-flow/`](request-flow) | What `aisle add` does, one step per line of Agent Aisle's own source. About 44 seconds.                                                                                      | A `request-flow` scene imported from [`docs/architecture.json`](request-flow/docs/architecture.json), a model of the install path written for this demo and validated by `arch-visualize`'s checker. |

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
