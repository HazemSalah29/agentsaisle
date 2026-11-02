# Showcase workflow

1. **Write** with `video-write showcase`: problem, "watch this", three features as benefits, proof only if real, call to action. It also writes `demo.md` (this skill's input).
2. **Capture**: `capture.mjs` needs the user's own `playwright-core` in `~/.aisle-video` (doctor shows whether it is there; install line in `docs/video/USER_GUIDE.md`; you never install it). It records `capture/capture.webm` and `capture/interaction-log.json` at 1280x720 by default. Only `localhost` unless `--own-site --rights "<why>"`; requests to other addresses are blocked.
   - No Playwright? Record the screen yourself and write the log by hand or skip the camera: `plan.mjs` needs only the log.
3. **Plan** with `plan.mjs`: cuts waiting over 1.2 s, plays typing 3x faster, writes the camera moves, the smoothed cursor and the click ripples into a `screen` scene, and writes the edited `assets/demo.mp4`. Options: `--device phone|laptop|browser|none`, `--title "..."`, `--max-idle`, `--type-speed`. It prints narration start times for each `say`.
4. **Feature titles** are ordinary `title` or `list` scenes between or around the `screen` scene; one idea per scene.
5. **Beats** (optional): `beats.mjs --audio track --snap` finds the tempo and moves the boundaries of fixed-length scenes (not `screen` scenes, not voice-timed ones) to the nearest beat within 0.2 s. Check the beats by ear; tempo can be wrong on complex music. The music file needs its licence in `assets`.
6. **Check, render, QA, publish** as for any video (`video-core`, `video-qa`, `video-publish`).

Limits to say out loud: the recording is a headless browser, so no native app windows and no real mouse cursor (the cursor is drawn from the log); the camera follows what the log says, not what is on screen; sync between the log and the video can be off by about a tenth of a second (`TODO(verify)`).
