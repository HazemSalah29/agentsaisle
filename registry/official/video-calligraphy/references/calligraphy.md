# Calligraphy details

- Shaping: words are real HTML text, so the browser joins the letters. Never insert tatweel, never split a word, never paste pre-shaped (presentation form) letters; the check refuses them and control or direction-mark characters. Joiners (ZWNJ, ZWJ) are fine.
- Reveal: `wipe` (default) uncovers each word from the side the reading starts on (right for Arabic), `rise` lifts it in, `fade` fades it in. One word moves at a time.
- Timing: no voice, so each scene is 4 s or longer (1.6 s plus 0.8 s a word). A scene with one narration line per word reveals each word with its line.
- Font: the scene's `font` is the file name (without extension) of a font in `brand/fonts`; the brand font is used when it is absent, and the system fallback when neither has Arabic. Calligraphic OFL fonts (Amiri, Aref Ruqaa, Reem Kufi) are suggestions: check the licence of the exact file the user adds; this skill ships none.
- Limits: 80 characters and 10 words a quote; translation 80; attribution 40; 8 quotes a project.
- Not built: letter-by-letter stroke drawing, kashida stretching, per-word colours, Arabic narration (use `video-voice` with 3arab).
