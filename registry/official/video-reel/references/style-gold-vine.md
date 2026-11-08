# Style: gold vine (islimi and tazhib illumination)

Gold tapering vines unfurl on a lapis ground, the way islimi arabesques and tazhib illumination fill the pages of a Qur'an manuscript or a court book. A dark ink outline sits under flat gold, leaves open along the draw head, and an illuminated border closes around a cartouche. Craft source: Islamic-art construction notes (islimi scrolls, tazhib borders); no reel found using it, so this is a new look for the page. Warm, devotional, slow.

## Look

- Ground: deep lapis, a radial gradient from #25489c to #0a1840, with a faint pattern of tiny gold four-point stars at 12-16 % opacity. Oxblood works as an alternate ground for heavier topics.
- Gold: one diagonal gradient (#b8821f to #d9a441) with a dark ink outline (#2a1804) around every shape. The outline is what reads as manuscript, not as a web gradient.
- Vines are tapering: thick at the root, a point at the tip. Leaves are teardrops with a dark midrib. A twelve-petal rosette with a lapis inner ring is the flower.
- Frame: a double gold border with rosettes in the four corners, and a pointed-oval cartouche (lozenge) holding one short caption in gold italic serif (Baskerville).
- Cream serif for the hook lines; gold italic for the turn. Tiny @YOURPAGE handle at the bottom.

## Motion

- Each vine draws itself from the root; the tip is always a fine point. Leaves pop (scale with a small overshoot, about 0.4 s) the moment the draw head passes them. Side tendrils start when the stem reaches them and end in a curl.
- The vine speed carries the meaning: one is fast and ends in a single bloom, the other is slow, steady and still growing at the end. The finished vine dims (brightness 0.62) so the living one looks lit.
- The border strokes itself round once, corner rosettes bloom, the cartouche opens and the caption fades in.
- Last beat: a glint. The gold gradient has a bright band whose stop positions move with `t`, so the shine crosses every gold shape at once.

## How it explains

- Story device: Two vines race side by side: one fast and ending in a bloom, one slow and still growing.
- Arrows and flow: The vine itself is the arrow; it draws from the root and tapers to a point.
- Labels and text: A pointed-oval cartouche with one short gold italic caption.
- Numbers and counts: No digits; the length of the vine is the count.
- Emphasis: A shine band crosses every gold shape at once; the finished vine dims.
- Scene change: The border strokes round once, then the cartouche opens for the caption.

## Build notes

- Vines come from a turtle walk: `turtle(x, y, heading, length, curvature(u))`, 3 px steps, with curvature a sine sway plus a squared ramp at the end that rolls the tip into a spiral. Sine phase must be pi/2 so the stem leaves the root straight. All points are precomputed once; `frame(t)` only picks how many to draw.
- Taper: build one polygon from the left and right offsets of the points up to the head index. Width = root width x (1 - 0.82 x progress), times a short ramp so the live tip is sharp. Use `paint-order="stroke"` with a dark stroke so the outline stays outside the gold.
- Draw side branches BEFORE the main stem so the stem covers their blunt root.
- Leaves are built in global coordinates (rotate the points in JS, no SVG `transform`). A `userSpaceOnUse` gradient on a transformed element would shift the glint on each leaf.
- Glint: five stops (`s0..s4`); outside the sweep set the middle stop to plain gold, during it a pale #fff6cc band of width 0.24 travels from offset 0 to 1.
- Gotchas: a global `function frame()` helper collides with `window.frame` and recurses until the stack blows; name helpers `drawFrame`. A zero-length dash with round caps still paints a dot, so return nothing while the border progress is 0. Do not dim gold with `opacity` (it goes grey over blue); use `filter: brightness() saturate()`.
- Render cost: about 25 s for 300 frames, since it is plain SVG string rebuilt each frame (around 150 nodes). No problem.
- Sound: `slide` as the ground line draws, `bong` as the first stem starts, `plink` for leaves (every second leaf only), `thud` when the big deed stops, `slide` and `tap` for the border and cartouche, one `bell` on the glint.

## Good for (examples, never limits)

Mercy, the growth of faith, small steady deeds, dhikr, the Qur'an and its recitation, anything about beauty and care.

## References

- Islimi (arabesque scroll) construction: spiral and branching rules, unverified, see `_scout/3-islamic-art.md` in the style-samples folder.
- Tazhib (illumination): gold on lapis with dark outline, cartouche and border layout, unverified, same notes.
- Log spiral and tapering stroke technique for the vine, unverified, same notes.

## Working example

`assets/styles/gold-vine.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
