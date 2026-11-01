# video.json

One file per project, at `projects/<slug>/video.json`. The schema is `assets/video.schema.json`; `check.mjs` enforces it.

## Fields

- `version`: always `1`.
- `meta`: `title`, `type` (explainer, kids, story, showcase, edit, custom), `format` (reel-9x16, short-9x16: 1080x1920; youtube-16x9: 1920x1080; square-1x1: 1080x1080), `fps` (24, 25, 30, 60), `lang` (`en`, `ar`, ...), optional `dir` (`rtl` is assumed for ar, he, fa, ur), `audience`, `brand` (path to a brand.json, relative to the project, for example `../../brand/brand.json`).
- `script`: path to `script.md`. Narration lines start with their id in square brackets: `[l1] Text of the line.` A scene's `narration` lists line ids.
- `voice`: `provider` (kokoro, chatterbox, 3arab, elevenlabs or none), `voiceId`, `speed`. Audio files are `voice/<line-id>.wav`.
- `music`: `asset` (path, also listed in `assets` with a licence) and `duckUnderVoiceDb` (music level in dB, default -14; it is also pushed down while the voice speaks).
- `scenes`: each has `id` (lowercase letters, digits, hyphen), `kind`, `durationFrom` (`voice` by default, or `fixed` with `seconds`), `narration`, `props`, `transitionIn` (`cut` and `fade` are built; the others render as a cut and render says so), `captions`.
- `assets`: each has `id`, `path` (relative, inside the project), `source` (generated, user, download, library), `licence` (required), `attribution`, `aiGenerated`, and for disclosure `kind`, `realistic` (a photoreal AI image or clip) and `voiceClone`.
- `disclosure`: what you declare. `credits.mjs` works the flags out from the assets and fails if you declare less.

## Timing

A voiced scene lasts as long as its lines plus 0.3 s of air (`timing.mjs --pad`), or its `seconds` if that is longer. Lengths snap to whole frames, so two runs cut on the same frame.

## brand.json

`colors` (`bg`, `fg`, `accent`, `muted`; hex only) and `font` (a plain family name). Fonts in `brand/fonts/` (woff2, woff, ttf, otf) are copied into the render and named by file name, which is how Arabic or other scripts get glyphs. Bad values are ignored, not applied.
