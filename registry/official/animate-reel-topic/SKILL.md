---
name: animate-reel-topic
description: "Step 1 of the /animate-reel chain for the user's page: reads every source the reel will cite on its primary page (on an Islamic page each hadith and ayah on sunnah.com and quran.com; on any other page the official site, study or book page), records each one in the reel's script.md, and checks the source has something motion can show. Use only when the /animate-reel gate hands off, or when the user asks to redo or recheck the sources of a reel."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *) Bash(python3 *) Bash(bash *)
---

# Reel topic
Gets the sources right before any story is written, because the reel goes out under a public name and a wrong number is a public correction. Shared rules: `<animate-reel>/references/chain.md` (Fixed for every reel) and `<animate-reel>/references/rules.md`, section "Source (animate-reel-topic)".

Read the niche from 00 - notes/context/declared/brand.md.

Islamic pages (`niche: islamic`) check every hadith and ayah as below. Every other niche does a normal fact check with links instead.

## Use when

- `animate-reel` hands off step 1 of a reel, or the user asks to recheck or redo a reel's sources.

## Don't use when

- The reel already has checked sources and the user wants a new story (use `animate-reel-story`).
- The user wants a fact for a non-reel purpose; this step only records sources a reel will cite.

## Steps

```text
Topic progress:
- [ ] 0 Rules read
- [ ] 1 rules.md copied into the reel folder
- [ ] 2 Every source read on its primary page
- [ ] 3 Every number, count and absolute checked
- [ ] 4 Source is showable
- [ ] 5 Recorded in script.md, status: topic done
```

0. **Read the rules first,** even when this step runs alone, because the numbers live only there. Read "Fixed for every reel" and "Brand constants" in `<animate-reel>/references/chain.md`, and the "Source" section of `<animate-reel>/references/rules.md`. If the reel folder has no `rules.md`, copy it there. Done when read.
1. **Rules.** Copy `<animate-reel>/references/rules.md` into the reel folder as `rules.md`. Tick the Questions section from the gate's answers. Done when the file is in the folder.
2. **Read each source on the primary page.**
   - **Islamic pages (`niche: islamic`).** Hadith: `node <animate-reel>/scripts/source.mjs https://sunnah.com/<collection>:<n>` (headless Chrome; sunnah.com blocks plain fetches). Ayah: quran.com, The Clear Quran for the English. Which hadith qualify, and the speaker check: rules.md, Source. For a YouTube source, find a primary page for each fact the video states; the video's story, images and claims stay in unless a primary text contradicts them (rules.md, Source). Done when every source has collection, number, narrator, grading, Arabic and English copied from the page.
   - **Every other niche: a normal fact check.** Each claim the reel makes gets a primary link: the official site, the study or the book page, read with web fetch. A search summary, a repost or memory is a lead, never the source. Record each one in `## Sources` with its title, its URL and the quoted line that backs the claim. For a YouTube source, find a primary link for each fact the video states. Done when every claim has a title, a URL and a quoted line.
3. **Check the risky words.** Every number, count and absolute ("only", "never", "once", "every") against the primary text, with the method written down. For a pattern or count reel, also the counting method to show on screen and a label for each claim (verified, a scholar's view, a coincidence or disputed; rules.md, Source). The hook is the highest-risk line. List each line the sources do not support, for the user's call. Done when each is checked or listed.
4. **Showable?** The source needs an object, a place, an action, a change or a count that motion can act out. If it is pure dialogue or a list, say so and offer a carousel instead, or text over a living scene. An outside analogy is fine when marked as ours, never as what the source says. Done when the user agrees it is showable, or picks the other route.
5. **Record.** Write `## Sources` in the reel's `script.md`, with the unsupported lines under it, and set `status: topic done` in its frontmatter (the same field older reels use). Tick the Source section of the reel's `rules.md`.

**Stop.** Show the user the sources and any unsupported lines. When they say yes, invoke `animate-reel-story` with the Skill tool. If a source fails, go back to step 2 with a new one. In bulk prep (`<animate-reel>/references/chain.md`, Bulk prep), do not stop: write the question and the pick under `## Open questions` and go on.

## Budget

- Read only the files this step names; the rules live in `<animate-reel>/references/rules.md`, so read the sections for this step, not the whole file.
- Run each script once per change and read its report, not its source.
- Do not re-read a file you just wrote or edited.

## Output

- The sources in the reel's `script.md` under `## Sources`, with the unsupported lines listed, and `status: topic done`.

## Done when

- Every claim has a title, a link or collection number, and a quoted line, and the user said yes (or bulk prep wrote the open questions).
