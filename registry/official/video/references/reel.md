# Reel

A motion-graphics Instagram reel (or carousel) for the user's own page, made from a checked source. It has its own studio folder, notes and steps, so it does not use `video-core`'s Remotion engine.

## When

The user says reel, "animated lesson", carousel, "made-up story that teaches X", or types `/video reel`. If they want a short explainer, kinetic-type or app demo, use those formats instead.

## How

1. Read `<video-reel>/SKILL.md` (a sibling skill) and follow it from its Steps. Pass along what the user said as the source or idea.
2. `video-reel` runs its own checks (`scripts/studio.mjs doctor`), keeps its own studio folder (`00 - notes`, `03 - export`) and ends at the MP4 and caption. Do not run `pipeline.mjs` or `doctor.mjs` for a reel.
3. Subcommands the user may type: `/video reel start`, `ideas`, `today`, `save`, `review`, `carousel`, `bulk <ids>`.

## Needs from the user

The source (a link, a book page, a hadith or ayah on an Islamic page), their page's name and voice (asked once), and a yes at each of the five stops. Sounds come from the installed packs; nothing is downloaded and nothing is uploaded.
