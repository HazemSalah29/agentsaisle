---
name: video-publish
description: "Part of the video library (loaded by /video, not run directly): a per-platform publish pack for a checked video; never uploads and refuses a video that failed QA."
user-invocable: false
allowed-tools: Read Write Glob Bash(node *)
---

# Video publish

Turns a finished render into something ready to post. It prepares files and checks text; it never uploads, logs in or contacts a platform. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- A project has a final render in `out/`, a passing `video-qa` report and `credits.json`, and the user wants it ready for one or more platforms.
- A checked video is ready to prepare for `--platforms youtube,shorts,reels,tiktok,linkedin`.

## Don't use when

- The render is missing or QA has not passed. Name the step to run; do not work around the gate. The user may override a failed QA in words with a reason; use `--override-qa "<reason>"`, never decide for them.
- The user wants the video uploaded. Say this skill cannot, and the pack is for uploading by hand.
- The video is the wrong shape for the platform (a 16:9 video for Reels). Say so; `video-edit reframe` is the fix.

## Steps

1. Read `brief.json`, `script.md` and `facts.md` (once). Write `publish/copy.json` with `title`, `description` and `hashtags` (`references/copy.md`). Use only words and numbers from the script and facts.
2. Run `node <skill>/scripts/publish.mjs <project> --platforms <list>` (add `--no-card` to skip the designed thumbnail). It checks the QA gate, the shape and length per platform and your text, and writes nothing if anything fails.
3. If it printed `REFUSED` lines, fix each (the text, the shape, a missing QA or credits) and run it again. Do not edit `platforms.json` to make a limit pass.
4. Show the pack: platforms, files, the kids answer, and any note. Read `exports/<platform>/disclosure.md` and tell the user which questions they must answer on the platform.
5. Remind the user to upload by hand and that platform rules change (`references/platforms.md`).

## Budget

<!-- include: _shared/read-budget.md -->

- Run the script once per set of changes. Do not open the encoded video or thumbnails to check them; the manifest has hashes and sizes.

## Output

- The platforms written, the number of files each, and the kids answer (yes, no or ask).
- Every note the script printed (a skipped card, no chapters) and the override, if one was used.
- That nothing was uploaded.

## Done when

- The script exited 0, `exports/publish.json` exists with `"uploaded": false`, and the user was told what to answer on each platform.
- No figure in the text came from anywhere but the script or facts, and nothing was sent anywhere.
