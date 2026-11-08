# Style: time road

Borrowed from the craft of the time-travel piece in the MIT style gallery: one camera travels one endless road through every era, and each era is drawn in its own period look. Nothing cuts. The road, the moon and one small lamp are the only things that never change, so the eye holds the whole story together. For our page it is the same act across many days or years, then versus now, a life passing station by station, or the history of one place.

## Look

- One road, a dark ribbon with thin ivory edges and a dashed centre line, winding up the frame in a gentle S. It is the timeline.
- Each era is a band of its own with its own sky and ground (desert indigo, slate teal, brick brown, city navy), and its own way of being drawn: flat silhouettes for the tent, hairline stone blocks for the dome house, stacked brick courses for the row house, a flat glass grid for the flats.
- Eras are places and objects only: a tent, a well, a house, a street light, a car. No people, ever.
- Shared by every era: ivory `#f2ead8` for the road edges, the stars and the moon, and one accent, lamp gold `#f0b44c`, for what is live: the lamp, the fire, the dashes already travelled, the key words.
- The same small lamp sits in the same spot (right of the road, in a window) in every era. That repeated spot is the idea: the act stays, the world around it changes.
- The moon is in every era too, in a different phase, so the nights visibly pass.
- Texture on every frame: seeded film grain, a vignette, twinkling stars, a flickering flame. No depth-of-field blur (the user rejected blur).
- Captions sit in a soft dark box (about 80 % ground colour) at the top, y 290 and down, so they are calm over any era.

## Motion

- The camera never stops. It travels up the road in steps with a small sway while it holds, so a hold is never dead.
- Each travel step moves one full era (1100 px) and lands with the next station's lamp lighting.
- The road dashes behind the camera turn gold, so the road behind you is the days you kept.
- The big thing (a roaring fire) flares, then dies as the camera leaves it. The small lamp is lit again at every station.
- Captions arrive word by word and are replaced, never stacked.

### Easing (numbers)

- Era travel: power3 in-out (cubic in-out), 1.5 s per era, steps start at 2.1 s, 3.9 s and 5.7 s.
- Hold sway: sine, 14 px amplitude, 0.9 rad per second.
- Lamp lighting: power3 out, 0.5 s, timed to the camera arriving.
- Fire dying: cubic in-out, 1.2 s, starting just before the camera leaves.
- Flame flicker: sums of sines at 8, 11, 9 and 17 rad per second, 4 to 8 % size.
- Caption words: power3 out, 0.35 s each, stagger 0.2 s, rise 16 px. No blur clearing.
- Colour grade between eras: a 220 px gradient seam, so eras melt into each other as the camera passes.

## How it explains

- Story device: one road, one act, many eras. The same lamp is shown again and again while the places change around it.
- Arrows and flow: the road is the arrow. Gold dashes show the distance travelled.
- Labels and text: no labels on the picture. Captions only, in the box at the top, with the citation and the handle at the end.
- Numbers and counts: moon phases and the count of lit stations stand in for numbers.
- Emphasis: lamp gold on whatever carries the point. The big flare and the small lamp share the frame once, so size can be compared.
- Scene change: the camera travels to the next place along the road; the era look changes under it. There are no cuts.

## Build notes

- World coordinates: station k is at world y `-1100*k`. Screen y is `wy - cam + 1000`. The camera is a sum of eased steps.
- Draw only what is near the screen (`|cy - 1000| < 1700`). Four stations at about 40 shapes each cost nothing.
- The road is a polyline sampled every 30 px, with the centre dashes at fixed world spacing, so the dashes slide with the camera.
- One `station(k, cy, t)` function per era keeps each era's look separate. Lit state comes from time, never stored.
- Grain uses `rng(1000 + frameIndex)`; stars use `rng(31 + k)`. `frame(t)` is pure.
- Vertical frame: travel up the road, or sideways if the story reads left to right. Keep the lamp spot constant on screen.
- Sound: `slide` when the camera starts a step, `tap` as a caption starts, one `plink` when the citation lands. About one every 3 to 4 s.
- Keep eras to 3 or 4. More than that and each one is too short to read.

## Good for (examples, never limits)

The same deed done on many nights or years (a small act kept up), then versus now, a life seen station by station (youth, work, age), the history of a single place such as a spring, a mosque site or a market.

## Working example

`assets/styles/time-road.html`: a 10 s page in this style (Bukhari 6464, the deed Allah loves most). Read it for the techniques; do not reuse its layout as a template.
