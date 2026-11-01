# Runner, engine and known limits

## What may run

Every program starts through `scripts/run.mjs`: only `ffmpeg`, `ffprobe` and `node`, an argument array, no shell, a time limit, and an environment without variables named like KEY, TOKEN, SECRET, PASSWORD or AUTH. `node` may only run an absolute path to a script file (never `-e`). A request for anything else is refused. Add a program only with the owner's approval.

## HyperFrames

`render.mjs` looks for an installed HyperFrames (`--hyperframes <package-dir>`, `node_modules` next to the project, the global install beside this Node, the npx cache) and runs its `check` and `render`. It never installs or downloads it. The tested version is 0.8.226; the install line is `npm install --global hyperframes@0.8.226`. HyperFrames itself may fetch Google Fonts and send usage data (`TODO(verify)` how to switch both off); our scripts make no network calls.

## Animation

No GSAP. Scenes use `assets/lib/tween.js`: paused Web Animations placed at absolute times, plus a small timeline object registered on `window.__timelines["main"]`. HyperFrames seeks each frame itself, so a frame depends only on the clock. `check` passes with this setup but prints a "nested structure" warning per scene (each scene is a `<section>` in `index.html`, not a sub-composition); the warning is expected for now.

## Determinism

Two renders of the same project give byte-identical files (tested). Video is rendered by HyperFrames, then FFmpeg mixes audio and writes the final file with `-bitexact`. `--draft` renders at the lowest quality and scales to 540p.

## Not built yet

Captions, the `custom` kind, transitions other than cut and fade, engines other than HyperFrames, loudness normalisation, and the voice step itself (voice files come from `video-voice` or from the user).
