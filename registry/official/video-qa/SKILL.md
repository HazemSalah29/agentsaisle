---
name: video-qa
description: "Part of the video library, used by the video skill (not run directly). Check a rendered video against its project: format, loudness, clipping, black or frozen stretches, nothing moving for too long, moves too fast to follow, one-frame swaps between scenes, very short scenes, flashing, text in the margins, caption size, missing voice lines, licences, placeholders; makes a contact sheet. Use before anything ships. Don't use to fix the video or judge taste."
user-invocable: false
allowed-tools: Read Write Glob Bash(node *)
---

# Video QA

Runs the automatic checks on a rendered MP4 and tells you what to fix. The script measures; you read the contact sheet and decide. It changes nothing except `qa/report.json` and `qa/contact-sheet.png`. `<skill>` is the folder that holds this SKILL.md.

## Use when

- A project has a rendered video in `out/` and the user wants it checked reaches its QA step.
- The user asks why a video would be rejected, too quiet, or hard to read on a phone.
- The project is a kids' video (`meta.type` `kids` or an audience starting with `kids`): the stricter kids' checks run too (`references/checks.md`).

## Don't use when

- There is no render yet. Run `video-core` first.
- The user wants edits or a fix. Name what failed and the step that fixes it (`references/checks.md`), and stop.
- The question is whether the content is true or good. This skill checks the file and the project, not the argument.

## Steps

0. If `<project>/lessons.md` exists, read it first and follow it; `lessons.json` changes the limits for this project.
1. Run `node <skill>/scripts/qa.mjs <project>` (add `--draft` for a 540p draft). It needs `ffmpeg` and `ffprobe` on the PATH and the `video-core` skill installed next to this one.
2. Read the output. Every `FAIL` blocks publishing; every `WARN` needs a decision from you or the user.
3. Open `<project>/qa/contact-sheet.png` with the Read tool and look at it once: is anything cut off, unreadable or empty? Say what you see.
4. For each failure give the cause and the fix from `references/checks.md`. Do not edit the video yourself.
5. After the fixes, render again and run the script again. Do not publish on a fail unless the user says so in words.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run the script once per render. Do not read `report.json` unless the printed lines were cut at 40.
- View the contact sheet once, not frame by frame.

## Output

- `QA PASS` or `QA FAIL`, each FAIL and WARN in one line with its time, and what you saw in the contact sheet.
- What was not checked: spelling, platform UI margins and the loudness target are working defaults, not verified rules.

## Done when

- The script exited 0 (or the user accepted each remaining warning), the contact sheet was looked at, and nothing was published, uploaded or installed.
