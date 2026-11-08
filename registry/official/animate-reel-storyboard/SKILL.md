---
name: animate-reel-storyboard
description: "Step 4 of the /animate-reel chain for the user's page: makes the voiceover take when the reel has one, then the beat table (times, text, motion, transitions, sounds) and storyboard.html, a grid of quick sketch panels plus one hero frame in the real style. Use only when the /animate-reel gate or animate-reel-style hands off, or when the user asks to redo the storyboard, the timing or the voice of a reel."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *) Bash(python3 *) Bash(bash *)
---

# Reel storyboard
Plans every beat on paper before the full world is built, like a quick mock before the real app, because a full build takes many minutes and a sketch takes few. Reads `script.md` (`## Copy`, `## What the viewer watches`, `## Look`, and `voiceover:` from the question round). Shared rules: `<animate-reel>/references/chain.md` and `<animate-reel>/references/rules.md`, sections "Copy and storyboard" and "Sound".

## Use when

- `animate-reel-style` hands off step 4, or the user asks to redo the storyboard, the timing or the voice.

## Don't use when

- No look is picked yet.
- The reel is already approved and only needs building (use `animate-reel-build`).

## Steps

```text
Storyboard progress:
- [ ] 0 Rules read
- [ ] 1 Voice take made and timed (only if voiceover: yes)
- [ ] 2 Beat table written
- [ ] 3 storyboard.html built and shown
- [ ] 4 Approved, status: storyboard done
```

0. **Read the rules first,** even when this step runs alone, because the numbers live only there. Read "Fixed for every reel" and "Brand constants" in `<animate-reel>/references/chain.md`, and the "Copy and storyboard" and "Sound" section of `<animate-reel>/references/rules.md`. If the reel folder has no `rules.md`, copy it there. Done when read.
1. **Voice (only if `voiceover: yes`).** Follow `<animate-reel>/references/sound.md`, the Voiceover part. Write the text with tags and pauses in `voice-text.txt` (Arabic words and اللَّه in Arabic script with tashkeel). The Qur'an is never read by a computer voice. The ElevenLabs key comes from the env and is never printed: run Python with `python3 -I`. Save the take in `03 - export/<YYYY-MM-DD>-<slug>/`. Add the pauses and write `voice.wav` and `voice-times.js` (`window.VT`, start and end per line and cue word). Then run `python3 -I <animate-reel>/scripts/voice_check.py <folder>`: Whisper hears each line back and fails any skipped, misread or extra word, or a tag read aloud; remake a failed line. Ask the user to listen to the Arabic words (its LISTEN lines), which it cannot check. Done when the user is happy with the take. The beats are timed to it from here on.
2. **Beat table.** In `script.md`, one row per line of copy (the line plan from `## What the viewer watches`), grouped under its beat: the seconds (from `window.VT` when there is a voice), the exact on-screen text, the composition (what is in front, what is behind, what the eye sees first) and why the shot is there, what moves, the object's state before and after (what this line changes), the camera move and shot size (mix wide, close, abstract and type-led on purpose), the transition into it (continuous, and what carries over; or a scene change with a reason, such as the camera travels through an object or a shape grows into the next scene; vary the moves, see `screens.md` Transitions and `ideas.md`), the feeling the line should leave, and the sounds with their kit ids and volumes, including any silence placed on purpose. Sounds per `<animate-reel>/references/sound.md` and `<animate-reel>/assets/sfx-kit/catalogue.md`, inside the limits in rules.md, Sound (with a voice, sounds sit well under it). Pace per rules.md, Build and look; length follows the script, never a cap. Done when every line has its own row with every column; a row that shares the scene above says why.
   Under the table, write `### Hero sequence` (from `## Treatment`): its time range and its choreography move by move: anticipation, the main move with its easing, overshoot (look.md limits), follow-through, settle, secondary motion, and the camera path. Only the hero sequence and the few key moves get this detail; other rows stay one line.
3. **storyboard.html** in the reel folder: a grid of quick 2D sketch panels (flat shapes for the objects, the exact text where it sits, an arrow for the camera, palette swatches), each with its beat number, times, transition and key sounds; under the grid, any fact or number that was assumed. Add ONE hero frame drawn with the real style code at full quality: the key moment of the hero sequence. Show it in the built-in browser pane. Done when the user has seen it.
4. **Record.** Set `status: storyboard done` and tick the storyboard and sound-plan rules.

**Stop.** When the user approves, invoke `animate-reel-build` with the Skill tool. If they change the beats, return to step 2; if they change the look, hand back to `animate-reel-style`. In bulk prep (`<animate-reel>/references/chain.md`, Bulk prep), do not stop: write the question and the pick under `## Open questions` and go on.

## Budget

- Read only the files this step names; the rules live in `<animate-reel>/references/rules.md`, so read the sections for this step, not the whole file.
- Run each script once per change and read its report, not its source.
- Do not re-read a file you just wrote or edited.

## Output

- The voice take when there is one, `## Beat table` in `script.md`, `storyboard.html`, and `status: storyboard done`.

## Done when

- The user approved the storyboard (and the voice), and the sound plan uses only sounds that exist in the installed packs.
