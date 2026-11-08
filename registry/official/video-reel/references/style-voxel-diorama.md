# Style: Voxel diorama

A floating voxel island: grass over earth over a rocky underside, a small domed masjid with a minaret, date palms, a pond and a well. The camera orbits it in orthographic dimetric view while the voxels rain down layer by layer. Toy-like and warm; no figures.

## Look

- Sky: `#ffe6c9` to `#fbd6b8` to `#f2c3a6`, a pale radial glow behind the island, blocky cloud clusters drifting in the back. Vignette `rgba(120,60,40,.18)` and a fine light and dark speckle grain on top.
- Island: grass `#9fcb55`..`#b9d65e`, topsoil `#d08a4f`, earth `#bd7548`, deep `#8d5a44`. Masjid walls `#f4ead8` over a `#e3d6c0` base, teal dome `#3aa093`..`#58c2b2` with a gold band `#e8b84a`, wooden door `#8a5a3b`, windows `#3b4766` that light to `#ffd98a`.
- Palms: trunk `#8a5a3b`, fronds `#5f9f42`/`#6fb04a`/`#7dbb52`, dates `#d9822b`. Water `#5ec7dc`, sand rim `#f2d49a`.
- Faces: top 1.0, +y 0.8, +x 0.64 of the base colour with a slight warm or cool tint. These stay fixed to the world, so shading is consistent as the camera orbits.
- Type: a rounded bold face (Arial Rounded) for English, Scheherazade New in brown ink for Arabic, on a cream card (`#fff4e2`) with a hard `#b89a80` offset shadow. The hook is block-pixel text.

## Motion

- Yaw orbits from 0.38 to 1.08 rad over the piece, scale 25.5 to 28, a small bob.
- Voxels fall 7 units over 0.32 s into place. Appear time = layer height (underside first) plus a hash, so the island builds upward; the masjid and palms follow.
- Hook: a block-pixel title builds left to right, each cell dropping in, then dissolves left to right as the Arabic starts.
- Windows and two lanterns light once the verse is read, with additive warm halos.

## How it explains

- Story device: One long voxel island the camera trucks along; each zone is rebuilt from falling voxels.
- Arrows and flow: A chain of little cubes in a line, pointing to the target.
- Labels and text: Pixel type on extruded block tags.
- Numbers and counts: Silkscreen numerals that tick on block tags; a voxel tower grows one cube at a time.
- Emphasis: A cube block glows or a tower is built taller than its neighbours.
- Scene change: The camera trucks to the next zone; the old zone crumbles into voxels.

## Build notes

- Store voxels in a typed grid; bake once at first frame: for each exposed face (top, +y, +x) the four vertex AO values (0..3 neighbours) and a ray-march shadow toward the light `[-.42,-.62,.66]`. Per frame only sorting and drawing remain (about 20 ms at 1080x1920).
- Faces with AO are drawn as 4x4 sub-quads shaded by a bilinear AO falloff; flat faces are one quad. Stroke each quad with its own fill, 0.5 px, so seams vanish.
- Depth sort by `(x*sin(yaw) + y*cos(yaw))*cos(elev) + z*sin(elev)` of the voxel centre. Keep yaw between 0 and about 1.3 rad so the three drawn faces are the visible ones.
- Dome = voxels inside a sphere above the roof; a gold ring on the lowest layer. Palm crowns need side voxels or they read as sticks.
- Block text: render the string at 13 px into a scratch canvas, threshold alpha, draw each cell as an extruded cube (right and bottom side faces darker, top lit, gradient by row).
- Gotcha: the title's last 9 columns never landed because the drop timing was tied to the text width. Run the drop front to `width + 9`.
- Gotcha: a minaret on the front corner hides the dome from the orbit angle. Put tall things at the back or the right.
- Gotcha: with scale 29 the underside reached the text card. At 1080 wide, keep scale near 26 and the island centre near y 655.

## Good for (examples, never limits)

Calm, homely ideas: hearts at rest, a place to come back to, building a life or a habit piece by piece, a verse with a masjid or a garden in it.

## References

- `references/prompt-voxel.md`

## Working example

`assets/styles/voxel-diorama.html`: a 10 s page (QURAN 13:28, "Where does a heart find rest?" and an island that builds, then lights its windows and lanterns).
