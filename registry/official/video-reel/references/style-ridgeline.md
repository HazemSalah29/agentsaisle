# Style: Ridgeline

Sixty stacked traces on black, each filled black so it hides the one behind, drawn as thin cream lines like a pulsar plot printed on rough stock. For a heart that races, the traces start as scattered noisy peaks and settle into one clean ridge that beats slowly. No figures.

## Look

- Stock `#050505`, ink cream `#F2F0EA`, 2 px lines. Print finish on every frame: ink-density mottle (multiply), warm stock lift and fibres (added), a soft ink spread copy, mono grain.
- A block 760 px wide, 60 traces 10 px apart, centred in the upper half. Text sits below it.
- Type: Baskerville italic 62 px for the hook, Scheherazade New 104 px cream for the Arabic (two lines), Baskerville 50 px, Menlo spaced capitals.

## Motion

- Traces plot one after another from the top, each swept left to right like a pen recorder with a pale nib.
- A pulse runs through the stack as a lub-dub shape, one row later per row so it travels. It starts fast (2.6 Hz) and slows to 1.1 Hz between 3.0 and 4.8 s while the peaks pull into one centre ridge.
- Arabic is written with the pen, line by line.

## How it explains

- Story device: Each white trace is one round of the idea; many traces stack into one ridge, so the story is repetition.
- Arrows and flow: A dashed target line or an arrow of light showing where a peak will slide.
- Labels and text: Small mono captions along the traces that type on.
- Numbers and counts: Sixty traces plot themselves one after another; the stack height is the count.
- Emphasis: A peak that glows, or a dashed target that the main peak slides over.
- Scene change: The camera pulls back from one magnified trace to the whole stack; no cuts.

## Build notes

- Peaks are gaussians per trace; `order` (0 to 1) moves the first peak to the centre and fades the rest. Fine noise shrinks with `order` too.
- The heartbeat phase is a closed form (linear frequency ramp), so frame(t) stays pure and the `tap` sounds are placed by scanning the same function.
- Print finish needs the whole canvas read back each frame (about 25 ms). The ink and stock textures are built once at full size.
- Gotcha, Arabic layers: strip only `[ٌ-ِ]` for the body layer, then cross-fade to the full text. Stripping sukun, shadda or fathatan shifts words. Even so, the stripped hamza of أَ sits a little differently, so never leave both layers on.
- Gotcha: Arabic lines need 115 px or more between baselines at 104 px or the marks touch.

## Good for (examples, never limits)

Heartbeats, remembrance, a pulse that steadies, anything that goes from noise to one clear signal.

## References

- `references/prompt-ridgeline.md`.

## Working example

`assets/styles/ridgeline.html`: a 10 s page (QURAN 13:28). "Some hearts race all day." then the peaks align and the verse is written.
