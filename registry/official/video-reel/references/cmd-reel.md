---
description: Idea to finished MP4, then the caption. Give an idea, a topic, or a made-up story to tell.
argument-hint: "[idea note name | topic | made-up story about X]"
---

# /video reel reel

Makes one reel from start to finish: script, look, storyboard, build, render, then the caption.

Input: $ARGUMENTS (an idea note name, a topic, a link, or "a made-up story about X"). If empty, ask with buttons: the Coach's make-next pick, another idea from the list, or "I have a topic".

Every helper below asks the user at each stop, so do each one here in the chat: read its file and do its job. Do not hand them to a background helper.

## Before you start

1. Read `00 - notes/context/observed/taste.md`. Keep its lessons, likes and dislikes in mind at every step.
2. Read `00 - notes/context/declared/brand.md`.
3. If `## Posts` in `00 - notes/ledger.md` has a post that is 48 hours old with no row in `## Stats at 48 h`, say so in one line and offer `/video reel review` first. Carry on if the user says no.
4. **Resume.** If a reel folder for this idea already exists in `00 - notes/content/`, read the `status:` in its `script.md`. `topic done` or `blocked`: step 1. `story done`, `looks pitched`, `style done`, `storyboard done` or `delivered`: steps 2 to 5 (the Reel maker's status table says where).
5. **Voiceover.** If `voice_id` in brand.md is empty, the answer is `voiceover: no`, without asking.

Show this list in each reply and tick it off:

```text
Reel progress:
- [ ] 1 Script checked and approved
- [ ] 2 Look picked
- [ ] 3 Storyboard approved
- [ ] 4 Preview seen
- [ ] 5 MP4 rendered and checked
- [ ] Lesson saved
- [ ] Caption and Threads post written
```

## Step 1: the script

Read `<video-reel>/references/agent-script-writer.md` and do its job.

- A **real lesson** goes through the `video-reel-topic` skill, then the `video-reel-story` skill.
- A **made-up story** goes through the `video-reel-parable` skill in Script mode.

Done when the user said yes to the copy (`status: story done`). On that yes the skill moves to the look by itself. Do not stop it: that is step 2.

## Steps 2 to 5: the reel

These are the reel skills' own chain: the look (`video-reel-style`), the storyboard (`video-reel-storyboard`), the build, preview and render (`video-reel-build`). Each hands to the next on the user's yes. Read `<video-reel>/references/agent-reel-maker.md` and follow it from step 2: it keeps the idea note's status, picks up a half-done reel, and does the follow-through after the render.

The MP4 lands in `03 - export/<YYYY-MM-DD>-<slug>/reel.mp4`.

Then the Reel maker asks with buttons what worked, and writes one lesson in `taste.md` (30 at most, old ones merged).

## The end: caption

Read `<video-reel>/references/agent-caption-helper.md` and do its job: the caption, the Threads post, the posting day and slot, and the ledger row once the user gives the post link.

End with the path to the MP4 and one line on what to do next.
