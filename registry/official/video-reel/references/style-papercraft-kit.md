# Style: Papercraft kit

Printed-cardstock model kits on a green self-healing cutting mat: flat templates with dotted fold lines and glue tabs that fold themselves up into 3D models, hairline seam gaps, a warm key light, soft shadows, and a wood desk at the edges. Everything moves on twos, like stop-motion. Built for objects that suit a reel (a lantern, a dome building, a date palm, a book stand); no robots or animals with faces.

## Look

- Mat `#2d6c4e` over a walnut desk, a printed 1 cm grid with bolder 5 cm lines and 45 degree guides, healed knife cuts, paper offcuts, far mat softly out of focus. Palette: card `#f5f0e4`, blue `#2f6db3`, yellow `#f4b630`, orange `#ee6b2d`, ink `#22252d`, teal body `#1f6b6a`.
- Light `[-.55, 1, -.5]`, a warm key and cool fill: each face is multiplied by `.6 + .08 ny + .52 lambert`. Paper fibre multiplied over every face, a thin pale edge on every cut, ambient occlusion where walls meet the mat.
- Units are millimetres. Prints are drawn in 0.1 mm units on each face (`print(ctx, w*10, h*10)`).
- Type: Arial Rounded bold for the cards, Menlo for the kit labels ("LANTERN KIT No.07", part numbers), Scheherazade New for the Arabic.

## Motion

- The lantern body is a cross-shaped net that folds in 1.8 s (walls hinge down off the top, the bottom folds under last). The cap plate drops on, the four roof triangles open from lying flat on the cap up to a pyramid, a finial cube and a ring drop on. All poses are re-quantised to 12 fps, with a hair of jitter per touch.
- The hook card folds up from flat. When the lantern lights (windows go from dark to amber, a warm glow spreads over the mat) the card folds away and the verse card folds up.
- The camera slowly pushes in. The final read holds with only the glow breathing.

## How it explains

- Story device: One cutting mat; flat printed templates fold themselves up into each prop as the camera slides over.
- Arrows and flow: A creased paper strip that unrolls along the mat to its target.
- Labels and text: Tent tags dropped onto the things they name.
- Numbers and counts: Printed tent cards that are re-posed for each count.
- Emphasis: A small red paper flag pops up on the key object and spins to green when it is resolved.
- Scene change: The camera slides along the mat from beat to beat; pieces fold flat to leave and fold up to arrive.

## Build notes

- Reuse the engine: faces as hinge trees (`mkF`, `attach`, `fromPts`, `xf`), `box()` for the folding body, `tent()` for cards, `renderScene()` for the mat, shadows, painter sort and finishing. A page hook (`window.__glow`) lets a scene add light after the faces are drawn.
- Print canvas y runs downward and the face normal is `cross(ex, ey)`; the world is left-handed (x right, y up, z away). A visible face needs a normal toward the camera, or it is drawn in the plain back colour.
- Camera gotcha: tall models near a low camera blow up. At `F = 1000`, `D = 50` the camera sat only 40 mm above the table and the roof filled the screen. Use a long lens: `F = 2300`, `D` 128 to 190 (about 12 to 18 px per mm), pitch 0.95 rad.
- Extend the mat: the stock mat is 100 mm deep and the desk shows in portrait. Set `MZ0 = -105`, `MZ1 = 140`, `MX0 = -150` and make the texture taller (`TZ0 = -125`, `TD = 355`).
- Roof triangles: a flap that opens from lying inward on the top face is `apex = M + o*slant*cos(a) + up*slant*sin(a)`, with `a` going from pi (flat inward) to `pi - atan(roofH/halfWidth)`. Give them a `bcol` and `bprint`, or the back side shows plain grey while they swing through vertical.
- Layout for portrait: model high on the screen, cards low and far from the model's footprint. Compute screen y for the model's top and the card's ridge before placing (a few lines of projection).
- Rename the engine's vector `add` (it clashes with the page's `add(t, type, v)` sound helper).
- Arabic uses the stripped-body pen reveal, aligned word by word. About 40 ms a frame.

## Good for (examples, never limits)

Craft, assembly, step by step making, a lit lantern for remembrance and guidance, mosque-like domes, date palms, a book stand for knowledge.

## References

- `references/prompt-papercraft.md`

## Working example

`assets/styles/papercraft-kit.html`: a 10 s page (QURAN 13:28): a lantern kit folds up, "still dark inside.", it lights, and the verse is written on a card. It is one self-contained file (engine plus scene). Read it for the techniques; do not reuse its layout as a template.
