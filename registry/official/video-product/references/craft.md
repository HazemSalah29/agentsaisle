# Craft: what the presets encode and how to judge a render

## The presets (`assets/presets.json`)

| Preset   | For                            | Hook / call to action | Shot length  | Moves and ease                                 | Look                                              | Sound                                                              |
| -------- | ------------------------------ | --------------------- | ------------ | ---------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| `snap`   | a launch, a drop, an ad        | 1.0 s / 2.0 s         | 0.9 to 1.5 s | push, whip, pan, pull; `snap` ease; speed ramp | punch grade, grain, vignette, flash cuts          | whoosh on cuts, impact on the hook and flashes, riser into the end |
| `glide`  | a premium or lifestyle product | 1.6 s / 2.4 s         | 2.0 to 3.2 s | slow pans, push, tilt; `inOut` ease            | warm grade, grain, vignette, no flashes           | a quiet whoosh and swell                                           |
| `glitch` | tech, street, a hard sell      | 0.9 s / 1.8 s         | 0.7 to 1.2 s | hold, small push or pull; `expo` ease          | mono grade, grain, RGB-ghost glitches on the beat | glitch bursts, impact on flashes                                   |

With music, cuts snap to its beats (`snapTolerance` per preset); with only a tempo they snap to a steady grid. With a reference recipe, the average shot length and hook length are taken from its numbers (clamped to the preset's range). The recipe is numbers only: nothing of the reference is copied.

## Rules the presets follow

- **Hook in the first second.** The product and its name are on screen before 1.0 s, with a move already in progress.
- **A visual change every 0.4 to 1.2 s** in `snap` and `glitch` (a cut, a move reaching its end, a word, a flash); every 2 to 3 s in `glide`.
- **One idea at a time.** One line of type per shot; at most 3 text items in a shot.
- **Ease, never linear**, except the grain. Moves end softly (`inOut`) or sharply (`snap`, `expo`) on purpose, not by accident.
- **Cuts on beats.** Hits (impact, flash) land on a beat or on a word; never two hits within 0.45 s.
- **Flashes are rare and apart.** At least 0.45 s between flashes in the whole film (the check refuses more than 3 a second).
- **Type stays inside the safe area** (7% sides; the lower fifth is left for captions). Short words, uppercase for slam and glitch. Never text over a face.
- **Sound is quiet but present:** original effects at -4 to -15 dB under the music; the final mix is normalised to -14 LUFS.
- **End on the offer:** the last shot repeats the hero photo with the price and the call to action, nothing else.

## Checklist for the contact sheet (fail one, fix it, re-render; at most 2 times)

1. Is the product recognisable in the first thumbnail (about 1 s)? If not, make the hook a `push` with a larger `to`, or use the cleaner photo first.
2. Is any thumbnail black, empty or a blur of nothing? A whip or zoom entrance should always show a part of the photo.
3. Does the cutout have a ragged edge, a halo or missing parts? Look at `preview.png`; if yes use a plain-background photo or give a cutout PNG.
4. Is text readable (high contrast, not over the busiest part of the photo) and fully inside the frame? Move it to `top` or `bottom`.
5. Do neighbouring shots repeat the same move or the same photo twice in a row? Change the `move` or the photo.
6. Is the end card the offer (price, call to action) and readable for at least 1.5 s?
7. Does `video-qa` pass with no flashing or margin failure? Warnings about pace are expected for `glide`.

If a render looks "templated", change one thing at a time: the preset, the photo order, the grade (`punch`, `warm`, `cool`, `mono`, `film`), or the line of type; do not stack new effects.

## Fields you may edit in `video.json` (scene kind `shot`; see `video-core/references/scene-kinds.md`)

`camera` (`move`, `from`, `to`, `ease`, `ramp: [start, end, speed]`), `type` (`text`, `at`, `style`, `anchor`, `size`), `cards`, `fx` (`grade`, `grain`, `vignette`, `glitch`, `flash`, `shake` times in seconds), `enter` (`style`, `dur`), and the top-level `sfx` (`file`, `at`, `gainDb`).
