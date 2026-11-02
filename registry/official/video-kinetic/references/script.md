# Writing a kinetic script

`script.md`:

```
# Title of the video

[l1] Check a skill before you trust it.
  beat: hook
  emph: trust
[l2] Skills are scripts your agent follows.
  beat: step
[l3] Aisle audit reads it as text. Never runs it.
  beat: step
  emph: text,never
  card: Audit|Reads as text=ok;Never runs it=ok;Grades A to F=A-F
[l4] One command. Aisle add.
  beat: button
  flow: add>audit>install
```

- Each `[id]` line is one beat and one scene. The text is read aloud exactly as written, so spell numbers and symbols as you want them said.
- Attributes (indented): `emph:` key words (comma separated; default: the longest content word), `layout: slab`, `exit:` (`slide`, `drop`, `blur`, `shatter`, `none`), `transition:` (`slash`, `shatter`, `whip`, `zoom-through`, `cut`), `card: Title|row=tag;row=tag` (up to 5 rows), `flow: a>b>c` (2 to 5 nodes).
- Open with the hook (the surprising or useful thing), give 3 to 7 beats of one idea each, end with the action. 15 to 45 seconds of speech is plenty.
- Use only the user's facts. If a line needs a number or a claim you were not given, ask or drop the line. Do not write promises ("the best", "#1", "guaranteed").
- Write for the ear: short sentences, contractions, no parentheses. Punctuation sets the phrasing: a full stop or comma starts a new on-screen phrase.
