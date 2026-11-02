# The puppet rig

`characters/<name>/puppet.json` is plain data. `puppet.mjs scaffold` writes a starter from the bible; edit it freely and run `puppet.mjs check` after each change.

```
{ "name": "nour", "box": {"w": 300, "h": 400}, "palette": ["#..", "#..", "#.."],
  "parts": [ { "id": "arm-r", "parent": "body", "pivot": [210, 218], "svg": "<line x1=.../>" }, ... ] }
```

- Every part is a small piece of SVG, drawn in the box's own coordinates (the box is 50 to 2000 pixels each way; the feet sit at the bottom edge).
- `parent` makes a part follow another (the head, arms and legs follow the body; eyes, brows and mouths follow the head). `pivot` is the point a part turns around (the shoulder, the hip, the neck).
- Parts draw in list order, a parent first and then its children on top. A part with no parent that is listed first sits behind the body (the starter's turtle shell does).

## Parts that must exist

`body`, `head`, `arm-l`, `arm-r`, `leg-l`, `leg-r`, `eyes-open`, `eyes-closed`, and one mouth for each shape: `mouth-rest`, `mouth-a`, `mouth-e`, `mouth-o`, `mouth-u`, `mouth-mbp`, `mouth-fv`, `mouth-l`. Optional: `brows` (they move with the mood). Add as many extra parts as you like (ears, a tail, a hat), up to 40.

| Mouth shape | Looks like                    | Made by letters like     |
| ----------- | ----------------------------- | ------------------------ |
| `rest`      | closed, relaxed               | silence                  |
| `a`         | wide open                     | a, Arabic alif, ayn, haa |
| `e`         | wide and flat (teeth showing) | e, i, s, t-sounds        |
| `o`         | round and open                | o                        |
| `u`         | small and round               | u, w, r, Arabic waw      |
| `mbp`       | lips pressed together         | m, b, p                  |
| `fv`        | top teeth on the lower lip    | f, v                     |
| `l`         | open with the tongue up       | l, n, t, d, th           |

## The shaded look

`scaffold` draws a rounded, shaded character by default (`--flat` gives the plain one). The volume comes from gradients kept in the rig: `"gradients": { "skin": { "type": "radial", "fx": 0.35, "fy": 0.3, "stops": [{"o": 0, "c": "#hex"}, {"o": 1, "c": "#hex", "a": 0.5}] } }` (up to 16 gradients, 2 to 6 stops each, positions 0 to 1 across the shape; `a` is opacity). A part uses one as `fill="url(#g:skin)"`; a name the rig does not define is refused. Limbs are closed capsule paths, not stroked lines, because a gradient cannot paint across a line of no width. A soft `shadow` part under the feet and white `gloss` ellipses give the rest. This is a pseudo-3D illustration look, not a 3D model.

## What the checker allows

Only these SVG shapes: `g`, `path`, `circle`, `ellipse`, `rect`, `line`, `polyline`, `polygon`; with number attributes (each written once), `fill` and `stroke` as `#hex`, `none` or `url(#g:name)`, simple `transform`, and `d` or `points` made of numbers. No scripts, links, images, text, styles, filters or entities, and no gradient defined inside a part (they live in the rig). Each part is at most 3,000 characters; the whole rig at most 60,000. A user's own SVG goes in as parts the same way: split it into the required parts, then run `check`.
