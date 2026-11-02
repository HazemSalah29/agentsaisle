# Craft: the kinetic look and how to judge it

## What the parts do

- **Pop-in**: each spoken word scales in with a small overshoot (0.22 s) starting 30 ms before it is said, so the eye lands on it as the ear does. Words are uppercase in the Anton display font (SIL OFL), white, with key words in the accent colour, a glow and a spark ring.
- **Phrases**: the line splits at punctuation into groups of at most 4 words. Two phrases can be on screen at once, one above the other; a phrase leaves when its slot is needed again, or half a second after its last word, by `slide`, `drop`, `blur` or `shatter` (letters break apart and fly). The last phrase of a beat stays so the next transition can split it.
- **Slab**: a short line (1 to 3 words) on a full colour block in the accent colour, one giant word. Used about every third beat for rhythm.
- **Transitions** into a beat: `slash` (a glowing line sweeps corner to corner and the old scene is cut in two, the halves sliding apart with a spark ring), `shatter` (the old scene breaks into shards), `whip` (slides out blurred), `zoom-through`. A slash is never closer than 2.5 s to the last one (it would strobe); the engine turns a too-early slash into a whip and says so.
- **Cards and flows**: a tilted 3D card whose rows appear on spoken words (`card:`), or a vertical chain of nodes with a glowing dot (`flow:`). Only the user's content.
- **Sound**: original synthesized effects, a whoosh and a hit on cuts and a tick on key words, mixed under the voice at -5 to -16 dB; the master is normalised to -14 LUFS.

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
