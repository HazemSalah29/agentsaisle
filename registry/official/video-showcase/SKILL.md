---
name: video-showcase
description: Make a product showcase video from the user's own app, which means playing a demo script in a headless browser to record the screen and an interaction log, then cutting waiting, speeding up typing, easing the camera to each click, drawing a smooth cursor and click ripples inside an original device frame, and snapping scene cuts to the music's beats. Use when the user wants an app demo or showcase video or runs /video-showcase. Don't use for apps or sites the user does not own, for native desktop apps, for explainers, or to copy another product's footage or branding.
disable-model-invocation: true
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video showcase

Turns a demo script into a polished screen demo. The recording, cursor path, camera and ripples all come from one interaction log, so the film shows what really happened. `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user has an app running on their machine (or their own deployed site) and wants a demo video of it.
- The user runs `/video-showcase` or `/video showcase`, or has a screen recording and wants zooms, a cursor, a device frame or beat-timed cuts.

## Don't use when

- The app or site is not theirs. `capture.mjs` records localhost, or an own site with a stated reason; do not work around that.
- The demo needs a native desktop app, a real mouse cursor or sound from the app. Say it cannot.
- The user wants an explainer, kids or story video, or another product's look, footage or logo. Offer original work.
- The page needs a real password, card or key typed. Use dummy data on a normal field.

## Steps

1. `node <skill>/scripts/status.mjs <project>` shows what exists and what is next.
2. Get or write `demo.md` (`references/demo-script.md`). Show it to the user and wait for approval: it drives a browser on their app.
3. `node <skill>/scripts/capture.mjs --url <app> --script demo.md --out <project>/capture`. If it says the library is missing, give the user its install line and stop; never install it. A failed step names the line to fix.
4. `node <skill>/scripts/plan.mjs --log capture/interaction-log.json --video capture/capture.webm --out assets/demo.mp4 --into video.json --scene demo --device laptop` (`--device phone` for 9:16). Quote the narration starts it prints.
5. Add title or list scenes for the features, then, if the user has a licensed track, `node <skill>/scripts/beats.mjs --audio <track> --out beats.json --into video.json --snap` (`references/workflow.md`).
6. `node <video-core>/scripts/check.mjs <project>`, then `render.mjs --draft`; look at one frame per scene before the final render.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run each script once per change. Do not read `interaction-log.json` or the scene props by hand; `plan.mjs` summarises them.

## Output

- The status table, the demo script as approved, and each script's printed summary.
- The film's length, camera moves, clicks and, for beats, the tempo and how many scene lengths moved.

## Done when

- `capture.mjs` and `plan.mjs` ran, `check.mjs` exits 0 and a draft frame of the `screen` scene was looked at.
- Nothing was installed or fetched, no other site was recorded, and any proof number or quote in the film is in `facts.md`.
