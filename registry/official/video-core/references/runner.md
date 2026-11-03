# Runner, engine and known limits

## What may run

Every program starts through `scripts/run.mjs`: only `ffmpeg`, `ffprobe`, `node`, `python` (our own provider scripts) and `whisper-cli`, with an argument array, no shell, a time limit, and an environment without variables named like KEY, TOKEN, SECRET, PASSWORD or AUTH. `node` may only run an absolute path to a script file (never `-e`). Add a program only with the owner's approval.

## The Remotion engine

The engine is an npm project installed once by the user, by default in `~/.aisle-video/remotion` (or the folder named by `"remotion"` in `~/.aisle-video/tools.json`). `engine.mjs setup` writes its pinned `package.json` (from `assets/remotion/package.json`); the user runs `npm install` and `npx remotion@4.0.540 browser ensure` there. Before every render, `render.mjs` copies this skill's `assets/remotion/src` into the engine, so updating the skill updates the look without reinstalling.

`render.mjs` writes `out/rm/props.json` (the film) and `out/rm/public/` (media and fonts), runs `remotion render` with `--props`, `--public-dir` and `--muted`, then mixes the audio with ffmpeg. If `~/.aisle-video/tools.json` has `"browser"` (an absolute path to Chrome or Chromium), it is passed as `--browser-executable`.

Remotion's licence: free for individuals and companies of up to 3 people; larger companies need a company licence (remotion.dev/license). Render prints this note every time.

## Animation

Everything is a function of the frame: springs and eased curves from Remotion (`spring`, `interpolate`), smooth noise from `@remotion/noise`, paths from `@remotion/paths`. No GSAP, no CSS animations or transitions (they would not be frame-exact). Fonts (Inter, JetBrains Mono, Anton, all SIL OFL) come from npm and are bundled, so nothing is fetched while rendering.

## Sound

`assets/film/sound.mjs` synthesises the effects (whoosh, pop, impact, ...) and the music bed from maths: original, so there is no licence to track. The mix ducks the music under the voice and brings the whole to -14 LUFS.

## Not built

Engines other than Remotion, the `custom` kind, AI-generated footage, character animation and editing of the user's own footage.
