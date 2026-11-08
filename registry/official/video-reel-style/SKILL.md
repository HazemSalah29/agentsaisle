---
name: video-reel-style
description: "Step 3 of the /video-reel chain for the user's page: pitches two or three looks for the approved story from the style recipes (or a new mix), shows one key still per look drawn in its real style code, and records the picked look and palette. Use only when the /video-reel gate or video-reel-story hands off, or when the user asks to change or redo the look of a reel."
user-invocable: false
allowed-tools: Read Write Glob Grep Bash(node *) Bash(python3 *) Bash(bash *)
---

# Reel style
Picks how the reel looks, with one still per option, because three full builds were once all rejected when one still each would have caught it. Reads `script.md` (`## Treatment`, `## Copy`, `## What the viewer watches`). The look serves the picked treatment: its world, signature move and hero sequence must work in it. Shared rules: `<video-reel>/references/chain.md` and `<video-reel>/references/rules.md`, section "Direction".

A style is only a look: material, palette, texture, light, motion. Never tie it to its example props or topics; any style can draw anything the story needs.

## Use when

- `video-reel-story` hands off step 3, or the user asks to change or redo the look of a reel.

## Don't use when

- The copy is not approved yet.
- The user already named a look and only wants it built (go to `video-reel-storyboard`).

## Steps

```text
Style progress:
- [ ] 0 Rules read
- [ ] 1 Two or three looks pitched
- [ ] 2 One key still per look
- [ ] 3 Look picked, status: style done
```

0. **Read the rules first,** even when this step runs alone, because the numbers live only there. Read "Fixed for every reel" and "Brand constants" in `<video-reel>/references/chain.md`, and the "Direction" section of `<video-reel>/references/rules.md`. If the reel folder has no `rules.md`, copy it there. Done when read.
1. **Pitch.** First read the looks the user liked in `00 - notes/context/observed/taste.md`, and the Cinema night look in `references/look.md`. Pitch from those first. Never pitch Paper diorama or Sumi-e wash for a reel with human figures. If the user named a look in the question round, pitch only that one plus one contrast. Otherwise pitch two or three that differ in kind, not colour, from `<video-reel>/references/style-index.md` (each recipe has Look, Motion, How it explains, and a working page in `<video-reel>/assets/styles/`). A recipe's **Production readiness** line says whether the style has held a full reel; a `needs work` style can still be pitched, with its gaps named. Open `<video-reel>/references/look.md` for looks tried and the cinema night look; `references/prompt-` only when a recipe is not enough. Name the palette for each: never the page colours by default, and "pastel" means many pastel palettes. Done when each look has a name, a palette and one line on why it fits the story.
2. **One key still per look.** Draw the hero sequence's key moment (from `## Treatment`) in each look's real style code: start from the style's working page in `<video-reel>/assets/styles/`, never a quick sketch from zero, because flat from-zero sketches read as clip art, at 1080x1920, captured with `node <video-reel>/scripts/capture.mjs <folder> stills <t>`. Look at each at full size. The style pages show `@YOURPAGE`: swap it for `handle` from `00 - notes/context/declared/brand.md`. Done when every look has a still and none breaks a fixed rule (Islamic pages: no prophet drawn, no emblem or six-pointed star; every page: text clear of the Instagram zones).
3. **Record.** Write `## Look` in `script.md`: the style, the palette as hex values, the fonts, the texture, and the still's path. Set `status: style done`.

**Stop.** Show the stills side by side, with a pick. When the user picks, invoke `video-reel-storyboard` with the Skill tool. If none fits, return to step 1 with what they disliked. In bulk prep (`<video-reel>/references/chain.md`, Bulk prep), do not stop: write the question and the pick under `## Open questions` and go on.

## Budget

- Read only the files this step names; the rules live in `<video-reel>/references/rules.md`, so read the sections for this step, not the whole file.
- Run each script once per change and read its report, not its source.
- Do not re-read a file you just wrote or edited.

## Output

- One key still per pitched look, drawn in the real style code, and `## Look` in `script.md` with `status: style done`.

## Done when

- The user picked a look and the palette, fonts and texture are written down.
