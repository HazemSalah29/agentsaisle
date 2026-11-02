# Drawing demo (child's drawing to puppet to story)

`/video drawing` end to end on a **synthetic** drawing ([`synthetic-drawing.png`](synthetic-drawing.png), made by `registry/skill-tests/fixtures/make-drawing.py`; no real child's art and no photo). The steps and their files:

1. `drawing.mjs import --parent-ok` traced it into 6 colour regions: [`trace-sheet.svg`](trace-sheet.svg).
2. [`marks.json`](marks.json) says which region is the head, body, arms and legs (here the automatic guess was right and was not edited), and where the face is.
3. After the bible was filled in ([`characters/dot/bible.md`](characters/dot/bible.md)), `drawing.mjs rig` wrote [`characters/dot/puppet.json`](characters/dot/puppet.json); [`characters/dot/sheet.svg`](characters/dot/sheet.svg) shows it with every mouth shape.
4. A 23-second kids' story with a learning goal (trying again), `drawing.mp4`: three `puppet` scenes, Kokoro voice pitch-shifted to sound younger (an adult voice, not a child's), kids' captions, lip-sync from the voice.

`video-qa` passes every check, including the kids' checks, with no warnings (`qa/report.json`). The original drawing would live in `characters/<name>/private/` (git-ignored) and `drawing.mjs forget --yes` deletes it; here the file is the synthetic fixture.

The character is crude (flat colours, rough outlines): that is what tracing a crayon-style picture gives. Try it on a real scan before judging the fidelity.

Reproduce: see the commands in the `video-drawing` skill and `../kids/README.md` for the voice, captions, render and QA steps.
