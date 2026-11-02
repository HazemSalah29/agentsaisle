# Drawing details

Input: one PNG or JPEG up to 10 MB, a flat crayon, marker or paint drawing on plain paper, cropped close. Nothing is fetched or uploaded.

Privacy:

- `import` needs `--parent-ok`: a parent or guardian confirms it is the child's drawing and not a photo.
- The original, the trace and the marks live in `characters/<name>/private/` with a `.gitignore` of `*`. They are never named in `video.json`, credits or the rig.
- A picture is refused (and nothing kept) when a face is found, when there is no plain paper background (less than 40% paper-coloured), or when the colours blend like a photo (mean distance above 28 to the 6 traced colours). These numbers are working defaults, `TODO(verify)`, and the guard is not a guarantee: the parent confirms too.
- `forget --yes` deletes `private/`. `puppet.json` stays: it holds only vector shapes and flat colours.

What is traced: up to 24 flat colour regions, each an outline of at most 60 points, with the drawing's own colours. Fine detail, text and shading are lost.

`marks.json`:

```
{ "parts": { "body": ["r1"], "head": ["r2"], "arm-l": ["r5"], "arm-r": ["r6"], "leg-l": ["r3"], "leg-r": ["r4"] },
  "extras": [ { "id": "hat", "parent": "head", "regions": ["r7"] } ],
  "face": { "x": 0.5, "y": 0.14, "size": 0.34 } }
```

- Region ids come from `trace-sheet.svg`. Body and head are required; a missing limb becomes an invisible placeholder and is reported.
- `face` is where the eyes and mouth go, as fractions of the drawing (`size` is the face width). Eyes and the eight mouth shapes are drawn flat in the darkest colour of the palette.
- Left and right follow the picture (left is the left of the page).
