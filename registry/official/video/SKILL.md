---
name: video
description: Make a short, scroll-stopping video from a plain request, rendered with Remotion on your own computer. Three formats done well - a tech explainer ("explain how rate limiting works"), a kinetic-type short (bold words that hit on the voice) and an app showcase (a recorded demo of your own app). Also `/video reel` for a motion-graphics Instagram reel or carousel for your page, made from a checked source. Use whenever the user asks to make a video, short, reel or demo. Don't use to upload a video.
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video

The user says what video they want in their own words; you make the best short the local tools allow. Three formats, each with a tested look, so every video starts from something good instead of a blank page. `<skill>` is the folder that holds this SKILL.md; the parts are its sibling `video-...` skills, which you load yourself. The user never names a part.

## Use when

- The user wants a short video: explain an idea, algorithm, API or tool (explainer); punchy words on a voice, a hot take, a motivational or announcement short (kinetic); or a demo of their own app or site (showcase).
- The user wants a motion-graphics Instagram reel, an animated lesson or a carousel for their page (reel format: `references/reel.md`), or types `/video reel`.
- The user asks what is possible, or why a tool is missing (run `doctor`). `/video init` and `/video doctor` still work as shortcuts.

## Don't use when

- The request is for cartoons, characters, AI-generated footage, footage editing, dubbing or a long video. Say in one sentence that this skill makes three kinds of short (explainer, kinetic, showcase) and the page reels of `/video reel`, and offer the nearest one.
- The user wants a video uploaded. The last step prepares a pack to upload by hand; nothing is ever uploaded.
- The request is for a known character, a real person's likeness, someone else's footage or logo, or a fact you cannot source. Say no in one sentence and offer an original alternative.
- The folder is a code project that should not get video folders. Ask for an empty folder first.

## Steps

1. Read the request and pick the format with `references/choose.md`. Tell the user the plan in at most three short lines: the format, the length (default 30 to 45 s, vertical 9:16), and what you need from them.
2. First use in a folder: `node <skill>/scripts/doctor.mjs --cached`; no studio yet: `node <skill>/scripts/init.mjs`. If the Remotion engine is missing, run `node <video-core>/scripts/engine.mjs setup` and give the user the two lines it prints. Never install anything yourself and never read or ask for an API key.
3. Ask only what the request lacks (topic, audience, the app's address, brand colours). At most three questions, each with a default. If nobody is there to answer, take the defaults and say which.
4. Read `references/craft.md` before writing a word: it is the quality bar every video is held to. Then follow the format's chain: `references/explain.md`, `references/kinetic.md` or `references/showcase.md`. Run `node <skill>/scripts/pipeline.mjs projects/<slug>` between steps to see what is next.
5. Pause for the user only at: the script and storyboard (once, before the voice), the demo script before a browser is driven, and the draft. Nothing else.
6. Draft first (`render.mjs --draft`), then review it as `references/craft.md` says: a contact sheet, the score card, and fixes until every score is 4 or more (at most 3 rounds). Use a separate reviewer agent when you can start one.
7. Render the final, run `video-qa`, and look at its contact sheet. If a check fails, name it and the step that fixes it, then go back.
8. Offer the publish pack (`video-publish`): show the MP4 path, the score card, the QA lines and the credits. Never upload.
9. Be honest about limits: synthetic voices are labelled, estimated word times can drift a little, and no one can promise a video will trend.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run each script once per change. Do not read the other parts' files to describe them; `pipeline.mjs` says what is next.
- Read `references/craft.md` once per video, not once per scene.

## Output

- The plan in three lines, then one line of progress per step.
- At the end: the video's path, its score card, its QA result and where the publish pack is.

## Done when

- The draft scored 4 or more on every line of the score card, the final render passed `video-qa`, and the user has the MP4 path.
- Nothing was installed, downloaded, uploaded or overwritten without the user's yes, and every on-screen claim came from the user or a source in `facts.md`.
