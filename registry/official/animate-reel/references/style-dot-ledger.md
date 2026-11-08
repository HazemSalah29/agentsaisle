# Style: dot ledger (one-number reel)

**Production readiness:** demo only (it is a chart: two panels of dots, small on screen with the lower third empty; no camera, depth, light or place; scenes beyond count-versus-count do not exist)

A grid of dots on near-black where some change state, with one big serif counter. Scouted as "Dot Ledger" in the explainer family (life-calendar grids, the dim/bright/glow hierarchy of habit-tracker apps). The idea is a number made visible: one dot per day, 365 to a year.

## Look

- Ground: `#0c0c0e`. Idle dots: `#2a2a30`, radius 6. Lit dots: gold `#e0a93b`, radius 9, with a cream `#fff3cf` flash on the frame they light.
- Grid: 30 columns, pitch 28 px, 365 dots (12 full rows plus 5). Centred, about 830 px wide.
- Type: Baskerville for lines and the counter (60 px, gold, right-aligned on the label row); Menlo caps with wide tracking for labels ("DONE ONCE", "A SMALL DEED, EVERY DAY").
- Two ledgers stacked on one screen: same size, same 365 dots, so the comparison is instant.

## Motion

- Weight: light and mechanical on purpose, because dots are counted, not thrown. A dot lights with a 1.45x pop and a cream flash for one frame, then settles to gold with no bounce (`zeta` 1). The counter bumps at the end with `zeta` 0.7.
- Camera: a locked frame, or a slow push of 3 to 5 percent toward the grid being counted. It never pans across the grid and never rotates it.
- Entering: lines fade up with a masked rise; the dim grid appears row by row from the top, and idle dots appear first as a quiet field. Leaving: whole rows dim from the bottom up; labels fade last.
- Transformations: an idle dot to a gold dot (the only colour change); a field of dots to a number; one lit dot against a full year.
- Transitions: 1) the hook fades and the ledgers rise row by row, 2) one ledger dims while the other keeps filling, 3) the grid reflows into a different shape (a year into weeks, then into a single row) by each dot sliding to its new place.
- Timing feel: the fill is an eased ramp, slow at the start, fast in the middle and settling at the end; the counter and the dots always agree. A row tick every 30 dots lands on a sound.
- Never moves: the grid pitch, the dim dots' position, and the label rows. Dots never wobble or drift.

## How it explains

- Story device: Two ledgers of 365 dots, stacked, so the comparison is instant.
- Arrows and flow: No arrows; the dots lighting in reading order is the flow.
- Labels and text: Baskerville lines; Menlo caps with wide tracking for labels.
- Numbers and counts: A live gold counter on the label row, with a small bump at the end.
- Emphasis: A cream flash on the frame a dot lights.
- Scene change: The hook fades and the ledgers appear; the grid never moves.

## Build notes

- Canvas 2D, one `frame(t)` that clears and redraws; about 750 arcs, trivial render cost.
- The counter is `floor(365 * inout(progress))`. The lit time of dot i is found by bisecting that same function, so dots and number always agree and `frame(t)` stays pure.
- A row tick is placed by the same bisection at multiples of 30, so the sound lands on row ends.
- Keep the pop radius small (1.45x): at 1.9x the head of the fill overlaps its neighbours and looks like a smear.
- Count only days in a year. Do not label the count as reward or points; the number is just how many days the deed was done.
- Sound: `tick` per row and for the hook rows, `plink` for the single dot, `thud` on 365, `bell` on the caption.

## Good for (examples, never limits)

Any hadith about constancy against size: the beloved deed, a little but regular, a daily habit, dhikr, Qur'an a page a day. Also time budgets and counted rewards where the number comes from the text.

## References

- genie9 life calendar (dot-per-unit-of-time grid), unverified from notes.
- indiehackers "daymark" (dim, bright, glow hierarchy), unverified from notes.

## Working example

`assets/styles/dot-ledger.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template. It loads `../ScheherazadeNew-Regular.ttf` (unused in drawing, safe to drop).
