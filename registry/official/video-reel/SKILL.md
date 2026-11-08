---
name: video-reel
description: "Part of the video library (loaded by /video reel, not run directly): makes a motion-graphics Instagram reel (1080x1920 MP4, sound effects over a calm bed, optional voiceover) for the user's page from a checked source, by running five step skills in order (topic, story, style, storyboard, build) with the user's yes at each stop. Also carousels, made-up stories (parables), idea boards and caption help. Use when the user asks for a reel, a motion-graphics video, an animated lesson or a carousel for their page. Don't use for screen recordings, AI video or uploading."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *) Bash(python3 *) Bash(bash *)
---

# Reel

Makes a reel for the user's page from a checked source: five steps, each ending at a stop where the user says yes, because building before agreeing wasted whole renders. The story, the look and the motion are new for every reel; every move, style or screen in this skill is a toolbox, never a limit. `<video-reel>` is the folder that holds this SKILL.md; the steps are its sibling `video-reel-*` skills, and the sounds come from the packs `video-reel-sounds` and `video-reel-sfx-1` to `-4`.

## Use when

- The user wants a reel or a motion-graphics video for their page, a carousel (`video-reel-carousel`), made-up stories that teach a lesson (`video-reel-parable`), ideas for the week, a caption, or a review of how a post did.
- The user says "start", "set up my page" or "what should I do today". Read `references/cmd-<name>.md` for the command that fits (start, today, ideas, save, reel, carousel, review) and follow it.

## Don't use when

- The user wants an explainer, a kinetic-type short or an app showcase: those are the other `/video` formats.
- The user wants AI video, AI images, a real person's likeness, a drawn prophet (Islamic pages) or someone else's footage or logo. Say no in one sentence and offer an original alternative.
- The user wants a video uploaded. Nothing is ever uploaded; the last step gives the file and a caption.

## Steps

1. First use in a folder: `node <video-reel>/scripts/studio.mjs doctor`. It prints what is missing (ffmpeg, Chrome, Node, Python packages, Playwright); give the user those lines. Never install anything yourself. Then `node <video-reel>/scripts/studio.mjs init` makes the studio folder (notes, boards, `03 - export`) without overwriting a file.
2. Read `00 - notes/context/declared/brand.md`. If `page_name` is empty, run the brand interview: `references/cmd-start.md`. Then read `00 - notes/context/observed/taste.md`, `index.md` and the last lines of `log.md`.
3. Read `references/chain.md` once: the chain, the question round, bulk prep, the rules that are fixed for every reel and the brand constants.
4. Ask the question round once (source, mood, look, length, voiceover), then invoke `video-reel-topic`, `video-reel-story`, `video-reel-style`, `video-reel-storyboard` and `video-reel-build` with the Skill tool, each only after the user's yes on the one before.
5. After the render, ask what worked and save one lesson to `taste.md` (30 at most). Write the caption (`references/agent-caption-helper.md`). To redo one step, read `status:` in the reel's `script.md`, run that step and every later one.

## Budget

- Read `references/chain.md` once per reel and only the `rules.md` sections for the current step.
- The style recipes are many: open `references/style-index.md`, then at most the two recipes in play.
- Run each script once per change. Do not open `assets/` pages or the SFX Kit files to describe them; `references/sound.md` says how to pick a sound.

## Output

- A progress checklist in each reply, then one stop per step.
- At the end: the MP4 path in `03 - export/<date>-<slug>/`, the poster, the check reports, and the caption with hashtags.

## Done when

- The user said yes at every stop and has the final MP4 and caption; the render passed the loudness, flash, sync and readability checks.
- Every number and quote on screen traces to a source the reel's `script.md` records, and nothing was installed, uploaded or overwritten without the user's yes.
