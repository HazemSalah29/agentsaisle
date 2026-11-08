# Style: Star chart

A deep-space chart: a layered nebula, twinkling stars, and fine gold and cyan line-work on top (a graduated degree ring, dotted orbits with small chevrons, markers, leader lines, italic labels). The chart shows relations between a few bright dots. Stars are round dots or 4 and 8-point glints only. Never a six-pointed star, never constellation figures of people or animals, never zodiac.

## Look

- Sky `#03040b`; nebula built once from layered fbm (teal, violet, rose and a little gold, dark dust lanes) in a diagonal river across the upper sky, so the lower part stays dark for words.
- Stars: baked far stars (denser along the river), 520 twinkling mid stars, 46 near stars with soft glow sprites. Slow parallax drift.
- Chart ink: gold `[230,198,128]` and cyan `[160,226,236]`, 1.3 to 1.6 px lines, degree ring with ticks every 2, 10 and 30 degrees and numerals every 30. Labels in Baskerville italic with a dark halo.
- Souls: soft glow sprites with a crisp white core. Gold for the ones drawn together, cyan for the ones that drift apart.
- Words: cream Baskerville over a soft dark backing gradient, Arabic in pale gold with a faint glow, citation in Menlo spaced capitals.

## Motion

- The ring draws round, two dotted orbits crawl, a bright round star with a 4 + 4 glint fades in.
- Two lead souls get markers, drift to each other, a dotted line joins them and a ring pulses where they meet.
- Later two more pairs close in (gold dotted lines), then two neighbours leave on cyan dotted arrows. Leader lines and labels ("drawn together", "drift apart") land with the matching English line.
- Arabic written with the pen over three lines; the English lines arrive one by one.

## How it explains

- Story device: One chart over deep space; ideas are bodies on it, a ringed planet with moons for the main thing.
- Arrows and flow: A chart beam from one star to another, or a constellation line that draws itself between points.
- Labels and text: Syne-style figures over graduated scales; small chart labels beside the stars.
- Numbers and counts: Big numbers over sextant-style scales; stars join a constellation one at a time as the count grows.
- Emphasis: A star that turns red with a ring marker, or the constellation flaring when complete.
- Scene change: A warp streak changes scene, or the camera tilts up to a higher chart.

## Build notes

- Everything is positioned from `t` with `ease`: each soul has a start, an end and a time window, plus a tiny sway that fades as it arrives.
- Gotcha: the reference's `spikeStar` is built from 8 rays, which is fine (4 long, 4 short). Never use 6.
- Gotcha: a hard-edged backing rectangle under the text shows as a band. Use one vertical gradient that fades in and out.
- Gotcha: leader lines must end at the label, not at the ring.
- Gotcha (font): check the Arabic dots on a full-size crop with a pixel count (see the note in nouveau-card).

## Good for (examples, never limits)

Souls, hearts, people drawn together or apart, du'a, night, remembrance, the vastness of creation, anything about relations or distance.

## References

- `references/prompt-cosmic.md`

## Working example

`assets/styles/star-chart.html`: a 10 s page (SAHIH MUSLIM 2638, souls like gathered troops). Canvas 2D, nebula and stars cached.
