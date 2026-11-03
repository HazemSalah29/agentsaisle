# The showcase chain

The user's real app, recorded from a script, with the camera following the action and a callout naming each benefit.

1. Write `script.md` (`video-write` showcase rules in `references/craft.md`): a hook line (the problem, not the product), one line per feature as a benefit, and a close. 4 to 6 lines, 20 to 40 seconds.
2. Write `demo.md` for `video-showcase` (`go`, `say <line-id>`, `click`, `type`, `hover`, `scroll`, `wait`): a `say` before each feature's actions, so its line starts where its action happens. Show it to the user and wait: it drives a browser on their app.
3. `node <video-showcase>/scripts/capture.mjs --url <local app> --script demo.md --out projects/<slug>/capture` (or their own screen recording: see `video-showcase`).
4. Start `video.json` with the hook as a `kinetic` scene, then `node <video-showcase>/scripts/plan.mjs ... --into video.json --scene demo --device browser --title "<product>"`. It writes the `screen` scene with its narration times. Add `callouts` to it: one per feature, 2 to 4 words, at the time its line starts. Close with a `kinetic` slab (`bg: accent`) with the product name and its promise.
5. `video-voice`, `timing.mjs`, `render.mjs --draft`, the score card, the final, `video-qa`, `video-publish`.

On a vertical video a wide recording sits in a taller window and the camera follows the cursor, so the interface stays readable; zooms from the plan still apply. Use `--device phone` for a mobile site recorded at a phone size.
