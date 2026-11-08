---
name: video-reel-sounds
description: "Part of the video library (loaded by video-reel, not run directly): the reel kit's own sound effects (impacts, chips, keypresses, bells, thunder) and calm ambient beds (sea, rain, wind, forest, fireplace and more). Audio files only; no scripts."
user-invocable: false
---

# Reel sounds

Audio data for `video-reel`: sound effects in `assets/sfx/` and calm unpitched beds in `assets/sfx/beds/`. `video-reel`'s `mix.py` finds them next to its own folder.

## Use when

- `video-reel` mixes a reel: a sound type such as `key`, `tick`, `glass` or `thunder`, or a bed named in a reel's `bed.txt`.

## Don't use when

- A user asks for anything else. This skill does nothing on its own.

## Steps

1. Do not read or play these files. `video-reel/references/sound.md` says which sound suits which moment.

## Budget

- Read nothing from this skill.

## Output

- Nothing. The files are used by `video-reel/scripts/mix.py`.

## Done when

- The pack is installed next to `video-reel` (`aisle add video-reel` installs it).
