---
name: animate-reel-parable
description: "Thinks up made-up stories (parables) for the user's page that teach one or more lessons from a real source (on an Islamic page the Qur'an, sahih or hasan hadith, or basic deen; on any other page a book, a study or another real source from that niche), in any kind of story and any look, stick figures included. Two modes: Scout saves several idea notes to 00 - notes/ideas/; Script writes one story in full on the spot and hands it to the /animate-reel chain. Use when the user types /animate-reel-parable, or asks for a made-up, fictional or parable reel, story ideas like Straight Path Stories or Sabr Stories, or a story that acts out a real lesson (a hadith or ayah on an Islamic page)."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *) Bash(python3 *) Bash(bash *)
---

# Reel parable
A parable is a made-up story that carries a real lesson. The person in it never lived; the lesson comes from a text read on its primary page. Studied reels (Straight Path Stories, Sabr Stories) show a made-up story around one lesson can travel far (on an Islamic page, one text, with no Qur'an story or seerah in it). What kills a parable is not the telling but a basic lesson told the usual way: the viewer thinks "this again".

## Use when

- The user wants made-up stories (parables) that teach a lesson from a real source: idea notes (Scout) or one finished story (Script).

## Don't use when

- The user wants a plain fact reel (use `animate-reel`).
- The story would use a real person's likeness or a prophet drawn in any form.

## Steps

Pick the mode, then follow Scout or Script as written below.

## Rules for every run

Read the niche from 00 - notes/context/declared/brand.md.

Islamic pages (`niche: islamic`) keep every rule as written. Every other niche follows the "Every other niche" line where a rule has one: the lesson needs a real source from that niche, such as a book or a study.

1. **Never limit the story.** Any kind of story, any setting, any length, one lesson or several. Every example in this skill or its reference is a spark, never a menu to pick from: invent past them every time.
2. **The story is made up; the lesson is not.**
   - **Islamic pages:** each lesson rests on an ayah, or a sahih or hasan hadith, read on quran.com or sunnah.com (`node <animate-reel>/scripts/source.mjs <url>`), with its grading recorded. The Qur'an comes first where it fits, read with the verses around it. A text that only half fits the story is dropped: find a better story or a better text. A plain basic-deen lesson (pray, thank Allah, be kind to parents) may run with no citation, but any line that quotes or names a text must be checked.
   - **Every other niche:** each lesson rests on a real source from that niche (a book, a study, an official page), read on its primary page with web fetch and recorded with its title, URL and the quoted line. A plain common-sense lesson (keep your word, rest when tired) may run with no source, but any line that quotes or names a source must be checked.
3. **The story never claims more than the text.** It is never shown as a real event. On an Islamic page it is never shown as a hadith, and no line puts words in the Prophet's ﷺ mouth. On any other page no line puts words in a real author's or expert's mouth. Mark an outside picture as ours when the copy explains it.
4. **The made-up people are ordinary people.** Never a real, named person. On an Islamic page, never a prophet or a companion, and never one of their names. Faceless figures that show feeling through posture work well.
5. **Any look is allowed,** stick figures included. The look is still picked in animate-reel-style.
6. **No guilt aimed at the viewer.** No guilt hooks and no shaming tone; the viewer should see themselves, not feel accused. The character is another matter: his story may end dark or costly when it earns it.
7. Every rule in `<animate-reel>/references/chain.md` "Fixed for every reel" still holds: no em dashes, the comment ask at the end, readable on a phone.

## Pick the mode

| Mode | When | Output |
|---|---|---|
| Scout | "give me ideas", a number of ideas, a theme to explore | Idea notes in `00 - notes/ideas/`, shown as a list |
| Script | "write one", "script now", a topic with no ask for options, or a pick from Scout | A reel folder with `script.md` at `status: story done` |

If the request fits both, ask once: Scout or Script, with Script as the pick when a topic was named.

## Scout

```text
Scout progress:
- [ ] 1 Rules read
- [ ] 2 About 15 ideas made, scored, strong ones kept
- [ ] 3 Every text read on its primary page
- [ ] 4 Idea notes written and checked
- [ ] 5 List shown with a pick
```

1. **Read the rules:** "Fixed for every reel" in `<animate-reel>/references/chain.md`, the Source and Copy parts of `<animate-reel>/references/rules.md`, and [references/parable-craft.md](references/parable-craft.md). Done when read.
2. **Spread wide, then cut.** Make about 15 ideas. Start some from a human situation (someone wants something, and it costs them) and some from a lesser-known text read for the human problem inside it. No two share the same kind of story, setting or picture idea. Each has the conflict, the made-up story in three lines, the turn, the lesson (or lessons) and its text, the picture idea, and the comment ask. Score each 1 to 10 as a harsh editor on freshness, hook, feeling, story, fit of the text, picture idea and how long it holds; a sweet but obvious story is a 5. Drop anything basic or overused (craft file, "The basic test"). Keep every strong one, or the number the user asked for. Done when every kept idea differs from the others in kind and scores high on freshness.
3. **Read each text** on its primary page. A text that fails is replaced, never kept: on an Islamic page a weak grading, a wrong number or a wrong speaker; on any other page a link that does not say what the idea claims. Done when every idea has a checked text or is a plain lesson (basic deen on an Islamic page).
4. **Write the notes** as `parable-<slug>.md`, in the same frontmatter as the other notes in that folder (`area: parable`, `found_by: animate-reel-parable`, `source_status: verified`, or `none-needed` for a plain lesson with no source). Done when every new note has all the frontmatter keys of `00 - notes/ideas/_template.md`.
5. **Show the list,** one line per idea, with the one you would make first. A pick goes to Script.

## Script

```text
Script progress:
- [ ] 1 Rules read
- [ ] 2 Text read on its primary page
- [ ] 3 Script written
- [ ] 4 Reel folder made
- [ ] 5 Script shown, handed to the chain on yes
```

1. **Read the rules** (as Scout step 1). Done when read.
2. **Read the text** on its primary page and copy it. Islamic pages: its Arabic, English, number, narrator and grading. Every other niche: its title, URL and the quoted line. If it fails, offer another text for the same lesson. Done when the text passes.
3. **Write the script:** a strong, clear hook (the first line and the first frame), then a beat table with seconds, every on-screen line exactly, what the viewer watches in each beat, the lesson beat with its one citation, and the comment ask last. Every line says plainly what happens; no metaphors, no line written to sound like a quote. Then the cover text and a caption that says "An original parable." Under it, two one-line other angles for the same lesson. Run the story check in `animate-reel-story` step 4 before showing it. Done when every beat would still say its line with the caption hidden.
4. **Make the reel folder** `00 - notes/content/<YYYY-MM-DD>-<slug>/`: copy `<animate-reel>/references/rules.md` in, write `script.md` with `## Sources`, `## Copy` and `## What the viewer watches`, set `status: story done`, and tick the Source and Copy parts of its `rules.md`. If the idea came from Scout, set that note's `status: picked`. Done when the folder exists.
5. **Show the script** beat by beat. On yes, ask the /animate-reel question round for mood, look, length and voiceover (skip what the user said), then invoke `animate-reel-style` with the Skill tool. If they change lines, return to step 3.

## Files

- [references/parable-craft.md](references/parable-craft.md) - what makes a parable work, sparks, the reference reels, and the checks before a parable is done. Open in step 1 of either mode.
- [tests.md](tests.md) - three test prompts and what a good run does. Run them after changing this skill.

## Budget

- Read only the files this step names; the rules live in `<animate-reel>/references/rules.md`, so read the sections for this step, not the whole file.
- Run each script once per change and read its report, not its source.
- Do not re-read a file you just wrote or edited.

## Output

- Scout: idea notes in `00 - notes/ideas/`. Script: a full story in `script.md` at `status: story done`.

## Done when

- Every lesson traces to a source read on its primary page and the user chose the idea or approved the story.
