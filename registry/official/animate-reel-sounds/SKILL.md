---
name: animate-reel-sounds
description: "Part of the video library (loaded by animate-reel, not run directly): the reel kit's own sound effects (impacts, chips, keypresses, bells, thunder) and calm ambient beds (sea, rain, wind, forest, fireplace and more). Audio files only; no scripts."
user-invocable: false
---

# Reel sounds

Audio data for `animate-reel`: sound effects in `assets/sfx/` and calm unpitched beds in `assets/sfx/beds/`. `animate-reel`'s `mix.py` finds them next to its own folder.

## Use when

- `animate-reel` mixes a reel: a sound type such as `key`, `tick`, `glass` or `thunder`, or a bed named in a reel's `bed.txt`.

## Don't use when

- A user asks for anything else. This skill does nothing on its own.

## Steps

1. Do not read or play these files. `animate-reel/references/sound.md` says which sound suits which moment.

## Budget

- Read nothing from this skill.

## Output

- Nothing. The files are used by `animate-reel/scripts/mix.py`.

## Done when

- The pack is installed next to `animate-reel` (`aisle add animate-reel` installs it).
