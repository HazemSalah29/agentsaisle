# Writing a carousel

How to write the slides and the caption. The voice comes from `voice` in `00 - notes/context/declared/brand.md`, and from the lessons in `00 - notes/context/observed/taste.md`. Until there are lessons, use a plain, warm, neutral voice.

## Pick a shape first

A carousel without a shape reads as a row of true facts with no point. Before you write, say the point of the carousel in one sentence. If you cannot, the topic is not ready.

Pick one shape. None of them is the default. Pick the one that fits why the post exists.

| Shape | Use it when the post exists to |
|---|---|
| The reveal | change one thing the reader already believes |
| The useful list | give the reader something to keep and use |
| Story, then the lesson | stay with a reader who is in the situation now |
| Quick reference | answer a question the reader will look up again |

- **The reveal.** Slide 1 names what the reader believes. Slide 2 starts to take it away. Each middle slide turns it a little more. Near the end, speak to the reader as "you". Then the ending.
- **The useful list.** Slide 1 says the reader's situation in plain words and says what they will get, with the number ("3 things that help when..."). Slide 2 gives the one point in one sentence. Then one item per slide, each with its number. Then the ending. People save this shape.
- **Story, then the lesson.** Give the moment first, in two or three short lines: who, where, what was at stake. Then the lesson. Use only what the source says. Add no feelings, no dialogue and no detail the source does not have.
- **Quick reference.** Slide 1 names the subject plainly. Slide 2 gives the answer, often as a short table the reader can screenshot. Then the real cases. The rule that sorts them comes last.

Write the shape and the one-sentence point at the top of `## Slides` in `script.md`.

## Slide rules

1. **One thought per slide.** If a slide holds two thoughts, split it.
2. **Each slide answers the question the last slide raised.** Read the slides in order. After each one, ask what the reader wants to know next. The next slide must answer that.
3. **Cut any slide the chain does not need.** If you remove a slide and the chain still holds, leave it out.
4. **Short lines.** A slide is read on a phone in a few seconds. Most slides hold one to three short sentences.
5. **The lead line** (themed look) is a few words that frame the slide. It is not a second sentence.
6. **No em dashes.** Use a full stop, a comma, a colon or brackets instead.
7. **Plain words.** No filler, no hype words, no lines that sound good and say nothing. Cover the rest of the slide and say what the line claims. If you cannot, cut it.
8. **Sound like a person.** Mix short and long sentences. Keep the odd, specific detail. Not every slide needs a neat closing line.

## Hooks (slide 1)

- **Leave a gap.** Slide 1 raises a question and does not answer it. When slide 1 already feels finished, the reader has no reason to go on.
- **Name the subject. Hold back only what it means.** People judge the topic of a post in a moment, while they scroll. Make the topic clear at once. After slide 1, the reader must be able to say what the post is about.
- **Plain information gets no suspense.** For money, how-to or rules, name the topic plainly on slide 1 and give the answer on slide 2. The reader wants the facts, not a puzzle.
- **Do not reuse the same kind of hook twice in a row.** Check the last few carousels in `00 - notes/content/`.

Hooks that often work: something the reader does not know yet; a habit the reader has, seen in a new way; a question the reader half asked and never answered; a small puzzle with a clear subject.

## Endings

- **The last slide asks the reader to share or save,** and names a real kind of person to share it with. Example: "Share it with the friend who plans a lot and starts late."
- **Save fits better for posts to come back to** (a list, a reference). Share fits better for posts about a person.
- **The slide before the last** can turn to the reader as "you" and say what this means for them.
- **A soft ending** fits a reflective post. The last slide can end quietly, with no ask on it. Then put the share or save ask in the caption.

## Arabic on a slide

The renderer puts an all-Arabic line in its own right-to-left block, and an Arabic word inside an English line in a right-to-left span. Some cases still go wrong:

- **Punctuation after an Arabic word can land on the wrong side.** Follow each Arabic word with an English word, so no mark touches the Arabic directly. A sentence should close on English, not on Arabic.
- **A long Arabic phrase inside an English sentence can break badly at the line wrap.** Keep Arabic inside English to one short word, or move it to its own line.
- **A single Arabic word alone in a body paragraph can render small.** Use the English spelling in the line, or give the word its own line.

Look at every slide that has Arabic at full size.

## Caption

The caption always comes with the render. Do not ask if the user wants one. The slides are images, so the caption is the only text Instagram can search.

In order:

1. **A fresh first line.** The reader has already seen the slides, so do not repeat slide 1. Instagram shows only about 125 characters before "more", so this line has to make sense by itself.
2. **The point as plain text,** in two to five short lines. This is the copy people can search.
3. **The share or save ask,** or the comment ask (`comment_word` in brand.md) if it fits better.
4. **Sources,** one per line, when the carousel has a source.
5. **The hashtags** from `hashtags` in brand.md, unchanged.

Apps set the direction of a caption line from its first letter. So a line that opens in Arabic turns right to left, and its full stop moves. Fix it by opening the line in English. If the line must open in Arabic, add the hidden character U+200E (left-to-right mark) as its first character.

Save the caption as `caption.txt` in the export folder. Show it in a fenced code block, so the user can press copy.
