# Calligraphy demo (Arabic kinetic lettering)

Three well-known Arabic proverbs (public-domain wording, attributed as "an Arabic proverb") in [`quotes.txt`](quotes.txt), turned by `video-calligraphy` into one `calligraphy` scene each: the words are real text, so the browser joins the letters, and they are uncovered one at a time from the right. 12.8 seconds, 1080x1920, no voice and no music (`calligraphy.mp4`). `frames.png` shows two frames at half size.

`video-qa` passes (`qa/report.json`). Things to know:

- The Arabic is set in the system's default Arabic font; the skill ships no calligraphic font (add an OFL font such as Amiri to `brand/fonts` and name it in the scene).
- A long proverb wraps onto a second line with one word alone; the skill does not balance lines yet.
- The English translations are an unreviewed draft: a native reader should check the Arabic and the English before anyone publishes this.

Reproduce:

```
node <video-calligraphy>/scripts/calligraphy.mjs --quotes quotes.txt --out projects/calligraphy
node <video-core>/scripts/timing.mjs projects/calligraphy
node <video-core>/scripts/render.mjs projects/calligraphy
node <video-qa>/scripts/qa.mjs projects/calligraphy
```
