# Nour learns to share (kids demo)

A 31-second 1080x1920 cartoon for ages 3 to 5, made with `/video kids`: [`kids.mp4`](kids.mp4). Two original characters, [Nour the turtle](characters/nour/bible.md) and [Pip the rabbit](characters/pip/bible.md), act in three `puppet` scenes on the library's own backdrops. They use the shaded, rounded look (gradients, gloss, glossy eyes, a soft floor shadow): an illustration style, not a 3D model.

**Checked:** `video-qa` passes every check on the final render, including the kids' checks (pace at most 1.9 words a second, captions 6.5% of the height, flashing, contrast, margins, a bible per character). Report and contact sheet are in [`qa/`](qa). Word times come from whisper.cpp, so captions and mouths follow the voice. Rendered with HyperFrames 0.8.226 (the pinned version).

**The voices are not real children.** Kokoro has only adult voices, so each character's lines are pitch-shifted with the formants shifted along (Nour +4, Pip +6 semitones, set by `Voice pitch` in each bible). That sounds younger and different from each other, but it is an adult voice made to sound younger. A real child's voice would need a model or provider we do not have, and cloning a child's voice is something this library will not do. The credits say the voice is computer-generated.

Open [`characters/nour/sheet.svg`](characters/nour/sheet.svg) and [`characters/pip/sheet.svg`](characters/pip/sheet.svg) in a browser to see each character with every mouth shape. Pip's cap was added by hand to `puppet.json` after `scaffold`, to show that the rig is plain data. [`draft-frames.png`](draft-frames.png) shows five frames of the final video.

Reproduce, from a studio folder with the video skills installed (`/video doctor` first):

```
node <video-kids>/scripts/bible-check.mjs projects/kids
node <video-kids>/scripts/puppet.mjs scaffold projects/kids --character nour
node <video-write>/scripts/write-check.mjs projects/kids
node <video-write>/scripts/storyboard.mjs projects/kids
node <video-voice>/scripts/voice.mjs projects/kids --provider kokoro --speed 0.65
node <video-kids>/scripts/kidvoice.mjs projects/kids
node <video-voice>/scripts/align.mjs projects/kids
node <video-kids>/scripts/visemes.mjs projects/kids
node <video-core>/scripts/timing.mjs projects/kids
node <video-captions>/scripts/captions.mjs projects/kids --burn
node <video-core>/scripts/render.mjs projects/kids
node <video-qa>/scripts/qa.mjs projects/kids
```

The voice files (`voice/*.wav`) are not kept in git; `voice.mjs` makes them again.
