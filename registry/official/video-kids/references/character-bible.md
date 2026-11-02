# The character bible

One file per character: `characters/<name>/bible.md`, where `<name>` is lower-case letters, digits and hyphens. `bible-check.mjs` reads it as plain text. Write each field on one line as `Key: value`; the "Never" list is a heading and bullets.

```
# Nour the turtle

- Name: Nour
- Species: turtle
- Shape language: round
- Palette: #3f9f6b, #f2c94c, #ffffff, #3a2a4d
- Outfits: a small red scarf in cold weather
- Catchphrase: "Slow and steady, side by side!"
- Personality: Gentle, curious and a little shy; she learns by trying things at her own pace.

## Never

- Never shouts at or teases anyone.
- Never takes something without asking.
```

## What each field is for

| Field          | Rule                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name, Species  | The name is new. The species may be common (turtle, fox); the character is not.                                                                            |
| Shape language | `round` (soft, friendly), `square` (steady, sturdy) or `triangle` (quick, bright). It sets the body and head the starter puppet draws.                     |
| Palette        | 3 to 5 colours as `#hex`. The first is the body, the second the accent (cheeks, shell), the third the belly. Two of them must differ enough to read (3:1). |
| Outfits        | What they wear, as words. The starter rig has no clothes; add them as parts.                                                                               |
| Catchphrase    | A short phrase for the `button` beat. Original: never a known show's line.                                                                                 |
| Personality    | One or two sentences. Kind by default.                                                                                                                     |
| Never          | At least two things the character never does. They keep later scripts consistent and gentle.                                                               |

## Originality

- Never recreate, resemble or wink at a known character, show, game or toy. `bible-check.mjs` refuses a list of well-known names found anywhere outside the "Never" list. It cannot know every character, so you also refuse a lookalike: the same species with the same colours and outfit as a famous one is a lookalike.
- If the user asks for a known character, say no in one sentence and offer to design an original with a new name, a different shape language and a different palette.
- Never base a character on a real child. A parent's child's drawing is not handled by this version.
