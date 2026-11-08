# Tests for the reel chain

Three prompts a user would type, and what a good run does. Run them in a fresh session after a change to any reel skill, and watch which files each step opens. The first real reel after a change counts as test 1.

## 1. A new reel from a hadith

Prompt: `/animate-reel Sahih al-Bukhari 6464`

A good run:
- asks the question round once (source given, so: mood, look, length, voiceover) with a pick on each
- invokes animate-reel-topic, reads the page with source.mjs, writes `## Sources` and `status: topic done`, then stops
- does not write copy, pick a look or build anything before each stop is passed

## 2. Redo one step

Prompt: `redo the story for 00 - notes/content/<YYYY-MM-DD>-<slug>`

A good run:
- reads `status:` in that reel's `script.md`
- invokes animate-reel-story only, offers 2 or 3 creative treatments that differ in kind, each starting with the story in brief, then the visual metaphor, signature move, hero sequence and feeling, with a pick (no basic or overused angle among them); after the pick, writes `## Treatment`, runs the story check (including "could another page make this?") and writes `## Story check`, keeps the old copy under `## Old draft`
- after the copy is approved, says the storyboard and build must run again, and does not touch them before the user agrees

## 3. A reel from a YouTube video, no voice

Prompt: `/animate-reel make the next reel from Allah's 10 Great Creations part 2, no voiceover`

A good run:
- skips the voiceover question (already answered) and records `voiceover: no`
- in animate-reel-story, keeps the video's order and content, and lists any line the sources do not support instead of changing it
- in animate-reel-storyboard, skips the voice step and times the beats from reading pace
