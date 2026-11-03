# Demo videos

Three shorts made by the library on a laptop CPU with the free tier (Kokoro voice, generated music, no paid service), one per format. Each folder keeps the sources and the `video-qa` contact sheet; the MP4 files are not stored in the repository, so re-run the commands below to make them.

| Demo                        | Format    | What it shows                                                                                                                                                      |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`rate-limit/`](rate-limit) | Explainer | How a rate limiter saves an API, 34 s: a hook title, a kinetic beat, a spotlight list, code with focus, two limiters simulated on the same burst, a slab takeaway. |
| [`ship-it/`](ship-it)       | Kinetic   | "Done beats perfect", 15 s: words hit on the voice, two slabs, a tilted card, slash and shatter cuts.                                                              |
| [`pulseboard/`](pulseboard) | Showcase  | A fictional uptime app (the page is in `app/`), 14 s: a kinetic hook, the scripted recording with a camera following the cursor and callouts, a slab close.        |

## Reproduce

From a studio folder with the skills installed and the engine and Kokoro set up (`/video doctor`):

```
# explainer and kinetic: voice, word times, scene lengths, render
node <video-voice>/scripts/voice.mjs projects/rate-limit
node <video-voice>/scripts/align.mjs projects/rate-limit
node <video-core>/scripts/build.mjs projects/rate-limit --ignore-approval

# kinetic: the plan first
node <video-kinetic>/scripts/plan.mjs --project projects/ship-it --preset ember

# showcase: serve app/ on localhost:4173, record, plan, then voice and render as above
node <video-showcase>/scripts/capture.mjs --url http://localhost:4173 --script demo.md --out projects/pulseboard/capture
node <video-showcase>/scripts/plan.mjs --log capture/interaction-log.json --video capture/capture.webm --out assets/demo.mp4 --into video.json --scene demo --device browser --title "Pulseboard"
```

Word times were estimated (no whisper.cpp on the machine that made them), so captions can sit a few hundredths of a second off the voice.
