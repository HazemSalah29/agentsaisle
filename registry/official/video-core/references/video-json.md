# video.json

One file per project, at `projects/<slug>/video.json`. The schema is `assets/video.schema.json`; `check.mjs` enforces it and the per-kind rules in `assets/film/rules.mjs`.

## Fields

- `version`: always `1`.
- `meta`: `title`, `type` (`explainer`, `kinetic` or `showcase`), `format` (reel-9x16, short-9x16: 1080x1920; youtube-16x9: 1920x1080; square-1x1: 1080x1080), `fps` (30 is right for shorts), `lang`, optional `brand` (path to a brand.json, relative to the project).
- `script`: path to `script.md`. Narration lines start with their id in square brackets: `[l1] Text of the line.` A scene's `narration` lists line ids.
- `voice`: `provider` (`kokoro`, `3arab`, `recorded`, `test` or `none`), `voiceId`, `speed` (1.1 is a good short-form pace). Audio files are `voice/<line-id>.wav`.
- `style`: the look and sound. `preset` (`volt` lime, `ember` orange, `ice` cyan, `grape` violet; brand colours override it), `captions` (`pop` default, `karaoke`, `clean`, `none`), `music` (`pulse`, the generated bed, default; `none`), `bpm` (70 to 150, default 104), `sfx` (false turns off the automatic sound effects), `progress` (a thin bar at the top; off by default, because it sits under the platforms' buttons), `grain`.
- `music`: the user's own track instead of the generated bed: `asset` (path, also listed in `assets` with a licence) and `duckUnderVoiceDb` (default -14; the bed uses -21).
- `scenes`: each has `id`, `kind`, `durationFrom` (`voice` by default, or `fixed` with `seconds`), `narration`, `props`, `transitionIn` (`cut`, `fade`, `slide`, `whip`, `zoom-through`, `slash`, `shatter`; default `slide`; the first scene is always a cut). A fixed scene may set `narrationAt` (`{ "l2": 0.1 }`): where in the scene each line starts (the showcase planner writes it).
- `sfx`: extra sound effects of your own (`file`, `at`, `gainDb`), on top of the automatic ones.
- `assets`: each has `id`, `path` (relative, inside the project), `source` (generated, user, download, library), `licence` (required), `attribution`, `aiGenerated`, `realistic`, `voiceClone`.
- `disclosure`: what you declare. `credits.mjs` works the flags out from the assets and fails if you declare less.

## Timing

A voiced scene lasts as long as its lines plus 0.3 s (`timing.mjs --pad`), or its `seconds` if that is longer. Lengths snap to whole frames. A transition overlaps the end of the scene before it, so the voice keeps its frames.

## brand.json

`colors` (`bg`, `fg`, `accent`, `accent2`, `muted`; hex only) and `font` (a plain family name). Fonts in `brand/fonts/` (woff2, woff, ttf, otf) are copied into the render and named by file name. Inter, JetBrains Mono and Anton are built in.
