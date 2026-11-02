# Kids mode

For children aged 3 to 5 or 6 to 9. Set `audience` in `brief.json` to `kids-3-5` or `kids-6-9` (the check refuses a kids brief with no age band) and give one `learningGoal`: a single thing a child learns, in one sentence. The video, the pace limits in QA and the "made for kids" answer all follow the audience.

Beats, in order: `hook`, `setup`, `try`, `turn`, `lesson`, `button`, then an optional `cta`.

| Beat     | What it does                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| `hook`   | A greeting or a small question to the child. Not a promise of "you won't believe".                               |
| `setup`  | Meet the character and the small problem (a wish, a puzzle, something to share).                                 |
| `try`    | The character tries. Use two or more `try` lines that repeat a pattern ("Can I...? No.") so a child can join in. |
| `turn`   | The kind idea that solves it.                                                                                    |
| `lesson` | The learning goal in the simplest words. One line only.                                                          |
| `button` | A warm ending. A catchphrase from the character's bible fits well.                                               |

## Age bands

| Band | Sentence         | Pace written for   | Words and ideas                                                                         |
| ---- | ---------------- | ------------------ | --------------------------------------------------------------------------------------- |
| 3-5  | at most 9 words  | 2.0 words a second | Everyday words, one idea per line, repeat a phrase, name feelings plainly.              |
| 6-9  | at most 15 words | 2.4 words a second | A little cause and effect, a small surprise, a few new words explained when first used. |

QA measures the real pace of the voice later (2.0 and 2.6 words a second at most); this check keeps the writing short enough to pass it.

## Rules the check enforces

- Never ask children to act: no "like", "subscribe", "follow us", "hit the bell". It is an error.
- No peril that frightens (death, blood, violence, scary dark scenes). A mild word gets a warning to read in context; keep the tone kind and the stakes small.
- No insults or teasing, even between friends in the story.
- Original characters only, each with a bible (`video-kids`). Never write a known character, a known show's catchphrase or a song's tune. Lyrics, if asked for, are original words with a plain rhythm, not set to an existing song unless it is in the public domain.
- No statistics, quotes or "experts say" claims. A fact stated as real still needs a source in `facts.md`.
- Arabic: write natively (`references/arabic.md`), in Modern Standard or Egyptian as asked, with numbers as words. Add diacritics only where a word is ambiguous. Tell the user a native speaker should read it.

## Storyboard

Use the `puppet` scene kind. One scene can hold the whole story, or use one scene per beat with a different backdrop (`meadow`, `room`, `night`). Props, in backticks:

```
{"backdrop":{"preset":"meadow"},"cast":[{"rig":"nour","x":0.3,"y":0.78,"height":0.45,"speaks":["k1","k2"],"acts":[{"at":0.5,"do":"wave"},{"at":3,"do":"walk","to":0.6},{"at":6,"do":"emote","mood":"happy"}]}]}
```

`speaks` lists the narration lines this character says (their mouth moves with the voice); `at` is seconds from the start of the scene. Acts: `walk` (`to`), `wave`, `jump`, `nod`, `dance`, `emote` (`mood`). Full list in `video-core/references/scene-kinds.md`. `storyboard.mjs` sets large kids' captions by default.
