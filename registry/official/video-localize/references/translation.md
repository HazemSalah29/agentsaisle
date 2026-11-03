# Translating a video

- **Adapt, don't transliterate.** Hooks and jokes rarely survive word for word. Keep the meaning and the beat.
- **Length.** `translate.json` gives a limit per string. Arabic on-screen text is often shorter than English; narration is slower (about 2.2 words a second), so scenes get longer. Let `timing.mjs` retime them.
- **Numbers.** Arabic narration cannot contain digits (the voice engine refuses them); write them as words. On-screen digits are drawn by the renderer in the language's own numerals.
- **Dialect.** `msa` (default) is clear everywhere. `egyptian` changes only the voice description; write the text in the dialect yourself. `TODO(verify)`: whether the voice follows the dialect.
- **Brands and code.** Brand names listed in `assets/glossary.ar.yaml` stay as written. Add your own brands and terms (copy the file into the new folder to override it).
- **Quotes.** A quote's text is translated, but say in the credits that it is a translation of the original words.
- **Draft.** Machine Arabic needs a native read before it is published. Never present it as reviewed.
