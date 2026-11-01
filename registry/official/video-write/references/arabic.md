# Arabic scripts

- Write in Arabic directly, in Modern Standard or Egyptian as the user asks (`dialect` in `brief.json`), not a translation of English.
- Spell numbers as words: the voice engine reads digits badly and the check fails any digit (0-9, Arabic-Indic and Persian) in an Arabic line.
- Add diacritics (tashkeel) only where a word is ambiguous when spoken (names, rare words); not everywhere.
- No symbols such as `-`, `_` inside words and avoid long runs of Latin letters; spell acronyms phonetically if the voice mispronounces them.
- Speech is slower in Arabic (the check assumes about 2.2 words a second).
- The text is a machine draft. Say so, and recommend a native speaker review it before publishing.
- Captions need an Arabic font in `brand/fonts` (for example Cairo); video-core renders them right to left.
