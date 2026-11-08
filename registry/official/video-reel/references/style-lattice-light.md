# Style: light through the lattice (mashrabiya)

Seen as a family-3 idea in the Islamic-art scout notes (unverified, no single reel): a carved geometric screen casts amber light on a plaster wall, and the light moves as the sun moves. No outlines anywhere. The pattern is only ever light, and the story sits on the wall or inside an arch that opens.

## Look

- Wall: plaster sand `#cdb98f` with baked mottling and fine grain, a teal vignette `#0d2a30` pulling the edges and bottom down.
- Light: a gradient from `#ffd27a` through `#f0a63e` to `#c8641c`, seen only through the lattice cut-outs (8-point stars plus small drops).
- Text: dark teal `#14282c` serif (Baskerville), key phrase in italic burnt amber `#7a3a10`. It reads on both lit and unlit plaster.
- Arch: a doorway of deep teal `#0f2a30` with a thin burnt-amber edge. Inside it the amber shows as glowing dots on cream outline rings.

## Motion

- The whole lattice slides, shears (skewX) and stretches (scale Y) slowly with time, like a low sun. About 10 s is one gentle drift.
- At about 4.5 s an arch grows up from the floor (eased) and the story happens inside it.
- Days appear one by one as amber dots with a soft halo; a thin amber line grows under the daily row.

## How it explains

- Story device: Light through a lattice slides over a wall like a low sun.
- Arrows and flow: None; the shifting light and the drawn amber line are the flow.
- Labels and text: Dark teal Baskerville, key phrase in italic burnt amber.
- Numbers and counts: Amber day-dots inside an arch, one by one with a soft halo.
- Emphasis: The key word passes through a patch of lit plaster.
- Scene change: An arch grows up from the floor and the story moves inside it.

## Build notes

- Light layer: a gradient rect masked by `<rect fill="url(#pat)">` (white shapes on black, luminance mask). Move it with `patternTransform="translate() skewX() scale()"` set from t. Cheap, pure, no per-frame filters except a 2 px blur on the sharp copy.
- A second copy of the same masked rect with a large blur (about 18) gives bloom under the sharp stars.
- Grain: draw once into a 540x960 canvas at load with a seeded LCG (blobs then per-pixel noise). Never use per-frame feTurbulence.
- Mask units: give the mask `maskUnits="userSpaceOnUse"` and a pattern rect larger than the frame, or the skew exposes bare corners.
- Keep the cell big (about 220 px after scale). Small cells read as wallpaper and fight the text.
- Render cost: light, no frame near 1 s.
- Sound: `bong` when the arch starts, `thud` when it lands, `plink` per day, `tap` for lines.

## Good for (examples, never limits)

Light after darkness, guidance, Ayat al-Nur, patience, steady small deeds, anything about a path opening.

## References

- Scout notes, style 3 (V/_scout/3-islamic-art.md): the mask-on-gradient lattice idea (unverified).
- Mashrabiya screens and their moving light patterns: general craft reference, not checked.

## Working example

`assets/styles/lattice-light.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
