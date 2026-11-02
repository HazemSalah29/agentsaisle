---
name: video-kids
description: "Paused part of the video library: not offered right now. Make original cartoon characters for children's videos and put them in a story: character bible, shaded SVG puppet (optional 3D), contact sheet, lip-sync mouth shapes, acts and backdrop. Use for kids' animation. Don't use for known characters or songs, photos of real children, or realistic stories."
user-invocable: false
disable-model-invocation: true
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video kids

Makes the cast and the acting for a children's video. Everything is drawn in code and plain text, so the same files give the same film and the user can edit them. `<skill>` is the folder that holds this SKILL.md; `<video-core>`, `<video-write>` and the other `<video-...>` are the sibling skills.

## Use when

- A kids' video needs a new character (`new-character`) or an episode (`episode "<idea>" --age 3-5|6-9 [--song] [--lang ar|en]`).
- The user wants a cartoon for children with original characters, or lip sync for a puppet.

## Don't use when

- The character is, or looks like, a known one (a show, a film, a game, a toy brand). Refuse and offer an original with a new name, shape and colours. `bible-check.mjs` refuses names it knows; you must also refuse lookalikes it cannot know.
- The user wants a real child's photo or voice, a known song's tune, or a video uploaded. Offer original work; never upload.
- The video is an explainer, a showcase or a realistic story: use the other video skills.

## Steps

1. New character: ask only for what is missing (name, kind of creature, one personality sentence, `round`, `square` or `triangle`, 3 to 5 colours or "choose for me"). Write `characters/<name>/bible.md` from `references/character-bible.md`.
2. `node <skill>/scripts/bible-check.mjs <project> --character <name>`. Fix every error; never argue with a known-character refusal.
3. `node <skill>/scripts/puppet.mjs scaffold <project> --character <name>`, then `sheet`. Tell the user to open `characters/<name>/sheet.svg` in a browser and wait for their yes. Change the drawing by editing `puppet.json` (`references/puppet-rig.md`), then `puppet.mjs check`. A rig the user supplies goes through `check` too. For a 3D look (optional, `references/puppet-rig.md`): `node <skill>/scripts/puppet3d.mjs scaffold <project> --character <name>`, then `check`, and set `"look": "3d"` in the puppet scenes. Offer it, never default to it: it needs WebGL and is about 6 times slower without a GPU.
4. Episode: make sure each character has a ready bible and puppet (`status.mjs`). Then hand writing to `video-write` in kids mode (one learning goal, age band, `puppet` scenes) and stop for the user to approve the storyboard.
5. Set the acting in each `puppet` scene's props with `references/acting.md`: backdrop, where each character stands, which lines each one says, and the acts. `--song`: write original lyrics as narration lines; no music is made.
6. After `video-voice` has voiced the lines: `node <skill>/scripts/kidvoice.mjs <project>` (a younger-sounding pitch from each bible's `Voice pitch`; say plainly that it is an adult voice made to sound younger, never a real child), then align the words with `video-voice` and run `node <skill>/scripts/visemes.mjs <project>`.
7. `node <video-core>/scripts/check.mjs <project>`, `timing.mjs`, `video-captions --style kids --burn`, `render.mjs --draft`. Look at one frame per scene, then render, run `video-qa`, then `video-publish`.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run each script once per change. Do not open `puppet.json` to describe it; `status.mjs` and `check` say what is wrong.

## Output

- Per character: the bible check result, the rig check result and the path of the contact sheet.
- Per episode: the scene props written, the mouth-shape summary, and the QA result.

## Done when

- Every character used has a bible that passes and a rig that passes `puppet.mjs check`, and the user has seen the contact sheet.
- `check.mjs` exits 0 and a draft frame of each `puppet` scene was looked at.
- Every character is original, nothing was uploaded or installed, and no real child's photo or known character is in the project.
