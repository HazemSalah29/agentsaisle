# Variants: one reel in other styles, side by side

Optional step 5c. Use it when the user asks to see the reel in other styles before rendering. The first version stays the source of truth for the copy, timing and sound. Each variant changes only the look, and the motion that the look needs.

## How to run it

1. Finish the first version and its preview (step 5) first.
2. Fill in the brief below once: the reel folder, the beat list with seconds, every caption word for word, the end beat, and the sound weight.
3. Start one fresh subagent (general-purpose, never a fork: a fork carries the whole chat, about 300k tokens each) per style, all in one message, so they run at the same time. Give each one the filled brief plus its style name and its folder: `<reel>/<style-slug>/`.
4. When they report back, look at their stills yourself first (a helper's "checked" can miss an overlap, a clipped Arabic line or a broken marks rule) and send fixes back to the same helper. Then start one preview server per variant on its own port (`preview.mjs <folder> 4171`, `4172`, ...) and give the user every link.
5. When the user picks one, render only that folder. Move the variant folders the user did not pick to the Trash, but only after the user says yes.

Two variants built in parallel take about 3.5 minutes.

## The brief (fill in the angle brackets)

```
# Brief: build one style variant of the <slug> reel

You build ONE alternative look of a reel that already exists. Same story, same words, same timing,
same sound rules. Only the look (and the motion that the look needs) changes. The user compares
the versions side by side in a live preview, then picks one to render.

## Read first (do not edit these)

- The finished first version, your source of truth for copy, timing and sound: <reel>/index.html
- script.md in the same folder (the verified source).
- <animate-reel>/references/chain.md (fixed rules, brand constants).
- Your style recipe and its working page: <animate-reel>/references/style-<style>.md and
  <animate-reel>/assets/styles/<style>.html.
- <animate-reel>/references/sound.md (sound types, `pan`, the "Match the weight" rule).
- <animate-reel>/assets/styles/pen-stroke-calligraphy.html for the Arabic pen reveal.

## What to build

Create <reel>/<style>/index.html. Copy into that folder <animate-reel>/assets/ScheherazadeNew-Regular.ttf
and the first version's bed.txt. Create no other files except stills/ from capture. Do not touch
the first version's files.

Keep EXACTLY from the first version:
- DURATION <n> and the beat timings: <beat list with seconds>.
- Every caption, word for word (copy them from the first page).
- The Arabic <text>, written with the pen <start> to <end> s, Scheherazade New, whole string, never split per letter.
- The end beat: <call to action>, then the page handle (from `00 - notes/context/declared/brand.md`) near y 1420 and "Follow for more", on <palette>.
- The same sound plan: <sound weight: light sounds only, or the intense set>. Use add(t,type,v,pan);
  give moving things a pan that follows their x position ((x-540)/540*0.7). Adapt the sounds to
  your style's motion, at the same moments and with the same softness.

Reimagine the main device in your style. It must still show <what the story needs to show>.

## Hard rules

- window.frame(t) is a pure function of t (no hidden state, no Math.random, seeded PRNG only),
  window.SFX, window.DURATION, window.SIZE, window.ready=true after fonts load (await
  document.fonts.load for Scheherazade). Same page format as the first version.
- 1080x1920. All text between y 250 and y 1500.
- No six-pointed star (hexagram) or Israeli symbol anywhere. Normal 5-point stars are fine.
- Never draw a prophet or a companion.
- No em dashes anywhere, including code comments. No network, no CDN.
- Pace: each line stays at least 0.2 s per word plus 0.7 s.
- Do not run git. Do not delete anything. Do not start a preview server (the main agent does that).

## Check it

node <animate-reel>/scripts/capture.mjs <your-folder> stills <times, one per beat>
Look at every still. Crop the Arabic and check every dot sits on its letter, and that no caption
or tag touches it. Fix and recapture (at most 2 fix rounds). For WebGL also confirm the stills are not black.

## Report (short)

Folder path, one line on how the main device is shown in your style, anything that does not work yet.
```
