# Style: Low-poly faceted

A real perspective camera flies down a triangulated desert valley at the turn of night to dawn. Every face is flat-shaded, distance turns to fog, and a faceted sun rises while the light, ambient colour and fog all follow it. A small domed masjid waits on the far plateau and its windows light as the valley opens. No figures.

## Look

- Sky by time of day `tod` (0 night, 1 dawn): top `#0e1334` to `#26357a`, middle `#2a2763` to `#b86a96`, low `#4a3a7a` to `#f09a96`, horizon `#6a4a8a` to `#ffc79a`. Stars (2 px) fade out as `tod` rises. Faceted sun of 14 wedges `#ffcf94`..`#fff4d8` with a wide radial glow.
- Terrain: sand `[232,196,146]`..`[208,164,114]`, wet sand `[196,168,126]`, rock `[168,122,106]` and `[104,82,96]`, steeper faces mixed toward `[126,92,92]`, each face jittered by 6 percent.
- Light: sun colour `[110,110,190]` to `[255,216,166]`, ambient `[56,60,112]` to `[132,112,150]` with a hemisphere term, fog `[34,40,88]` to `[242,170,152]` (cooler higher up).
- Palms (4-sided trunk, 7 double-sided fronds), rocks (jittered icosahedra), water facets that mirror the sky and glint, masjid in cream with a teal 80-face dome, gold finial and a minaret.
- Panel: a chamfered dark glass shape with a thin light edge, a faceted coral and peach underline, a bold sans (Avenir Next), Scheherazade New in ivory with a peach glow.

## Motion

- Camera path (position, yaw, pitch) eased from inside the narrow canyon to above the open plain, with a slow sway. The sun, light and fog ride `tod = smooth(1.2, 7.2, t)`.
- Facets flip in (scale from their own centre, a white flash) from near to far in the first 1.3 s.
- The narrow, dark canyon is the hardship; the valley opening to a lit plain and a lit masjid is the ease. Windows light at 5.4 s with an additive halo.

## How it explains

- Story device: A camera flight through one faceted valley, idea by idea.
- Arrows and flow: Angular two-tone ribbon arrows.
- Labels and text: Cut-corner tags pinned to objects, Space Grotesk.
- Numbers and counts: Space Grotesk counters; pillars rise on a plateau.
- Emphasis: A crystal whose facets realign, or a lit pillar.
- Scene change: The camera flies on to the next place; no cuts.

## Build notes

- Pipeline: build triangles once (normals and centroids cached), per frame cull back faces, project, build and fog, painter-sort by camera depth (far first), fill and stroke with the same colour at 1 px so seams close.
- Terrain: jittered grid (cell 3.6), diagonal alternates per cell. Height = noise + a wall term that widens with z + dunes + a carved stream + a flat plateau under the masjid.
- Use the reference's sliver damping: long thin near faces that catch the sun become white streaks, so scale their key light by area over edge length.
- Water: quads at the water level, sorted behind terrain with a depth bias, or banks cut through them.
- Gotcha: near the camera the grid is coarse and shards of terrain and water read as broken ice along the bottom of the frame. Cell 3.6 and a narrow stream help; a lower camera or a distant ground would help more.
- Gotcha: the panel sits over the busiest part of the picture. Keep it dark glass at about 66 percent, never plain text on terrain.
- Perf: about 10 ms a frame for 12k triangles.

## Good for (examples, never limits)

Journeys, hardship then ease, a dark start that opens, guidance, a long road to a destination.

## References

- `references/prompt-low-poly.md`

## Working example

`assets/styles/low-poly.html`: a 10 s page (QURAN 94:5, "Some roads begin in a narrow, dark valley." then the dawn, the masjid and the verse).

`assets/styles/low-poly-birds.html`: a 10 s cut of The Wing (QURAN 17:24), four moments: a wing opens over a chick in the rain, the seasons turn and a fall is caught, a young bird flies out over the valley, a grown bird lowers its wing over the old one in the snow.

## Birds, tree, weather, camera (reuse from low-poly-birds)

The Wing pushed this style from a fly-through into a character story. Each piece is a plain function in the page, so a new reel copies what it needs:

- **World builders.** `blob` (jittered icosahedron: leaves, rocks, bodies), `limb` (tapered ring tube: branches, trunk, legs) and `quad`/`T` push flat facets into one triangle list, built once in `buildWorld` (valley, tree, nest, far trees).
- **Posable bird.** `birdTris(b,out)` builds a bird from a pose object: position, heading, scale, colours, and per wing `spread`, `flapA`/`flapP`, `curl`, `lift`. A wing over a chick is `spread 1, curl` high, `lift` low. `birdsAt(t)` keys every bird per beat.
- **Camera.** `makeCam(pos,tgt,roll,f)` is a look-at camera. `camAt(t)` eases between named shots; `catmull` gives a smooth flight path with a 180 degree turn at the top.
- **Light and seasons.** `env(t)` blends palette keys (sky, sun, ambient, fog, leaf colour by season), so one tree carries storm, blossom, summer, autumn, winter and dawn.
- **Weather.** `RAIN` (screen streaks plus splashes, `roofTaps` drumming on a wing), `SNOW` and `PET` (world particles that drift toward the lens), `MOTE` (light under a wing).
- **Focus.** `draw3D` paints the far pass to a second canvas that can be blurred for shallow focus, then the near pass sharp on top.
- **Speed.** About 4 tabs render 49 s in a few minutes; keep the far tree count and particle counts near the page's numbers.
