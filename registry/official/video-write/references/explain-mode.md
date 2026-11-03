# Explain mode

Beats (each a `beat:` value). Required, in this order: `hook`, at least one `step`, `takeaway`. The others are optional and go where the table puts them.

| Beat            | What it is                                                            | Usual scene                                                        |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `hook`          | The payoff or the stakes, in under 2 seconds (`references/hooks.md`). | `title` or `kinetic`                                               |
| `stakes`        | Why it matters now, one line.                                         | `kinetic`, `number`                                                |
| `misconception` | What most people get wrong (only if it is true and useful).           | `kinetic`, `versus`                                                |
| `analogy`       | A real-world comparison, one line (only if it really helps).          | `title`, `broll`                                                   |
| `step`          | The mechanism, one step per line, each mapped to one picture beat.    | `code`, `rate-limit`, `request-flow`, `sequence`, `nodes`, `steps` |
| `proof`         | It working: a simulation, a measurement, a command and its output.    | `rate-limit`, `chart`, `terminal`, `number`                        |
| `edge`          | A failure or limit, one line.                                         | `code` diff, `versus`                                              |
| `takeaway`      | One line to remember. Short enough for a slab.                        | `kinetic` with `bg: accent`                                        |
| `cta`           | After the takeaway only, at most 3 seconds.                           | `title` with a kicker                                              |

A 35-second explainer is about 100 words: hook, 3 to 5 steps or proofs, a takeaway, a call to action. Show, don't list: a mechanism gets a technical kind, not a bullet list about it.

Sources: every `step`, `proof` and `edge` line and every line with a number and a unit needs `fact: <id>`, and `facts.md` holds `- [id] claim. Source: <link or file>`. A line containing `[needs-source]` fails the check. Use only sources the user gave or that you read in this session. A number quoted from a simulation is a fact too: `Source: simulate.mjs, seed 42`.

Honesty: never invent statistics, quotes, testimonials or reviews. If the user wants a number you cannot source, say so and write around it.

Technical scenes: write one `step` line per row or step of the picture, so each row appears with its line.
