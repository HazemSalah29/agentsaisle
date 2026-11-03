# The kinetic chain

The voice is the video: each word slams in as it is spoken. Everything rides on the lines, so write them first and hard (`references/craft.md`, sections 1 and 2).

1. Write `projects/<slug>/script.md`: 5 to 10 lines, 2 to 8 words each, one idea per line. Under a line, optional `emph: word, word`, `layout: slab` (a full-colour block, for the line that should hit hardest; about every third beat), `card: Title|row=tag;row` or `flow: a>b>c` (only content the user gave). Details: `video-kinetic`.
2. `node <video-kinetic>/scripts/plan.mjs --project projects/<slug> --preset volt|ember|ice|grape` writes `video.json` and the brand file.
3. Show the lines to the user (one pause). Then `video-voice` (voice, then align) and `node <video-core>/scripts/timing.mjs`.
4. `node <video-kinetic>/scripts/sync.mjs projects/<slug>` (add `--allow-estimated` without whisper.cpp). Fix every ERROR; a warning about reading time means a line is said too fast: split it or slow the voice.
5. `node <video-core>/scripts/render.mjs projects/<slug> --draft`, then the score card in `references/craft.md`.
6. Final render, `video-qa`, then offer `video-publish`.

Good kinetic lines: short words land harder; a question then its answer; numbers; a slab on the turn ("Done beats perfect."). Bad: long words (over 12 letters fill the frame), lists of more than three, anything that needs a diagram (use the explainer).
