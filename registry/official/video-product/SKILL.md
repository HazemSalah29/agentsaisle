---
name: video-product
description: "Part of the video library, used by the video skill (not run directly). Make a fast product or launch edit from the user's own photos: camera moves, 2.5D parallax from a cutout, kinetic type, grain and glitch, cuts on the beat and original sound effects, rendered from HTML to MP4 on the user's computer. Don't use for generated people or characters, other people's photos or footage, or music the user has no right to."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Product edit

Builds a fast, polished promo edit (a launch, a drop, an ad, a trend-style cut) from the user's own product photos. It is motion design: the camera, parallax, type, grain, glitch and sound are made by code and rendered from HTML to MP4 by `video-core` on the user's own computer (Claude desktop app, Code tab, Local environment; Windows, Linux or macOS). It does not generate people, footage or characters. `<skill>` is the folder that holds this SKILL.md; `<video-core>` and `<video-qa>` are sibling skills.

## Use when

- The user wants a product, launch, ad or "trend" edit from photos of something they own or sell.
- They may add a reference edit to pace it like (analysed for numbers only), their own music, a price and a call to action.

## Don't use when

- The user wants generated people, characters or cinematic footage: this skill cannot make them. Say so and offer a plain explainer.
- The photos or music are not theirs to use. Ask them to confirm; never use another creator's edit, footage, photos, text or audio.
- The user wants it uploaded. The last step prepares a pack to post by hand.

## Steps

1. Get the inputs, asking for only what is missing: 2 to 6 photos (a plain background gives the best cutout), the product name (up to 30 characters), up to 3 short lines about it written by the user, an optional price and call to action, optional music with its licence. Never invent a claim, price or number. Read `references/inputs.md` for photo rules.
2. Pick a preset from `references/craft.md`: `snap` (fast launch), `glide` (premium, calm) or `glitch` (tech, street). If the user has a reference edit and the right to analyse it, run `video-analyze` first and pass its recipe with `--recipe`.
3. Ask the user to confirm that the photos and music are theirs to use, then run `node <skill>/scripts/plan.mjs --project projects/<slug> --photos a.jpg|b.jpg --preset snap --product "<name>" --lines "<one>|<two>" --cta "<text>" --price "<text>" --own-photos` (add `--music track.mp3 --music-licence "<why>"`; add `--screens` when the photos are screenshots of an app or site, which also takes `--accent #rrggbb`). It cuts out each product, writes the original sound effects and `video.json`, and says which photos had no clean cutout. A photo with no clean cutout is used as one layer; offer to try a plain-background photo.
4. Run `<video-core>/scripts/check.mjs`, `timing.mjs`, then `render.mjs --draft`, and `<video-qa>/scripts/qa.mjs`. Open `qa/contact-sheet.png` and judge it with the checklist in `references/craft.md`. Fix what fails by editing `video.json` (a shot's `camera`, `type` or `fx`) and re-render; at most 2 revisions, then show the user.
5. When it passes, render the final (without `--draft`), run QA again, show the MP4 path and the contact sheet, and offer the publish pack (`video-publish`). Never upload.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- Run each script once per revision. Do not read the cutout PNGs; look at `preview.png` and the contact sheet.

## Output

- The project folder, the preset, the shot count and length, which photos got a cutout, and the QA result.

## Done when

- `check.mjs` exits 0, `video-qa` passes, and the contact sheet passes the checklist in `references/craft.md`.
- Every word on screen came from the user, every asset has a licence in the credits, and nothing was uploaded.
