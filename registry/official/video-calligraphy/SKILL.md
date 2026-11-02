---
name: video-calligraphy
description: "Part of the video library, used by the video skill (not run directly). Make animated Arabic lettering from a list of quotes, revealed word by word in reading direction, shaped by the browser, with optional translation and attribution. Use for kinetic Arabic type, quote cards or animated Arabic titles. Don't use for narration or text that must be respelled or stretched."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Arabic calligraphy kinetic type

Builds a draft project of up to 8 `calligraphy` scenes, one per quote, without a voice. The text is used exactly as given: never reshaped, respelled or stretched with tatweel, and a word is never split into letters because that would break the joins. `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user wants animated Arabic quotes, titles or sayings.
- The user gives the Arabic text. Do not write or "improve" a quote: proverbs and verses must be quoted as given, with their source in `by`.

## Don't use when

- The user wants narration or captions on a spoken video: that is `video-voice` and `video-captions`.
- The text is pasted from a PDF or drawing tool and arrives as pre-shaped letters. Ask for the plain text.
- The text is a Quran verse or a religious text the user cannot source. Ask for the exact wording and source; do not paraphrase.

## Steps

1. Write `quotes.txt`: one quote per line as `text | translation | by` (translation and by optional; `#` lines are comments). Keep each quote to 10 words or fewer.
2. Choose a font. The browser shapes any Arabic font; a calligraphic one from `brand/fonts` (an OFL font such as Amiri, Aref Ruqaa or Reem Kufi) is named by its file name with `--font`. Do not download fonts yourself; ask the user to add the file and check its licence (`references/calligraphy.md`).
3. Run `node <skill>/scripts/calligraphy.mjs --quotes quotes.txt --out projects/<slug> [--font Amiri-Regular] [--reveal wipe|fade|rise] [--format reel-9x16]`.
4. Run `node <video-core>/scripts/check.mjs projects/<slug>`, then a draft render, and look at one frame per quote: letters joined, marks not clipped, right-to-left order.
5. If the translation is yours, say it is a draft and recommend a native reader for the Arabic and the translation.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run the script once. Look at one frame per quote, not every frame.

## Output

- The folder written, the quotes, the font and the reveal; any note about the font missing.
- Which frames were looked at.

## Done when

- `check.mjs` exits 0 and the frames show joined letters in right-to-left order.
- No quote was changed, and every translation or attribution came from the user or is marked a draft.
