# Nour learns to share (kids demo, draft)

A 31-second cartoon for ages 3 to 5, made with `/video kids`. Two original characters, [Nour the turtle](characters/nour/bible.md) and [Pip the rabbit](characters/pip/bible.md), act in three `puppet` scenes with the library's own backdrops. The voice is Kokoro at 0.65 speed (the same voice for both characters).

**Status: no MP4 yet.** This machine has no ffmpeg or HyperFrames, so the final render and the QA run are still to do. What was checked here:

- `write-check.mjs`, `check.mjs` and `timing.mjs` pass; `credits.mjs` wrote the credits (computer voice, "made for kids").
- The kids' QA text checks pass (`kids-pace` at most 1.9 words a second, sentences, no pressure, language, scene length, 6.5% captions, bibles). The picture checks (flashing, contrast, margins) need the render.
- [`draft-frames.png`](draft-frames.png) shows seven frames from the real scene code, drawn in a browser at the right time. They are not the render engine's frames.
- Word times are estimated (whisper.cpp needs ffmpeg to read the audio), so captions and mouths may drift a little; the mouths close where the recording is quiet.

Open [`characters/nour/sheet.svg`](characters/nour/sheet.svg) and [`characters/pip/sheet.svg`](characters/pip/sheet.svg) in a browser to see each character with every mouth shape. Pip's cap was added by hand to `puppet.json` after `scaffold`, to show that the rig is plain data.

Reproduce, from a studio folder with the video skills installed (`/video doctor` first):

```
node <video-kids>/scripts/bible-check.mjs projects/kids
node <video-kids>/scripts/puppet.mjs scaffold projects/kids --character nour
node <video-write>/scripts/write-check.mjs projects/kids
node <video-write>/scripts/storyboard.mjs projects/kids
node <video-voice>/scripts/voice.mjs projects/kids --provider kokoro --speed 0.65
node <video-voice>/scripts/align.mjs projects/kids
node <video-kids>/scripts/visemes.mjs projects/kids
node <video-core>/scripts/timing.mjs projects/kids
node <video-captions>/scripts/captions.mjs projects/kids --burn
node <video-core>/scripts/render.mjs projects/kids
node <video-qa>/scripts/qa.mjs projects/kids
```

The voice files (`voice/*.wav`) are not kept in git; `voice.mjs` makes them again.
