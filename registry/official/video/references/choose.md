# Choosing the format

Four formats, each a chain of parts with a tested look. Match the user's words to a row; if two fit, take the more specific one.

| The user wants ... (cues)                                                                                                 | Format                                | Chain                    | Needs from the user                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| to explain an idea, algorithm, API, tool or trade-off ("explain how X works", "a short on X", "X vs Y")                   | Explainer                             | `references/explain.md`  | the topic; audience if not obvious; sources for any number                |
| a hot take, a tip, a motivational or announcement short, a quote, "make words pop", "hype video", "launch teaser"         | Kinetic                               | `references/kinetic.md`  | the message (or the topic, and you write the lines), a colour preset      |
| a demo or showcase of their own app or site, "show off my product", "walkthrough of my app"                               | Showcase                              | `references/showcase.md` | the app's local address (or their own screen recording), 3 features       |
| a motion-graphics reel or animated lesson for their page, a carousel, "/video reel", "make a reel", "story with a lesson" | Reel                                  | `references/reel.md`     | the source (a link, book page, hadith or ayah), the page's name and voice |
| an explainer that should hit harder                                                                                       | Explainer, with 1 or 2 kinetic scenes | `references/explain.md`  | as explainer                                                              |
| a launch video for an app                                                                                                 | Showcase, kinetic hook and close      | `references/showcase.md` | as showcase                                                               |
| cartoons, characters, AI footage, editing their footage, dubbing, long videos                                             | Not offered                           | say so in one sentence   | offer the nearest of the three                                            |

Defaults when the user did not say: vertical 9:16, 30 to 45 seconds, English, preset `volt`, voice `am_michael` at speed 1.1, captions `pop`, the generated music bed.

## Format in one line each

- **Explainer**: one idea, shown working. Hook title, then each step of the mechanism as its own scene (code, diagram, simulation, chart, list), then the takeaway and one call to action. Captions on.
- **Kinetic**: the voice is the video. Every word slams in on its syllable, key words in the accent colour, a full-colour slab every third beat for rhythm. No captions (the words are the picture).
- **Showcase**: the real app, recorded from a script, with the camera following the action, callouts naming each benefit, a kinetic hook before and a slab close after.

The user's own colours, font and logo go through `video-brand` (one `brand/brand.json` for the whole studio); a preset is the fallback.
