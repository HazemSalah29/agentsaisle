# Caption styles

Styles are data in `assets/styles.json`. `captions.mjs` resolves one in this order: the style's defaults, then `captions` in `brand.json`, then `captions` in `video.json`.

| Style     | Look                                                                     |
| --------- | ------------------------------------------------------------------------ |
| `karaoke` | The spoken word turns the accent colour; the line stays. Bold, outlined. |
| `pop`     | Each word pops in as it is spoken.                                       |
| `clean`   | The line fades in on a soft dark panel; no per-word effects.             |

Overridable fields: `size` (fraction of frame height; on 9:16 never below 0.045), `weight`, `stroke`, `background` (`none` or `panel`), `uppercase`.

Grouping: at most `maxWordsPerLine` (2 to 8, default 4) words; breaks at sentence ends, long pauses and after a comma once two words are in; never a lone word unless the line is one word (with a limit of 2, an odd run becomes one group of 3).

Safe zones (`TODO(verify)` against each platform's current UI): reel and short keep captions 22% above the bottom and 8% in from the sides; YouTube 8% and 6%.

## Bilingual (second line)

`--bilingual translations.json` adds a smaller line (80% of the caption size, at most 120 characters) under the main captions. One text per narration line, shown for as long as that line's captions are, so a long line's translation stays up while its captions change. Every captioned line needs a translation or the script stops and lists the missing ids. Text direction follows the language (`ar`, `he`, `fa`, `ur` are right-to-left). The translation is not spoken, so it has no word timing and is never highlighted word by word. Scenes keep clear of the extra height. Extra files: `captions.<lang>.srt` and `.vtt`. Run `captions.mjs` without the flag to go back to one line.
