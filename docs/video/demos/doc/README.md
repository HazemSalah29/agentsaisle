# Doc demo ("explain my doc")

A 34-second explainer made by `video-doc` from this repository's own root `README.md` (at commit `8c6ccfc`). Every spoken line is a sentence or bullet from the README, and every fact in `facts.md` cites its line (`README.md:63`). Nothing is summarised or invented; contents lists and the nav bar are skipped. Kokoro voice (synthetic), 1080x1920.

`video-qa` passes (`qa/report.json`). The README has no number table, so there is no chart here; `video-doc` turns a table with a number column into a bar chart whose title names the source line.

Reproduce:

```
node <video-doc>/scripts/doc.mjs --doc README.md --out projects/doc
# then voice, align, timing, captions, render and qa as in ../incident/README.md
```
