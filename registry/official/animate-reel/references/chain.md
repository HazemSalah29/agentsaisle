# The reel chain: rules shared by every step
The entry point of the reel chain. It makes a reel for the user's page, from a checked source. It asks the questions once, then runs each step skill in order. Every step ends at a stop where the user approves, because building before agreeing wasted whole renders. Only the way a reel is made is fixed: the story, the look and the motion are new for every reel, and every move, style or screen in this skill is a toolbox, never a limit.

Read the niche from 00 - notes/context/declared/brand.md.

The `niche:` key is islamic, faceless, business, personal or other. A rule marked "Islamic pages" applies only when `niche: islamic`; every other page uses the plain rule written next to it. For every niche, the handle, comment word, colours, hashtags and voice come from the same file.

## The chain

| Step | Skill | Ends when | Writes into the reel's `script.md` |
|---|---|---|---|
| 1 | `animate-reel-topic` | Sources recorded from the primary page | `## Sources`, `status: topic done` |
| 2 | `animate-reel-story` | The user approved the copy | `## Copy`, `status: story done` |
| 3 | `animate-reel-style` | The user picked a look | `## Look`, `status: style done` |
| 4 | `animate-reel-storyboard` | The user approved the storyboard (and the voice, if any) | `## Beat table`, `status: storyboard done` |
| 5 | `animate-reel-build` | The final MP4 is checked and delivered | `## Scores`, `status: delivered` |

How to run it. Copy this list into each reply and tick it off, so the user always sees where the reel is:

```text
Reel progress:
- [ ] Questions answered
- [ ] 1 animate-reel-topic: sources checked
- [ ] 2 animate-reel-story: copy approved
- [ ] 3 animate-reel-style: look picked
- [ ] 4 animate-reel-storyboard: storyboard approved
- [ ] 5 animate-reel-build: MP4 delivered
```


1. **New reel.** First pull the stats of any post 48 hours old that has no row in `## Stats at 48 h` (rules.md, After the user posts), and say in one line what the best and worst recent reels show. Then ask the question round below, make the folder `00 - notes/content/<YYYY-MM-DD>-<slug>/` in your folder, write the answers at the top of `script.md`, then invoke `animate-reel-topic` with the Skill tool.
2. **Next step.** When a step's stop is passed (the user said yes), invoke the next skill in the table. Never skip a step: each one makes the next cheaper.
3. **Redo one step** ("redo the story"). Read `status:` in the reel's `script.md`, invoke that step's skill, then run every later step again from its stop, because a new story changes the storyboard and the build.
4. **Resume.** A reel folder whose `script.md` has `status: <step> done` continues at the next step; `status: looks pitched` continues at animate-reel-style step 3 (record the look the user picked). Older reels with free-text `status:` start at the first step not yet in their `script.md`.
5. **Bulk prep** (`/animate-reel bulk` followed by a list of idea note names). Follow the section below.

## Bulk prep

The user names many ideas from the boards in `01 - dashboards/` and wants each one ready up to "script written, looks pitched" without being asked anything, so that later the user only picks a look, watches the preview and renders.

1. **Read the list.** An id like `deep-dive-spider-house-weakest` is the idea note `00 - notes/ideas/<id>.md`.
2. **No question round.** Mood and length come from the idea note. The look is "pitch me". Voiceover is asked when the look is picked.
3. **Per reel, run animate-reel-topic, animate-reel-story and animate-reel-style without their stops.** Make the folder as in "New reel", and set the idea note's `status: picked`. Every check in those steps still runs in full. Where a step would ask the user, take its recommended pick and write the question, the options and the pick under `## Open questions` in `script.md`. animate-reel-story records the other two shapes under `## Other shapes`. animate-reel-style draws one still per look for 3 looks.
4. **A failed source blocks only that reel.** If a source fails its check (on an Islamic page a weak hadith, on any other page a link that does not say what the reel claims), a number does not match, or the source is not showable, set `status: blocked`, write why under `## Open questions`, and go on to the next reel. Never swap in a new source unasked.
5. **Run reels side by side.** Give each reel its own helper with a fresh brief: the id, this section, the three step skill paths and `references/rules.md`. Run at most 4 at once. Helpers never run git and never post.
6. **End.** Each reel's `script.md` reads `status: looks pitched` (or `blocked`). Report one table: reel, folder, story shape, the 3 looks, open questions, blocked reason.

After the user picks a look for a bulk reel, ask voiceover yes or no, then run animate-reel-storyboard and animate-reel-build without stops up to the live preview: the preview and the render are the user's checks. A voice take still waits for the user's ear.

## Question round (once, before step 1)

One `AskUserQuestion` call, skipping anything the user already said. Each question has 2 to 4 options and a recommended pick.

- **Source** (if not given): on an Islamic page a hadith or ayah; on any other page a fact, a study, a book or an official page; for any niche a YouTube video (then its script is the source; see animate-reel-story).
- **Mood**: soft or intense. It sets the sound weight. It never narrows the looks pitched in animate-reel-style: pitch clear, different options, light and dark, and the user picks.
- **Look**: a named style, or "pitch me" (animate-reel-style pitches).
- **Length**: about 30 s, 45 s or 75 s. A length is a guide, never a cap: the script decides.
- **Voiceover**: yes or no. Voice is not a default; it is a choice per reel. If yes, animate-reel-storyboard makes the take first and times the beats to it.

## Fixed for every reel

These are about making the reel correctly, not how it looks. Every step follows them. The full checklist with every number is [references/rules.md](references/rules.md): animate-reel-topic copies it into the reel folder, and each step ticks its own section.

1. **Read the source on the primary page.** Islamic pages (`niche: islamic`): the Arabic, the English and the number come from sunnah.com or quran.com. Every other niche: each claim comes from its primary link (an official site, a study, a book page), read with web fetch. A search summary or memory is a lead, never the source: the reel goes out under a public name, and a wrong number is a public correction.
2. **Agree before building.** Every step stops for the user's yes, except in Bulk prep, where the open questions are written down instead. Building first and asking later wastes a render and pushes the user toward whatever already exists.
3. **Motion graphics that act the content out.** Every line gets its own visual event, drawn as proper illustration in code, and every visual carries the message without its caption. Never carousel paragraphs over a decorative motif. No AI video ever; no AI images unless the user agrees an exception for one reel.
4. **Balanced pace.** Each line stays long enough to read, something new keeps arriving, and the final read holds still, because dead holds were felt in every early cut. Numbers: rules.md, Build and look.
5. **Flow between beats is decided beat by beat.** Stay continuous when the next idea builds on the last; make a full scene change when the story really moves on. Neither a cut on every beat nor one forced shot.
6. **Readable on a phone,** with all text clear of the Instagram buttons. Minimum sizes and the safe zone: rules.md, Build and look.
7. **The medium's texture runs on every frame at full strength,** because thinning it makes the style read as fake.
8. **Copy tells a story** to one person, in full warm sentences, in the voice set in `00 - notes/context/declared/brand.md` (until `00 - notes/context/observed/taste.md` has lessons, a plain warm neutral voice). Nothing basic or overused: the viewer should never think "this again". The preferred way is to narrate what happened with the reference under it; reading the translation is fine when it fits. No em dashes, no jargon, no AI tells, no guilt hooks. On Islamic pages, scholars and tafsir may be named when read. On other pages, experts and authors may be named when read. Every reel ends with a comment ask (rule in rules.md, Copy).
9. Islamic pages: **Never draw a prophet,** in any form. Show a prophet through light, objects, places or the text. It cannot be taken back once public. A companion (sahabi) may be drawn as a faceless figure.
10. Islamic pages: **No six-pointed star, and no logo, stamp, seal or emblem.** Viewers read them as Israeli symbols. Loose 5-point stars and open 8-, 10- or 12-point Islamic geometry are fine.
11. **1080x1920, 30 fps, sound effects over a calm bed.** No music, never a constant hum, and a loudness ceiling the user set (rules.md, Sound). Detail in [references/sound.md](references/sound.md).

## Brand constants

These stay the same in every style, so the feed reads as one page. Each style draws them in its own type and colour. For every niche, the page's own values come from `00 - notes/context/declared/brand.md`: `handle`, `comment_word`, `colours` and `hashtags`. Items marked Islamic pages apply only when `niche: islamic`.

1. **Citation line**: the source in spaced capitals under the source text. One citation per screen. Islamic pages: the collection and number, `SAHIH AL-BUKHARI 6464`, `QURAN 2:286`. Every other niche: a plain source line with the source name, such as `WORLD HEALTH ORGANIZATION` or `ATOMIC HABITS, JAMES CLEAR`. No Arabic.
2. **Ending beat** on the reel's own palette: the comment ask (one word that fits this reel; `comment_word` in brand.md is the page's usual word, and "Comment SubhanAllah" is an Islamic page example), the page handle (`handle` in brand.md) near y 1420, "Follow for more." The page colours (`colours` in brand.md) are never a silent default.
3. **Sound weight matches the reel, and sound stays sparse:** about one sound every 3 to 5 s, one at a time. No scratchy pen or paper sounds.
4. **Arabic in Scheherazade New** (Islamic pages, or any reel that shows Arabic; `assets/ScheherazadeNew-Regular.ttf`, full tashkeel, the whole string shaped at once). Amiri drops dots in Chrome. Dots are checked on a full-size crop by pixel count.
5. **Key Arabic is written with the pen** (Islamic pages, up to 10 words): [pen-stroke calligraphy](references/style-pen-stroke-calligraphy.md). Every other niche shows no Arabic: the key line of the source is set large in the reel's own type.
6. **Light watermark on every frame until the end card.** The page handle (from `00 - notes/context/declared/brand.md`) sits small near y 1475 (about 30px, opacity about .2) through the whole reel, clear of the text, then fades out in about .5 s as the end card shows its usual full handle. It protects reposts without getting in the way.
7. **Hashtags**: the caption ends with the `hashtags` in brand.md, for every niche.

## Shared files

Step skills link to these and never copy them, so a rule changed here reaches every step.

- [references/rules.md](references/rules.md) - every rule as a checklist, one section per step. When the user sets a new rule or corrects a reel, add it here in the same turn, with its reason.
- [references/story-shapes.md](references/story-shapes.md) - story shapes and the story references (animate-reel-story).
- [references/hooks.json](references/hooks.json) - 23 hook formulas with their traps; `scripts/hookscore.py` scores three per reel (animate-reel-story step 3).
- [references/THIRD-PARTY.md](references/THIRD-PARTY.md) - the MIT notice for the parts adapted from instagram-agent-skill.
- `animate-reel-parable` (its own skill) - made-up stories built on a checked text: Scout saves ideas to the board, Script hands a reel in at `status: story done`.
- [references/style-index.md](references/style-index.md) - the style recipes, each with a working page in `assets/styles/` (animate-reel-style).
- [references/ideas.md](references/ideas.md) - visual moves: openings, middles, transitions, payoffs, endings (animate-reel-story, animate-reel-style, animate-reel-storyboard).
- [references/look.md](references/look.md) - looks tried, cinema night, type, safe area, motion numbers (animate-reel-style, animate-reel-build).
- [references/sound.md](references/sound.md) - the sound line, the SFX Kit, the mix, the voiceover (animate-reel-storyboard, animate-reel-build).
- [references/screens.md](references/screens.md), [references/variants.md](references/variants.md) - ready-made screens; one reel in other styles (animate-reel-build).
- [references/review.md](references/review.md) - the cold reader brief (plan and built reel), the fix card, and the scope check (`capture.mjs scope`) (reel-direction, animate-reel-build).
- [references/prompt-](references/prompt-) - the source prompts behind 20 recipes, each with its reference code (animate-reel-style, animate-reel-build, only when a recipe is not enough).
- [assets/sfx-kit/GUIDE.md](assets/sfx-kit/GUIDE.md) and [assets/sfx-kit/catalogue.md](assets/sfx-kit/catalogue.md) - how to pick and sync a kit sound, and every sound with its sync point (animate-reel-storyboard, animate-reel-build).
- `assets/starter.html` (a blank hand-built scene: scene windows, `up()`, `typer()`, `add()`), `assets/motion.js` (springs).
- [tests.md](tests.md) - three test prompts and what a good run does. Run them after changing any reel skill.
- `scripts/` - source.mjs, preview.mjs, capture.mjs, sheet.mjs, mix.py, render.sh, pacing_check.py, readcheck.mjs (every on-screen text held long enough to read; needs `window.TEXTS(t)` in the page), blur.py, voice_check.py (Whisper hears each voice line and checks it against `voice-text.txt`), hookscore.py (scores hook lines), caption_check.py (lints each caption against the page rules). Run them, do not edit them per reel.
