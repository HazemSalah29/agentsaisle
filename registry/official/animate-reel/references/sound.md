# Sound

## Contents
- The user's sound line, no hum, the bed
- Sound types (the `add()` table)
- Timing and layering
- SFX Kit (320 sounds)
- What strong pages do
- Sound moves
- ElevenLabs (optional)

The page pushes events with `add(t, type, gain)`. `scripts/mix.py` places a sample for each one, keeps its top end (only a 16 kHz hiss guard), lays a calm bed under the whole reel (never a hum) and keeps it passive (far away, steady, low, dipped under each effect), fades both ends and gives every reel the same fixed boost (`BOOST_DB` = 20, what the prophet-names reel got), never a loudness target; it only turns the mix down if a peak would pass -1 dB. The old -16 LUFS target boosted a reel more the fewer sounds it had: a sparse Roots mix got about 32 dB plus a limiter, and its soft sounds came out loud and sharp. Now a sparse reel is quieter overall and each sound stays as loud as in a busy one. `boom`, `rise` and `crack` are made in code, not read from a file.

**Loudest moment: -18 LUFS, never near -16.** No moment may go above -18 LUFS momentary loudness (the loudness over 0.4 s). This includes the one full hit at the end. A whole reel from -22 to -27 LUFS is good, so do not boost a reel to reach a target. Levels that worked on the Amanah reel: whooshes, swishes and risers at about -21; deep hits and rumbles at -20 to -22; the end boom at about -18; nature beds below -36 measured alone (felt, not heard). After every mix, measure the loudest moment of each event (`ffmpeg -i audio.wav -af ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=m.txt -f null -`) and lower its `v` in both the page and `sfx.json` until the reel follows this rule. Peaky deep sounds (impact, rumble, boom) already hit the -3 dB cap per sound, so a small cut to `v` does nothing; halve it and measure again. **The code-made `beat`, `boom` and `rise` hit that cap at any `v` above about .08** (`beat` peaks at .84, the cap is .07 before the boost), so `beat` at .4 and at .24 both measure -14.8 LUFS. Start them at the levels that passed on the science-and-quran reel (2026-10-27): `beat` .05 (about -19), a stronger `beat` .055 (-18.4), the end `boom` .045 with `rise` .05. Kit whooshes are not capped this way: `whoosh-slow-soft` at .19 measured about -21. Risers were the loudest surprises (-13.5 to -16 at `v` .3 to .4); start them at about .15 to .2.

**The user's sound line:** single hits, booms, risers, pings, beats and beat loops, nature beds and foley are all fine. Music that is haram is not used. Other sounds are welcome: add them to `assets/sfx/` and to the table in `mix.py`.

**No hum, ever.** Every reel before this date had a constant low hum in A under the whole mix, and the user found it irritating. It is gone from `mix.py`. Old reels and the 22 old style samples still carry it; they are not re-rendered unless the user asks.

**The bed is calm and soothing, picked per reel.** Write `bed.txt` in the reel folder as `<name> [gain]`, for example `sea .8`. No single sound sets the level of the reel: `mix.py` caps each sound on its own at -3 dB after the boost (a peaky `drop` once pulled a whole reel 18 dB quieter). When the scene changes, use one line per bed with a start time, `<name> <gain> <start_s>` (for example `rain 1 0`, then `air 1 11`): the mix crossfades them over 2 s. Names: `sea`, `rain`, `birds`, `crickets` (60 s loops in `assets/sfx/beds/`, cut from CC0 Freesound and Mixkit samples); `wind` (gusty), `breeze` (soft), `desert-wind`, `ocean` (gentle lapping), `forest` (misty calm), `jungle`, `insects` (evening insects and night), `fireplace` (cozy, steady) (added 2026-10-24: 60 s loops crossfaded from 3 to 6 [SFXMint](https://sfxmint.com/category/ambience) CC0 clips each; they are AI-made sound, which the user allows; the old wind is kept as `wind-v1`), `air` (soft unpitched breathing noise, the default when there is no `bed.txt`) or `none`. Match the bed to the scene: **sea or rain for soothing scenes** (mercy, comfort, ease, du'a); **wind for intense scenes** (the grave, warnings, the Day, hardship); birds for dawn, crickets for night. Pitched pads, drones and anything with a melody are out. A reel with its own `sound.py` follows the same rule.

Samples are Kenney CC0 sounds copied into `assets/sfx/`.

| Type | Sample | Use it for |
|---|---|---|
| `key` | keypress 1-6, rotated | each typed character |
| `tick` | chips-collide 1-4, rotated | a counter step, a bead, a day |
| `drop` | drop_001 | a soft line landing |
| `plink` | drop_002 | a small light coming on |
| `tap` | impactSoft_medium_001 | an Arabic word arriving, a scene cut |
| `thud` | impactSoft_heavy_002 | something stopping, a big shape landing |
| `bell` | impactBell_heavy_000 | the key word lighting, a count finishing |
| `bell2` | impactBell_heavy_003 | a second bell, the ending |
| `bong` | bong_001 | the hook's first beat |
| `slide` | card-slide-1 | a panel sliding in (passed the user's listen: not scratchy) |
| `glass` | impactGlass_light 0-4, rotated | a light ping: a milestone, a gate, a small light; the soft-reel stand-in for `beat` |
| `wood` | impactWood_light 0-4, rotated | a small wooden click: a marble or bead rolling, a piece settling |
| `boom` | made in code: pitch falls 54 to 36 Hz, 2 s tail, soft click | the full hit. `mix.py` plays only the LAST boom as a boom; every earlier one becomes a `beat` |
| `beat` | made in code: a round low thump, no click, no ring | a middle reveal (the word lights, the answer lands) |
| `rise` | made in code: noise sweeping 300 Hz to 4 kHz over 2.4 s, low-passed at 1.5 kHz so it is soft | only with the last `boom`: it ENDS at its time, so it leads into the hit. `mix.py` drops any other rise |
| `crack` | made in code: a bright noise snap and a short low rumble | lightning (`Elements.lightning` adds it with a `boom`) |
| `thunder` | thunder-1 to -6 (SFXMint CC0 rumbles, 4 to 6 s), rotated | a storm, the Day, a warning; intense reels only, never a soft one |

Gain defaults to the table in `mix.py`; pass a third argument to change one event. An event may also carry `pan` (-1 left to 1 right), for example a marble's sounds following it across the screen (`add(t,type,v,pan)`); without it each effect drifts gently (`PAN` in `mix.py`). Every effect gets a soft 1.8 s room echo (`ECHO`, 0.2 wet). The boost is fixed, so every number is a true volume: halve `v` or the bed number in `bed.txt` and that sound drops 6 dB. Keep `key` quiet: dozens of them stack up.

## Timing and layering

- **Sync is everything.** A sound starts on the exact frame its event appears, using the same times as the picture.
- **Sparse beats busy.** Only the big moments get a sound: about one every 3 to 5 s, so a 50 s reel has roughly 10 to 15. A viewer said the Roots reel (46 sounds in 50 s) was hard to listen to. Small moves stay silent.
- **One at a time.** No stacked pairs on one moment, and quiet gaps between sounds, with the bed clearly under them.
- **No scratches.** No scratchy sounds: pen, pencil, chalk and marker writing (`writing-*`), paper, fabric and plastic slides, scissors and tape. Card slides are fine: `slide` and `foley-card-slide` passed the user's listen (2026-10-24, "not sharp"). Everything else in the kit is allowed and picked per reel; prefer the soft variants in calm reels. Bright sounds (`faller-*`, `shimmer-*`, `glass`, `drop`) are allowed: a viewer called the reels high-pitched, but the user listened at the new lower level and found them fine (2026-10-25). Keep them sparse and watch later feedback. Pings, dings, clicks, whooshes and swishes only sounded sharp because the old mix turned them up about 32 dB and squashed them with a limiter; at the fixed level they are fine (the user listened: `swish-soft` and the zips "not irritating at all"). A scene move can also stay silent; the picture carries it.
- **Typing is welcome.** Soft key presses while text types on screen (the walyatalattaf reel, which the user liked). The typing of one line counts as one sound in the sparse count. Keep `key` quiet.
- **Drawing is silent,** or one soft whoosh as a line starts; the pen reveal gets no scratch. Counters tick only on the last few steps.
- **Score what lands:** a scene change, the key word (the biggest moment the reel's weight allows) and the closing line (a resolving sound). Labels and arrows get a sound only when they are the beat's main moment.
- **A silence before the turn.** Every reel has at least one near-silence (no effect, the bed dipped low or gone, about 0.6 to 1.5 s) just before its turn or its peak. The first sound after that silence is one of the most important sounds in the reel: put it on the turn itself. With a voice, the silence sits in the pause before the turn's line.
- **Sound carries a scene change.** At least once per reel with more than one place, let the sound cross the cut: start the next scene's bed or first sound about 0.5 to 1 s before the picture changes (in `bed.txt`, give the new bed a start time that early), or let the old scene's sound run on past the cut and fade. The ear moves first, so the cut feels like travel, not a jump.

Rotated files: `key` cycles `keypress-001.wav`, `keypress-002.wav`, `keypress-003.wav`, `keypress-004.wav`, `keypress-005.wav`, `keypress-006.wav`; `tick` cycles `chips-collide-1.ogg`, `chips-collide-2.ogg`, `chips-collide-3.ogg`, `chips-collide-4.ogg`.

## SFX Kit (320 sounds)

`assets/sfx-kit/` (index) is [wyzowl/sfx-kit](https://github.com/wyzowl/sfx-kit) (CC0, no credit needed): 320 WAVs in 28 categories, each with a sync point, timing, level and what it suits. Use it alongside the sounds above, in every reel. The wavs are in four CC0 packs (`animate-reel-sfx-1` to `-4`, installed with this skill); the index files stay here. If a pack is missing, pick a sound of the same feel from the packs that are installed, or use none, and tell the user in one line.

- **Pick:** read `assets/sfx-kit/catalogue.md` (one line per sound) and `GUIDE.md` (the on-screen moment to sound table). Check `use_for` and `avoid_for` in `sounds.json`. Prefer the `soft` and `subtle` variants for calm reels.
- **Use:** `add(t, 'kit:<id>', v, pan)`, with `t` the moment the sound must meet. `mix.py` starts the file `sync.at` seconds early, so its main transient lands on `t`. Place `t` by the kind of moment (`sync.meets`):
  - `instant`: the frame it happens (pops, impacts, ticks)
  - `move-peak`: the fastest point of the move; the middle of an ease-in-out move, about a quarter in on an ease-out (whooshes, swishes)
  - `arrival`: the reveal the build leads to; a riser ends there
  - `action-start`: the first frame of the action (writing, a count, a fill)
  - `release`: the frame something is let go
- **Level:** `v` defaults to 1.0, the file as it is, which sits level with `glass` and `plink`. The kit is loudness-matched, so for a softer sound pick the softer variant rather than a big cut in `v`.
- **Rate changes are not supported yet:** use the next length instead (fast, medium, slow).

**Cue map**, from the moment on screen:

| Moment | Soft or warm reel | Intense reel |
| --- | --- | --- |
| A fast transition or a moving element | `whoosh-fast-soft`, `whoosh-medium-soft`, `whoosh-slow-soft`, `swish-medium`, or silent | the `-medium` and `-hard` whooshes |
| Text, an icon or a card appears | typing (`key`) for text, `pop-small-in`, `appear-materialise`, `foley-glass-touch` | `pop-medium-in` |
| Something leaves | `appear-dissolve`, `reverse-whoosh-short-soft` | `appear-poof` |
| Before a major reveal | `riser-1s-soft` (only where the reveal earns it) | `riser-2s-soft` and harder risers |
| A title or graphic lands | `impact-light-soft`, `impact-medium-soft` | `impact-light-firm`, `impact-deep-hard`, `cinematic-drum-big`, `boom-hit-medium` |
| The final reveal or end card | `shimmer-short-soft`, `shimmer-medium-soft`, `tone-ding-mid` | `shimmer-medium-bright` |
| Pen, chalk and paper | silent, or one `whoosh-slow-soft` as the stroke starts; `props-page-turn` for a page. No `writing-*` scratch | same |

The weight rule above still holds: a soft reel gets no deep booms, cinematic hits or bass, from the kit or from code.

**Blocked: sounds that carry a melody.** The 14 logo stings (`sting-*`: chords, marimba runs, kalimba notes, plucked strings) and the five rising marimba notes (`tone-step-1` to `-5`) play a tune. `mix.py` refuses them (`KIT_BLOCK`) until the user allows them. Single notes (`tone-ding-*`) and shimmers are fine.

## What strong pages do

From 23 studied reels.

- **Their "beats" are single hits on picture moves, not a loop.** About 60% of hits in the two big reels land on a jump in the picture; the weak repeat had none.
- **One full hit, at the end only.** Other pages reuse one boom many times, but for this page the rise + boom on repeat is irritating and sharp. The middle reveals get a smooth `beat`; the ending beat gets `rise` + `boom` (the user liked it there with the heavy bell, `bell2`).
- **Or one soft ping per reveal** (the 14.4M reel), a lower ping for a second section.
- **Crisp top end.** The hits keep 1 to 2% of their energy above 7 kHz; the weak reels have none. Our mixer keeps it: it has no 7 kHz low-pass.
- **Loudness.** They sit at -14 to -15 LUFS. We do not copy that: the user wants a normal, calm level, and pushing a sparse reel that loud made soft sounds sharp.
- **No voice, no tune.**

Where to get more sounds (licenses and a shortlist in the study's `sources.md`): Freesound with the CC0 filter (previews need no login), Mixkit, the Kenney packs (CC0). Ear-check each one before use.

## Sound moves

Optional, like the moves in ideas.md.

- **Ticks follow the count, not the cut.** One `tick` per step of a counter, in a steady rhythm, matched to what changes on screen.
- **Silence just before the answer.** Drop everything, bed included, for a beat before the payoff lands, then hit it with one `bell`. The quiet makes the answer land. (One such silence per reel is now a rule: Timing and layering, "A silence before the turn".)
- **Loud hits with real quiet between.** Save the longest quiet for the closing verse. A middle with no hit for over about 15 s goes dead.
- **Swell before the end.** The bed rises a little into the closing line, then fades with the picture.
- **With a voice** (only when the user asks for one): the voice leads, the bed stays below -36 LUFS measured on its own and `mix.py` dips it about 10 dB more while the voice talks, so it only fills the pauses, and scene changes land in the pauses between sentences.
- **An ambience bed** (sea, wind, rain) under slow reading beats works on other pages and is inside the sound line. **Keep nature calm and passive:** wind, rain, birds, crickets, drips and other nature beds stay below -36 LUFS integrated, measured on their own. Birds at .38 gave -30.8. The first walyatalattaf mix had nature too loud as well. Measure the bed alone after any change to `bed.txt`.

**Match the weight to the reel.** A soft or warm reel (salaam, mercy, du'a, kindness) uses only light sounds: `glass`, `plink`, `drop`, `bell`, `bell2`, `tick`, `wood`, `tap`, `key`. No `beat`, `thud`, `bong`, `boom` or `rise` at all, not even at the end: on the salaam chain reel the deep "dommm" on each milestone was irritating in a reel that was not intense. Deep hits (`beat`, `boom` with `rise`, `thud`, `crack`) belong only to intense reels (the grave, warnings, the Day, hardship).

## ElevenLabs (optional)

Use it only when the reel needs it. It costs credits, so say what you will generate and how long it is, and wait for a yes before each paid call.

- **Access:** write a short Python script that reads `ELEVENLABS_API_KEY` from the user's shell and calls the ElevenLabs API, and run it with `python3 -I`. Never type, print or store a key yourself. If the key is not set, `/video reel start` step 5 saves it. Pick from the SFX Kit first; generate only when the kit lacks a sound the script needs.
- **A looping bed** when sea, rain, wind, birds and crickets do not fit the scene: Sound Effects v2 (`eleven_text_to_sound_v2`) with `loop: true`, up to 30 s (for example night wind over sand, a courtyard fountain). About 40 credits a second. Save it in the reel folder as `<name>.m4a` so `bed.txt` can name it (never inside `.claude/`: an update replaces that folder), and keep it quiet like the other beds.
- **One missing foley sound** when the SFX Kit has nothing close (mushaf pages, sand through fingers, a lantern flame). Unpitched sounds only.
- **Voiceover:** the story is narrated in English by a warm, human-sounding voice when the reel suits a voice. When the Arabic comes:
  - **Hadith Arabic** may be read by an Arabic voice. The text has full tashkeel and comes from the verified source. The user listens before posting.
  - **Qur'an** is never read by a computer voice. Use a real reciter's recording from quran.com, with its licence checked, or leave the verse silent on screen.
  - With a voice, the voice leads: the bed stays below -36 LUFS alone and dips about 10 dB more while the voice talks (see Sound moves). `mix.py` plays `<reel>/voice.wav` from 0 s when it exists, set so the voice's own loudest moment is -19.5 LUFS momentary.
  - **House voice:** the voice ID in brand.md (`voice_id`). If it is empty, list the user's ElevenLabs voices and let them pick one, then save it to brand.md. Settings: `eleven_v4`, stability 0.35, similarity 0.75, style 0.3, speaker boost on, speed 0.95. Stay on v4: professional clones are not tuned for v3.
  - **Always expressive:** a reel tells a story, so a plain, even read is wrong. Every take uses soft tags at the start of lines (`[softly]`, `[thoughtful]`, `[warmly]`), a few CAPITAL stress words, and "..." for short pauses.
  - **Arabic inside English:** write every Arabic word or phrase in the voice text in Arabic script with full tashkeel (`كَنُود`, `سُبْحَانَ اللَّهِ`), never in English letters. v4 is multilingual, so the same voice switches to real Arabic sounds for those words and back to English after ("kanud" in English letters comes out American). Write "Allah" in the voice text as `اللَّه`, with no pronunciation dictionary; captions on screen still say "Allah". Listen to each Arabic word once before the render.
  - **Making the take:** call `text-to-speech/<voice>/with-timestamps` so every word has a time. v4 takes a few soft tags (`[thoughtful]`, `[serious]`, `[softly]`, `[warmly]`) and CAPITALS for stress, and does not read them aloud (check with a transcript). It has no pause tags, so add the pauses between lines afterwards: cut at the quietest point between lines, add quiet, and write `voice.wav` plus the phrase times the page reads.
- **Not used:** Music and Video to Music (they make tunes), avatars and lip sync, pictures of people, and **any AI video at all**.
