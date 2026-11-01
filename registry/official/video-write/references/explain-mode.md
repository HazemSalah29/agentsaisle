# Explain mode

Beats, in this order (each is a `beat:` value; `step` may repeat):

1. `hook` - the opening line.
2. `misconception` - what most people think.
3. `analogy` - a real-world comparison.
4. `step` - the mechanism, one step per line, each mapped to one animation beat. When the mechanism is an algorithm, a request path, a message exchange or code, give the scene a technical kind (`rate-limit`, `request-flow`, `sequence`, `code`) so it is shown, not listed; `video-explain` fills it in.
5. `edge` - an edge case or failure.
6. `takeaway` - one line to remember.
7. `cta` (optional) - after the takeaway only.

Sources: every `step`, every `edge` and every line with a number and a unit needs `fact: <id>`, and `facts.md` holds `- [id] claim. Source: <link or file>`. A fact without a source fails the check. A line containing `[needs-source]` fails it too: find the source or remove the claim. Use only sources the user gave or that you read in this session.

Honesty: never invent statistics, quotes, testimonials or reviews. If the user wants a number you cannot source, say so and write around it.

On screen: a small citation can show the source name; it is the user's choice.

Length: about 2.5 words a second; keep each line under about 6 seconds.

Technical scenes: write one `step` line per row or step of the picture, so each row appears with its line. A number the narration quotes from a simulation is a fact too: `facts.md` says `Source: simulate.mjs, seed 42` (never a number you worked out yourself).
