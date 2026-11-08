# Review: the cold reader, the fix card and the scope check

Three habits, each fixing one problem we had:

- The **cold reader** fixes this: the mind that made the reel also scored it.
- The **fix card** fixes this: a note like "feels cheap" was patched before its cause was found.
- The **scope check** fixes this: a fix quietly changed parts nobody asked about.

Adapted from video-director (win4r, MIT: `references/quality.md` §1, §4, §6 and `references/briefs.md` §9) and take-one (Tal Siach, MIT: `references/reviewer-brief.md`, `references/concept-check.md` §6). Notices in `THIRD-PARTY.md`.

`S/` below is `<animate-reel>/scripts/`.

## The cold reader

A maker scores their own work about 2 points higher than an outside reader does (take-one measured this). So the score that counts comes from a reader who saw none of the work.

**Rules**

- **Use a new helper every time.** Give it a fresh brief (Agent tool, no fork) and the default model, because it judges. A reader that saw the last round is anchored to it.
- **It sees only the pack.** No chat, no rationale, no code, no earlier score. Name the one folder it may open.
- **It cannot hear.** Give it the words with their times, from `voice-times.js`. Give it the loudness report too, when there is one.
- **Tell it what is locked,** or it spends its three problems on things nobody can change. Locked:
  - the fixed rules: no prophet drawn, faceless companions, female figures fully covered, no music;
  - the look the user picked;
  - the copy the user approved;
  - the source text.
- **One cold read per round, and a new reader each round.** Never add readers to chase a number. When the score stops moving, show the user.
- **When the reader and the user disagree, the user wins on taste.** The reader wins only on "can a stranger follow it", because the maker cannot judge that from inside.
- **Write its scores marked `cold reader`.** If you also score it, write your score beside it, marked `self`. Never report a score the reader did not give.

### A. The plan (reel-direction step 5)

**The pack** holds:

- the copy;
- the line plan table with only these columns: line, chosen picture, camera. Leave out the weak versions and the reasons.

Add one line on who watches it: Muslims scrolling Instagram, on a phone, maybe muted.

**Ask, in this order:**

1. Retell the reel in one sentence, as you would to a friend. What is it for?
2. Would you watch to the end? Where would you stop?
3. What here have you seen before, on other Islamic pages?
4. Score each from 1 to 10: proof (the pictures make the point with the captions hidden), surprise, clarity, peak, and overall. Use this scale: 10 means "I would send this to someone", 7 means "good, I would watch it", 5 means "fine and forgettable".
5. Name the one change that would raise your score most.
6. Name what must not change.

**The bar is 8 overall.** On paper, 8 is high. Readers held even famous films to 8 at most.

If the reader cannot answer question 1, or calls the idea generic, change the idea, not the wording. Keep what it called strong.

### B. The built reel (animate-reel-build step 3)

**The pack** is a folder in the scratchpad. It holds:

- the stills sheet;
- every clip strip (`clips/*.jpg`);
- 4 to 6 key stills at full size: the hook, the hero sequence and the end card;
- `WORDS.md`, which holds:
  - every voice line with its start time;
  - the on-screen text;
  - the comment ask;
  - one line on who watches and where.

**The brief.** Change only the bracketed parts:

> You review a short Instagram reel that you did not make. You stand in for a stranger who sees it once, on a phone, maybe muted. Default to reject. A kind score is useless. A harsh score that is not tied to something visible is useless too.
>
> Look only in [pack folder]. Start with WORDS.md, then look at every image there. Do not open any other file: judge only what a viewer sees.
>
> These are locked, so do not spend problems on them: [the locked list above, plus this reel's look].
>
> Report in this order, in under 450 words:
>
> 1. **What it says.** Say what the reel says in one sentence, from the pictures alone. Then compare it with WORDS.md. Say what you could not follow.
> 2. **Scores.** Score each from 1 to 10, with one line of evidence each (a timestamp and what you see):
>    - story: do the pictures carry the words?
>    - art direction: composition, what the eye sees first, type, colour, one world;
>    - motion: from the strips, look at easing, weight and landings;
>    - phone viewer: do the first 2 s pull you in, and does it read at a glance?
>    - overall.
> 3. **The three worst problems.** For each one, give the timestamp, what is wrong, the likely cause and a fix you can measure.
> 4. **Anything that looks off or cheap at full size,** such as hands, figures, text, cut edges or Arabic dots.
> 5. **The weakest shot, and a verdict.** The verdict is PASS if every score is 8 or more. If not, it is RETURN.
> 6. **A ten-second map (only for reels over 60 s).** Score each 10 s block for "does the picture carry the reel here", and name the weakest blocks.

These scores replace the self-score in animate-reel-build step 3. Write them in `script.md` under `## Scores`, then fix the three problems. Each fix gets a fix card (below).

## The fix card

**When to write one:** before every fix to something the user or a reader has seen. That means:

- a note from the user ("feels cheap", "too fast");
- a cold-reader problem;
- a check FAIL after a render.

A note is a symptom, not a spec. Find the cause before touching code.

**Template:**

```
NOTE         <the user's words or the problem, quoted>
CAUSE        <the mechanism: what in the code makes it look that way>
SCOPE        <time ranges, scene, element>
KEEP         <everything that must not change: look, composition, camera, timing, copy>
NOW          <how it looks today>
TARGET       <what the viewer will see after, in words you can check on a still>
NOT ALLOWED  <ways to fake it: make it bigger, add a camera move, more glow, change the style>
PROOF        <stills or a clip inside SCOPE; the scope check outside it: identical>
```

**How to use it:**

- Write the card in `script.md` under `## Fixes`, and show it to the user in the reply.
- With several notes, write one card each and fix them one at a time. Fix structure and motion before surface detail.
- A card is not permission to re-render. The rule "no re-render without the user's yes" stays, and so does the rule "ask before changing anything the user approved".

## The scope check

The scope check proves that a fix changed only its SCOPE.

1. Before you edit `index.html` for a fix, save a copy in the reel folder: `cp index.html index.before.html`.
2. Make the edit.
3. Run the check:

```bash
node S/capture.mjs <folder> scope index.before.html <t0-t1,...> [step]
```

It draws both pages at the same times and compares the pixels exactly. By default it checks every 3rd frame; `step 1` checks every frame.

- **Outside the ranges,** every frame must match. If one does not, the check fails. It prints the times and saves a before/after pair of the first changed frame in `scope/`.
- **Inside the ranges,** it gives a WARN when nothing changed, because then the fix did nothing.
- **It compares page draws, never two MP4s.** An MP4 encoder spreads a change across frames on both sides of an edit.

**When it cannot pass:** a fix that must move timing everywhere (a new voice take, a longer line) cannot pass. Say so on the card instead of running the check. A copy saved before a different fix is stale, so save a new one before each fix.
