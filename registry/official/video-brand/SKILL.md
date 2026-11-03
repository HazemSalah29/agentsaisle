---
name: video-brand
description: "Part of the video library (loaded by /video, not run directly): create and check the brand file (colours, font, logo, caption style)."
user-invocable: false
allowed-tools: Read Write Glob Bash(node *)
---

# Video brand

Writes and validates `brand/brand.json` in the studio folder. Every other video skill reads it. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- The user has their own colours, font, logo or caption defaults, or a project needs a consistent look (`init` or `check`).
- A render shows wrong colours or a missing font.

## Don't use when

- The user wants an intro or outro stinger or lower thirds: not built yet (the check says they are ignored).
- The user wants a logo designed. Use only a logo they supply, one they have the right to use.

## Steps

1. New brand: `node <skill>/scripts/brand.mjs init <studio> [--bg #hex] [--fg #hex] [--accent #hex] [--font Name]`. It refuses colours that fail contrast and fonts that do not exist.
2. Fonts: files go in `<studio>/brand/fonts/` (woff2, woff, ttf or otf; the file name is the font name). Only use fonts the user has a licence for (OFL fonts such as Inter, Cairo, IBM Plex Sans Arabic are fine). At most 2 typefaces.
3. Logo: a png, svg, jpg or webp inside `brand/`, referenced as `"logo": "logo.svg"`.
4. Always finish with `node <skill>/scripts/brand.mjs check <studio> [--lang ar]`; fix each ERROR and weigh each warning.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run `check` once after the last edit; do not open font or logo files.

## Output

- The path of `brand.json`, the colours with their contrast ratios if asked, and the check result.

## Done when

- `brand.mjs check` exits 0 and the user has the font and logo files they need in place.
