---
name: video-reel-sfx-4
description: "Part of the video library (loaded by video-reel, not run directly): CC0 sound-effects pack 4 of 4 (SFX Kit by wyzowl, categories: celebration, cinematic-hits, interface, money, reverse-whooshes, tones, writing-and-drawing). Audio files only; no scripts."
user-invocable: false
---

# Reel sounds 4

Audio data for `video-reel`: part of the SFX Kit (CC0, no credit needed, by wyzowl) kept in `assets/sfx-kit/sounds/<category>/`. `video-reel`'s `mix.py` finds the files next to its own folder; the catalogue and sync points are in `video-reel/assets/sfx-kit/`.

## Use when

- `video-reel` mixes a reel and a picked sound is in this pack's categories.

## Don't use when

- A user asks for anything else. This skill does nothing on its own.

## Steps

1. Do not read or play these files. `video-reel` picks sounds from its catalogue and `mix.py` reads them.

## Budget

- Read nothing from this skill; the catalogue lives in `video-reel/assets/sfx-kit/catalogue.md`.

## Output

- Nothing. The files are used by `video-reel/scripts/mix.py`.

## Done when

- The pack is installed next to `video-reel` (`aisle add video-reel` installs all four).
