# Style: Sumi-e ink wash

**Production readiness:** needs work (the moon is a flat grey disc, the bottom mist band is hard-edged, and there are no figures or places; strokes are the strength)

Black ink on rice paper, drawn one brush press at a time: a leaf is a single stroke, thick where the brush lands and dry where it lifts. Pale grey washes make the moon and the mist, most of the sheet stays empty, and one red seal stamps down last. After the Japanese and Chinese ink-wash tradition; see References.

## Look

- Paper `#efe8d8` with a warm radial lift, seeded fibres and flecks (built once). Nothing on the sheet is white.
- Ink `#16140f` for the key strokes, wash grey `#7a766c` / `#6b675e` for back leaves and secondary text, pale wash `#a9a498` for the moon.
- Moon: a blurred grey disc with a darker ring (wet edge), a thin paper-coloured cloud wash drifting across it.
- Hills: three low layers at the bottom that fade from nothing at the top to dark ink at the base (bokashi), plus a paper-coloured mist band.
- Type: Baskerville in ink for hook lines (second line in grey), Scheherazade New large in ink for the Arabic, Menlo grey for the citation.

## Motion

- Weight: a brush has weight but no bounce. Strokes use `zeta` 1 (a hard ease-out with a slight press at the start). Washes bloom with `1 - exp(-age * k)`. Nothing springs.
- Camera: a slow horizontal travel along the paper like a scroll being unrolled, or a very slow push toward one mark. It never cuts, rotates or zooms fast, and the paper moves with the camera.
- Enter: a stroke is drawn on by its own path, thick at the press and dry where it lifts, each leaf a separate press with its own ease. A wash blooms in by radius and opacity over about 1.8 s. Leave: ink fades slowly like drying, or a pale wash passes over it.
- Natural transformations: a single stroke becomes a branch, then leaves, one wash grows into a moon or a hill, mist thickens and covers a mark, a blot spreads along paper grain.
- Transitions: a wash spreads and the next scene is drawn on the blank it leaves; the scroll travels along the paper to the next sheet; one stroke carries on across and becomes the next object.
- Timing feel: unhurried, with space. Strokes about 0.3 to 0.4 s apart, never one long take. Most of the sheet stays empty and the holds are long.
- What never moves: the paper, the margins, the type (and no red seal or stamp). Mist and hills only breathe a few pixels on slow sines.
- Limit to know: give the moon some tonal depth (a faint rim and mottling) and soften the bottom band before it carries a longer reel.

## How it explains

- Story device: A wash painting built from an empty sheet: moon first, then one branch, then each leaf as its own press.
- Arrows and flow: A loose brush stroke that fades along its length, never a hard arrowhead.
- Labels and text: Serif ink lines for the hook (second line in grey), large Arabic in ink; no seal or stamp.
- Numbers and counts: Leaves appear about every 0.34 s, so the count is the number of pressed strokes.
- Emphasis: The key line goes darkest ink while the rest stays in grey wash.
- Scene change: The paper stays; hook lines fade away, the Arabic is written, and the mist drifts on.

## Build notes

- A stroke is a Bezier plus a width function. Stamp discs along it at 140 steps up to progress `p`. Branch width is `0.35 + 0.65 * sin(pi u)`; a leaf is `sin(pi u)^0.8` so it is pointed at both ends.
- Dry brush: in the last 12 percent of a stroke, replace the solid disc with 7 small bristle dots offset across the width, each bristle giving out at a different `u`. Do this later than you expect: at 20 percent the tails look like claws.
- Wet bleed: draw every stroke onto an offscreen ink canvas, composite that canvas once blurred at 30 percent opacity, then once sharp. One blur per frame is cheap.
- Tone: back leaves in grey at 85 percent opacity. A full black cluster looks like a smudge; two tones read as depth.
- Paper grain uses a seeded hash, so every frame is identical for the same `t`.
- Gotcha: `ctx.filter` blur is Chrome-only; capture uses system Chrome, so it is fine here.
- Gotcha: Arabic written on in ink needs a mask edge; clear it to `none` when done (a mask clips text-shadow).
- Keep the branch and moon above y 650; text block starts at y 930.

## Good for (examples, never limits)

Patience, gentleness, restraint, a single careful act (QURAN 18:19 "let him be cautious"), anything that cannot be redone.

## References

- https://japanobjects.com/features/sumie - tone from dilution and pressure, loaded-side brush, leaves spaced from the branch, "the art of suggestion" (opened)
- https://freebeat.ai/ugc/en/collection/sumi-e-animation - restrained brushwork, negative space, atmospheric movement (from search, not opened)
- https://morphic.com/resources/videos/ink-wash-animation-videos - one subject, wide empty space, one slow move (from search, not opened)
- https://pro.imdb.com/title/tt0287737 - "Sumi-E", 1976 brush-ink animation short (from search, not opened)
- Pinterest search for sumi-e with a red seal: fetch blocked, nothing seen

## Working example

`assets/styles/sumi-e-wash.html`: a 10 s page in this style with QURAN 18:19. Read it for the techniques; do not reuse its layout as a template.
