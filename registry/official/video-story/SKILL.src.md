---
name: video-story
description: "Part of the video library (loaded by /video, not run directly): turn a story premise into shots, reference packs and continuity for a cinematic short."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video story

Plans and assembles a story from stills (and optionally clips). The agent writes the files; scripts judge them. Images and clips come from `video-generate` (paid) or from the user. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- The user gives a premise and wants a story short.

## Don't use when

- The video explains something technical (`video-explain`) or is a kids' puppet show (`video-kids`).
- The premise names a known character, brand or real person. Refuse and offer an original one. The guard in `ip-guard.mjs` catches common names; refuse lookalikes by judgement too.
- The user wants a guaranteed result. Say plainly that AI images and clips can miss, and that this flow keeps retries to a minimum.

## Steps

1. Run `video-write` story mode first: `script.md`, `style-bible.md` (world, palette, characters), a storyboard. Default generator is `stills-only` ($0 for motion).
2. Write `refpack.json` (`style` and each character's `look` from the bible), then `node <skill>/scripts/refpack.mjs <project>`. Make the front view of each character first with `video-generate image`, show it to the user, and only then the other views. One character per image.
3. Write `shots.json` (`references/shots.md`): 3 to 8 seconds per shot, camera, action, mood, prompt, the script lines it covers. Run `node <skill>/scripts/shots.mjs <project> --plan` and show the counts. Credits come only from what the Higgsfield connector reports.
4. Write `continuity.json`; run `node <skill>/scripts/continuity.mjs <project>`. For each shot, `--next <shot-id>` prints the `--ref` images to pass to `video-generate` (the anchor and the characters' front views).
5. Make one keyframe still per shot with `video-generate`, ask before every paid call, then (non-stills generators only) one clip per shot from its keyframe with a prompt that describes only the motion. Do not regenerate unless the user asks.
6. Set each shot's `asset`, run `shots.mjs <project> --build`, then narration, music and captions through the usual video skills and `video-qa`. Stills get a slow push-in (Ken Burns) from the `broll` scene.

## Budget

<!-- include: _shared/read-budget.md -->

- One generation per shot. Never retry without the user's say; show a failed shot and ask.
- Do not open image files to inspect them unless the user asks; judge by the scripts' output.

## Output

- The plan (shots, seconds, images, clips), the credits the connector reported, and what is still missing.
- A note that every generated asset is marked `aiGenerated`, and that realistic people or places need the synthetic-content label.

## Done when

- `shots.mjs` and `continuity.mjs` exit 0, `video.json` holds the scenes and passes `video-core` check.
- No paid call ran without the user approving its exact total; no known character, brand or real person's likeness was used.
