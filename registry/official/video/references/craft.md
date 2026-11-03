# Craft: what makes a short worth watching

The engine makes every frame look finished. Whether anyone watches to the end depends on the script, the pace and the picture choices, and those are yours. Hold every video to this page.

## 1. The hook (first 1.5 seconds)

The first frame and the first line decide whether anyone stays. Open on the payoff, not the setup.

| Hook type           | Example line                                             | First frame                         |
| ------------------- | -------------------------------------------------------- | ----------------------------------- |
| A surprising number | "Your API just got ten thousand requests in one second." | `title` with the number starred     |
| A counter-take      | "Most people use the wrong rate limiter."                | `kinetic`, the key word in accent   |
| Stakes              | "This one header stops your API from falling over."      | `title` or `code` already on screen |
| Watch this          | "Watch what happens to a request with no limiter."       | `rate-limit` or `request-flow`      |
| A visual question   | "Which of these two survives a traffic spike?"           | `versus`                            |

Never open with: a greeting, "in this video", "today we'll", "let me tell you", a definition, or the channel name. Write five hooks in `hooks.md` and pick the one that would stop _you_ scrolling.

## 2. The script

- Written to be heard: sentences of 4 to 12 words, one idea each. Read every line aloud in your head; if you would stumble, rewrite it.
- About 2.8 to 3.2 spoken words a second (Kokoro at speed 1.1 does this), so a 35-second video is about 100 words. Write long, then cut a third.
- Second person ("your API"), concrete nouns, real numbers. No filler: "basically", "essentially", "it's important to note", "in today's world", "let's dive in".
- Something turns every 6 to 8 seconds: a surprise, a contrast, a small joke, a "but". Open loops ("the third one is the one everyone gets wrong") pay off before the end.
- One call to action, at most 3 seconds, after the payoff. A loopable last line (one that leads back into the first) is better than "follow for more" alone.
- Honest: every number and claim is the user's, or has a source in `facts.md`. Never invent stats, quotes, users or reviews.

## 3. The picture

- A new picture at least every 3 seconds; scenes of 2 to 6 seconds. A scene longer than 7 seconds must keep moving the whole time (a simulation, typing code, a request flow).
- One focal point per frame. Star at most 1 or 2 words per line (`*word*`) so the accent means something.
- Never two scenes of the same kind in a row (kinetic beats excepted). Mix words, code, diagrams and numbers.
- Show, don't list: a mechanism is a `rate-limit`, `request-flow`, `sequence`, `nodes` or `code` scene, not a bullet list about it. A `list` is for at most 4 short items, and spotlight (one at a time) when each gets its own line.
- Transitions: `slide` is the default, `whip` for a change of topic, `zoom-through` into a detail, `slash` or `shatter` only into a kinetic slab or the payoff, and never two slashes within 2.5 seconds.
- Keep the type big. Headlines of 2 to 8 words; code of at most 12 lines and 40 characters a line on a vertical video.

## 4. Sound

The render adds a whoosh on each transition, a soft pop when an item appears, an impact on the hook and on slabs, and an original music bed ducked under the voice. Leave them on. If the user has their own licensed track, use it (`music.asset`), and keep the voice on top. The voice matters most: the user's own recording (`video-voice` recorded mode) beats any synthetic voice.

## 5. The review loop (score card)

After every draft, make a contact sheet: `node <video-core>/scripts/review.mjs stills <project> --at <one time per scene, plus 0.5>` and look at it. Then score the draft 1 to 5 on each line, with one sentence of evidence each:

| Line    | 5 means                                                                                   |
| ------- | ----------------------------------------------------------------------------------------- |
| Hook    | The 0.5-second frame and the first line would stop a scroll on their own.                 |
| Clarity | Someone new to the topic gets the one idea; every scene shows exactly what is being said. |
| Pace    | Nothing holds still; no scene drags; the voice never waits for the picture.               |
| Variety | Kinds, layouts and transitions change; no two neighbouring scenes look alike.             |
| Polish  | No text clipped, overlapping, too small or under the captions; captions match the voice.  |
| Payoff  | It ends on the takeaway and one clear call to action.                                     |

Any line under 4: name the fix (rewrite the hook, split a scene, change a kind, shorten text, change a transition), apply it, render a new draft, and score again. At most 3 rounds, then show the user the draft and the card.

When you can start a separate agent, have it do the scoring: give it the contact sheet path, `script.md` and this section, and not your reasoning, so the work is not grading itself.
