# Craft: the kinetic look and how to judge it

## What the parts do

- **Pop-in**: each spoken word springs in with an overshoot starting 30 ms before it is said, so the eye lands on it as the ear does. Uppercase Anton (SIL OFL), white, key words in the accent colour with a glow; each key word gives the camera a small punch.
- **Phrases**: the line splits at punctuation into groups of at most 4 words. The newest phrase holds the middle; the one before clears out as it arrives, by `slide`, `drop`, `blur` or `shatter` (letters break apart and fly). The last phrase of a beat stays.
- **Slab**: a short line on a full block of the accent colour, giant dark type. Used about every third beat for rhythm.
- **Transitions** into a beat: `slash` (a glowing diagonal wipe with a flash), `shatter` (the old beat zooms apart with a flash), `whip` (a fast blurred slide), `zoom-through`. Never two slashes within 2.5 s.
- **Cards and flows**: a tilted 3D card whose rows appear on spoken words (`card:`), or a vertical chain of nodes (`flow:`). Only the user's content.
- **Sound**: added by the render: a whoosh on each cut, an impact on slabs, a soft pop on each phrase and an original music bed ducked under the voice; the master is normalised to -14 LUFS.

## Rules

- One idea per line; at most 12 words; short words land harder. Questions and numbers are fine; claims must be the user's.
- The first word is said within 0.4 s of the start, and something is on screen from frame 0 (the glow and grid).
- Key words: one or two per beat (`emph:`). If everything is highlighted nothing is.
- Never more than four words at once; never type under 8% of the frame width; never text over the burned captions area.
- Vary: two beats in a row never use the same exit or transition.

## Checklist for the contact sheet (fail one, fix it, re-render; at most 2 times)

1. Is a word ever clipped by the frame edge or overlapping another phrase? Shorten the line or set `layout`.
2. Does each beat have a clear key word, and is it the right one? Set `emph:`.
3. Do two neighbouring beats look the same? Change a `layout`, `exit` or `transition`.
4. Is any frame empty for more than a moment? Add a card or flow if the user gave one, or tighten the voice speed.
5. Does `sync.mjs` warn that a phrase is on screen too briefly? Speak slower (`speed`), or split the line.
6. Does the last beat end on a clear line (the call to action), held long enough to read?
7. Does `video-qa` pass (flashing, black frames, loudness)?
