# Style: Growing island

A whole toy island that builds itself on a clock and then lights up at dusk. Isometric pastel blocks, one warm amber accent, a camera that slowly orbits and pulls back as the place fills in. No figures. It is not the isometric-pastel recipe: that one is steps and blocks popping up one at a time on a small tile. This one is a world that grows by itself, with life that never stops (boats, glints, cars) and a change of light at the end.

## Look

- Sea (day): vertical gradient `#d2eee9` to `#bfe3e0` to `#acd6d6`. Sea (dusk): `#505a96` to `#968cc4` to `#f4b6a0`. Mix day to dusk with one number, `DK`, from 0 to 1.
- Island tiles: grass `#cde6b8`, sand rim `#f3e3c3`, roads `#f4efe6`, courtyard `#efe6d2`, pond `#a8d6e0`. Each tile is two stacked slabs: earth `#e6d3ae` over rock `#c9b28e`.
- Buildings: cream and lilac walls (`#f7efdf`, `#ecddc2`, `#ddd3eb`, `#e9e1f2`), muted roofs (`#c9bedb`, `#d8c6ae`, `#bfb6d3`), glass `#a8bed3`, trees `#a9d497` with `#88bc85` shade and `#cdebb8` highlight.
- Shade is never grey: the shadow side mixes toward cool lilac `#6f6a93` by day and `#2c2f6e` at night. Light from the top left, flat translucent shadows fall to the bottom right. No blur anywhere.
- One accent, amber `#ffc66b`: lit windows, the minaret and dome finials, the key words, the citation. Nothing else is warm.
- Type: Avenir Next 600 at 64 px on a soft dark rounded backing; Menlo spaced capitals at 40 px for the citation.

## Motion

- The world grows on a clock. Tiles fall in centre first, then roads and buildings, then trees. Houses add a floor every 0.8 to 1.3 s, each floor on its own small overshoot.
- Secondary life never stops: two boats on a slow orbit with wakes, sparkles on the sea, ripples leaving the shore, cars on the roads.
- The camera is always moving: a slow yaw orbit (-14 to +10 degrees over 10 s) and a pull back (scale 98 to 68), starting close on the first tile and ending wide.
- Dusk comes in at about 60 percent of the reel: sea turns peach and lilac, the whole island cools, then windows switch on in a wave from the masjid outwards.
- For Islamic reminders: each small deed is a house or a floor, a community that keeps showing up fills the island, and the masjid quarter lighting at Maghrib is the payoff.

### Easing (numbers)

- Tile drop: back.out(1.3), 0.42 s, falls 1.4 units; stagger 0.28 s per unit of distance from the centre.
- Floor added: back.out(1.9), 0.32 s per floor. Roof and dome pop: back.out(1.9), 0.35 to 0.4 s.
- Trees: back.out(2.2) plus a small squash wobble over 0.5 s.
- Text in: ease-out cubic, 0.6 s, rises 14 px; old line out in 0.4 s.
- Camera: scale and pan on in-out cubic over 9.6 s; yaw on in-out cubic over 10 s.
- Dusk: in-out cubic, 1.8 s. Window on: ease-out cubic, 0.22 s each, staggered 0.19 s per unit of distance from the masjid.
- Boats and ripples: linear in time, so they never stop.

## How it explains

- Story device: a place that grows on a clock; each building is one small deed on one day.
- Arrows and flow: none. Cars and boats show life, not direction.
- Labels and text: two or three short lines on dark rounded backings, key words in amber.
- Numbers and counts: floors and houses are the count; no numerals needed.
- Emphasis: the amber light itself. Whatever lights up is what matters.
- Scene change: dusk. The same world changes light, so there is no cut.

## Build notes

- Canvas 2D with one projection: rotate world (x, y) by the yaw, then `sx = cx + (rx - ry) * .866 * S`, `sy = cy + (rx + ry) * .5 * S - z * S`. Yaw makes faces change as the camera orbits, so shading comes from the rotated normal, not a fixed face.
- One `face(points, normal)` helper does back-face culling (`rx + ry + nz > 0`) and shading (`u = (rx - ry) / len`; positive mixes toward the shade colour, negative toward white). Boxes, gable roofs and pyramid caps all use it.
- Sort objects by rotated `rx + ry` of the footprint centre; tiles first, then flat shadows (convex hull of footprint plus the footprint thrown right), then objects.
- Dusk is a colour function, not an overlay: every fill goes through `col()` which mixes toward a night purple, so lit windows stay bright with no multiply pass.
- Window halos are a slightly larger flat quad at 20 percent alpha. No blur, no depth of field.
- Layout is generated once from a seeded rng (mulberry32), so `frame(t)` is pure and the render matches the preview.
- Gotcha: back-ease overshoots below 0 for a tile (it briefly sinks into its neighbours); that is wanted, keep it small (s = 1.3).

## Good for (examples, never limits)

Small deeds that add up over days, a community or a habit growing, a place being built (a masjid quarter), the light coming on at Maghrib.

## Working example

`assets/styles/growing-island.html`: a 10 s page (SAHIH AL-BUKHARI 6464, "The Prophet ﷺ named the deed Allah loves most." then "not the biggest one." then "Same nights. One kept going." over an island that grows and lights up).
