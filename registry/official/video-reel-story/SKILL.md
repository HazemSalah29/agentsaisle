---
name: video-reel-story
description: "Step 2 of the /video-reel chain for the user's page: picks the story shape from the story references (or makes a new one), plans what the viewer watches, the one motif that transforms and where the camera travels, then writes the copy as a warm story with one citation per screen. Use only when the /video-reel gate or video-reel-topic hands off, or when the user asks to redo the story or copy of a reel."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *) Bash(python3 *) Bash(bash *)
---

# Reel story
Decides how the reel tells its story before anything is drawn, because the story choice used to hide inside the look and came up too late. Reads the reel's `script.md` (`## Sources`). Shared rules: `<video-reel>/references/chain.md` and `<video-reel>/references/rules.md`, sections "Direction" and "Copy".

Read the niche from 00 - notes/context/declared/brand.md.

The citation line uses the niche's source format (`<video-reel>/references/chain.md`, Brand constants, Citation line): on an Islamic page the collection and number, on any other page a plain line with the source name.

## Use when

- `video-reel-topic` hands off step 2, or the user asks to redo the story or the copy of a reel.

## Don't use when

- The sources are not checked yet (run `video-reel-topic` first).
- The user wants a different look only (use `video-reel-style`).

## Steps

```text
Story progress:
- [ ] 0 Rules read
- [ ] 1 Story shape picked or made
- [ ] 2 What the viewer watches planned
- [ ] 3 Copy written
- [ ] 4 Story check run
- [ ] 5 Copy approved, status: story done
```

0. **Read the rules first,** even when this step runs alone, because the numbers live only there. Read "Fixed for every reel" and "Brand constants" in `<video-reel>/references/chain.md`, and the "Direction" and "Copy" section of `<video-reel>/references/rules.md`. If the reel folder has no `rules.md`, copy it there. Done when read.
1. **Pick the shape.** Open `<video-reel>/references/story-shapes.md`. Offer three shapes that fit this source (a shape from the list or a new one), each in one line with why, and a pick. For a YouTube source, the video's order is the default: say so. Done when the user picks.
2. **Plan what the viewer watches, line by line.** A beat often holds several lines, and a scene planned per beat leaves lines with nothing to act them out. So plan each line on its own: what acts that line out, what is in front and behind, what moves, where the camera goes, and why the shot matters. Pictures may add details the words do not say; the words still say everything plainly. A line shares the scene before it only when it is too short to carry its own event (under about 1.5 s) or only adds the citation; write why next to it. Then plan the one motif that transforms through the reel, and where the camera travels inside one world. Borrow moves from `<video-reel>/references/ideas.md` (openings, middles, payoffs, endings); they are a toolbox, not a menu. No look or colours yet: that is video-reel-style. Done when every line of the copy has its own visual event or a written reason to share one, and each would still say its line with the caption hidden.
3. **Write the copy.** Full warm sentences to one person, in the voice set in `00 - notes/context/declared/brand.md` (until `00 - notes/context/observed/taste.md` has lessons, a plain warm neutral voice). Only what the sources say; each unsupported line from video-reel-topic stays out unless the user agreed it. One citation per screen, in the niche's source format (Brand constants, Citation line). No em dashes, no jargon, no guilt hooks. On Islamic pages, scholars and tafsir may be named when read. On other pages, experts and authors may be named when read. Pick the comment ask: one word or short phrase that fits this reel (story-shapes.md, "The comment ask"). If the hook adapts another page's line, say whose and how it changed. For the hook, write three from three different formulas and score them (story-shapes.md, "Hooks"); record all three with their scores and the pick under `## Hooks` in `script.md`. Done when every line is written with its citation and the hook is picked.
4. **Story check.** Read the copy and the plan as a harsh editor would. These are guides, not gates: a strong story can break one.
   - First: would a basic Muslim (who knows who Musa is, what salah is) understand every line on one listen? Say plainly what happens and what things are; no metaphors, no line written to sound like a quote.
   - Is the opening interesting to someone who does not know the topic?
   - Does it tell a story, or only explain?
   - Is the angle fresh, or would the viewer think "this again"? Could another page make almost the same reel?
   - Is the information revealed in a good order, with a turn where the viewer's understanding changes and a payoff at the end?
   - Is there one picture the viewer will remember, or are the visuals only illustrations?
   - Could it be much better?
   If the words are strong but the pictures are generic, fix the pictures in step 2; if the pictures are strong but the story is weak, fix the story in step 3. Write a short note on what the check changed under `## Story check`. Done when the check is written.
5. **Record.** Write `## Copy` and `## What the viewer watches` in `script.md`, keep any old draft under `## Old draft`, set `status: story done`, and tick the Direction and Copy rules that are done.

**Stop.** Show the copy beat by beat with its citation. When the user approves, invoke `video-reel-style` with the Skill tool. If they change the shape, return to step 1; if they change lines, return to step 3. In bulk prep (`<video-reel>/references/chain.md`, Bulk prep), do not stop: write the question and the pick under `## Open questions` and go on.

## Budget

- Read only the files this step names; the rules live in `<video-reel>/references/rules.md`, so read the sections for this step, not the whole file.
- Run each script once per change and read its report, not its source.
- Do not re-read a file you just wrote or edited.

## Output

- `## Copy` and `## What the viewer watches` in `script.md` and `status: story done`; the other story shapes under `## Other shapes` in bulk prep.

## Done when

- The user approved the copy beat by beat, each screen has one citation, and the hook score is recorded.
