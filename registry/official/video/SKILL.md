---
name: video
description: Make any video from a plain request, such as "a showcase video for my brand", "explain how rate limits work", "cut this footage from a URL into a 30 second short" or "turn my README into a video". Chooses the format, picks the right parts of the video library itself and runs them. Use whenever the user asks to make, edit, caption, dub or publish a video. Don't use to upload a finished video.
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video

One command: the user says what video they want, in their own words, and you make the best one the local tools allow. They never name a part of the library: you read the request, pick a recipe in `references/choose.md`, and load the matching video skills (`video-write`, `video-voice`, `video-ingest`, `video-edit`, ...) yourself. `<skill>` is the folder that holds this SKILL.md; the parts are its sibling `video-...` skills.

## Use when

- The user asks for any video: an explainer, a story, a showcase or demo of their app or brand, a tour of a repository, a PR or release video, an outage replay, a chart video from data, Arabic lettering, a video from a document, one video per row of a CSV.
- The user brings footage (a file, or a link they have the right to use) to cut, caption, reframe, dub or publish.
- The user asks what is possible, or why a render tool is missing (run `doctor`).
- `/video init` and `/video doctor` still work as shortcuts for the studio folder and the machine check.

## Don't use when

- The request is for an animated cartoon, a kids' show or a character made from a child's drawing. This library does not make character animation: say so in one sentence and offer an explainer, a kinetic-type video, a story short from stills or a brand video instead.
- The user wants a video uploaded. The last step prepares a pack to upload by hand; nothing is ever uploaded.
- The folder is a code project that should not get video folders. Ask for an empty folder first.
- The request is for a known character, a real person's likeness, or footage the user has no right to use. Say no in one sentence and offer an original alternative.

## Steps

1. Read the request. Pick the recipe in `references/choose.md` and tell the user the plan in at most three short lines: what you will make, the length and format, and what you will need from them. Never ask them to name a skill or type a command.
2. First use in a folder: run `node <skill>/scripts/doctor.mjs --cached` (one line when it was checked today); if there is no studio folder yet, run `node <skill>/scripts/init.mjs` (it never overwrites). Report only what is missing and its install line; never install anything yourself, and never read, print or ask for an API key.
3. Ask only for what the request lacks and the recipe needs (the topic, the audience or age, the language, a brand or colours, the footage or link, the app to show). At most three questions, in plain words, with a sensible default offered for each. Defaults: vertical 9:16, 30 to 60 seconds, English, `$0` budget (local tools, no paid service).
4. Make `projects/<slug>/` (lowercase, hyphens) and follow the recipe by loading the parts it names, or reading the `references/<recipe>.md` it names (document, repo tour, PR, outage, session, CSV batch and interactive recipes live there, with their scripts in this skill's `scripts/`). The explainer and story chains are in `references/explain.md` and `story.md`; a request for the Higgsfield look or the Higgsfield connector is `references/higgsfield.md` (a paid connector the user adds themselves: credits are never promised free, and each generation needs the user's yes); run `node <skill>/scripts/pipeline.mjs projects/<slug>` before and after each step of those.
5. Pause only where the user must decide: the storyboard, a character sheet, a quote for any paid call (`video-generate` prints the total and needs the user's typed approval of that exact number), and the rights basis for footage (`video-ingest` asks for it itself; never suggest one). Do not pause for anything else.
6. Never skip QA (`video-qa`). If it fails, name the failing check and the step that fixes it, then go back. Look at the contact sheet before saying a video is good.
7. When QA passes, offer the publish pack (`video-publish`), show the MP4 path, the contact sheet, the QA lines and the credits, and tell the user to read each `disclosure.md`. Stop; never upload.
8. Be honest about limits: no first-try guarantees, synthetic voices are labelled, translations are drafts, and if no recipe fits, say what the nearest one can and cannot do instead of improvising a pipeline.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run each script once. Do not read the other parts' files to describe them; `pipeline.mjs` says what is next.

## Output

- The plan in three lines, then after each step the pipeline table or one line of progress.
- At the end: the video's path, its QA result, where the publish pack is.

## Done when

- The pipeline shows every step done and QA passed, or a recipe's own end state is reached (a project folder, an exported page, a character).
- Nothing was installed, downloaded, uploaded or overwritten without the user's yes, and every gate above was respected.
