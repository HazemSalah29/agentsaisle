# cut: pauses and fillers

`cut` plans first and renders only with `--apply`. The plan is an edit decision list: which stretches are removed and why, and which are kept. Read it with the user; `--plan cut.json` saves it.

## Where the speech comes from

- `--words words.json`: a list of `{ "text", "start", "end" }` in seconds (what `transcribe` writes). Most exact.
- no option: whisper.cpp measures the words (needs `/video doctor` to say whisper.cpp is ready; Arabic with `--lang ar`).
- `--silence-only`: no transcript. Sound against silence (quieter than -35 dB for the pause length). It cannot tell a filler from a word.

## What is removed

- A pause longer than `--pause` (default 0.35 s) shrinks to `--breath` (default 0.12 s, half after each word). Leading silence is cut to 0.05 s before the first word; trailing silence to 0.25 s after the last.
- Fillers that stand alone, whole, so no sliver of the sound is left. Defaults: English um, umm, uh, uhh, er, erm, ah, hmm, mm, mhm; Arabic امم, اممم, اه, آه, ااه, ايوه. Matching ignores case, punctuation and Arabic diacritics.
- Words that can carry meaning are not fillers unless asked: `--fillers-extra like,basically` or `--fillers-extra all` (English like, basically, actually, you know, i mean; Arabic يعني, كده, بقى). `--no-fillers` removes pauses only.

Each join gets a 10 ms fade so it does not click. At most 400 cuts in one run; raise `--pause` for fewer.

## Honest limits

Whisper can mishear or drop a short filler, and measured word times are good to roughly a tenth of a second. Always show the dry run. A removed stretch is gone from the new file only; the original is kept.
