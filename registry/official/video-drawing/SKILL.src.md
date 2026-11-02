---
name: video-drawing
description: "Part of the video library, used by the video skill (not run directly). Turn a child's drawing (never a photo) into an original puppet character: trace the shapes, the parent confirms head, body, arms and legs, rig eyes and mouths; the drawing stays in a private folder and can be deleted. Don't use for photos of children, known characters, or a drawing the user does not own."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Child's drawing to puppet

`<skill>` is the folder that holds this SKILL.md; `<kids>` is the sibling `video-kids` skill. Needs the video venv with OpenCV (`/video doctor`).

## Use when

- The user has a child's crayon, marker or paint drawing on plain paper and wants it as a character.

## Don't use when

- The picture is a photo of a child or any person. Refuse in one sentence and offer an original character from `<kids>` instead.
- The drawing shows a known character, or the user is not the child's parent or guardian.
- The user wants only a story, voice or render: `<kids>`, `video-write`, `video-voice`, `video-core`.

## Steps

1. Ask the parent or guardian to confirm that the file is a drawing the child made, not a photo, and that it may be used. Only then run `node <skill>/scripts/drawing.mjs import <project> --character <name> --image <file> --parent-ok`. A photo is refused and nothing is kept.
2. Open `characters/<name>/private/trace-sheet.svg` with the user. Correct `private/marks.json` (region ids for body, head, arms, legs, optional extras, and where the face is). Leave out a limb the drawing lacks; never draw one for the child.
3. With the child, fill the TODO lines of `characters/<name>/bible.md` (species, shape, outfit, catchphrase, personality, learning goal). Run `<kids>/scripts/bible-check.mjs`; the name must be new, never a known character.
4. Run `node <skill>/scripts/drawing.mjs rig <project> --character <name>`, then `<kids>/scripts/puppet.mjs check` and `sheet`. Show the sheet and wait for a yes.
5. Continue with the kids' video steps (`<kids>`, then the video skill's chain) using the character and its learning goal.
6. Offer deletion: `node <skill>/scripts/drawing.mjs forget <project> --character <name> --yes` removes the original and everything traced from it and keeps only the vector rig.

## Budget

<!-- include: _shared/read-budget.md -->

- Run `import` once per drawing. Do not open the original image except through the sheet the user sees.

## Output

- The character folder, the parts found, the missing limbs, and where the private data is.

## Done when

- `puppet.mjs check` passes and the parent has seen the sheet.
- The drawing is only under `characters/<name>/private/`, which is ignored by git, and is named in no `video.json` or credits file.
