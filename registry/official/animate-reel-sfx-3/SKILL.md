---
name: animate-reel-sfx-3
description: "Part of the video library (loaded by animate-reel, not run directly): CC0 sound-effects pack 3 of 4 (SFX Kit by wyzowl, categories: data, mechanical, phone, risers-and-fallers, shimmers, swishes-and-zips, whooshes). Audio files only; no scripts."
user-invocable: false
---

# Reel sounds 3

Audio data for `animate-reel`: part of the SFX Kit (CC0, no credit needed, by wyzowl) kept in `assets/sfx-kit/sounds/<category>/`. `animate-reel`'s `mix.py` finds the files next to its own folder; the catalogue and sync points are in `animate-reel/assets/sfx-kit/`.

## Use when

- `animate-reel` mixes a reel and a picked sound is in this pack's categories.

## Don't use when

- A user asks for anything else. This skill does nothing on its own.

## Steps

1. Do not read or play these files. `animate-reel` picks sounds from its catalogue and `mix.py` reads them.

## Budget

- Read nothing from this skill; the catalogue lives in `animate-reel/assets/sfx-kit/catalogue.md`.

## Output

- Nothing. The files are used by `animate-reel/scripts/mix.py`.

## Done when

- The pack is installed next to `animate-reel` (`aisle add animate-reel` installs all four).
