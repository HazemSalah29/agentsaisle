# Choosing a kind

| The beat explains                                                | Use                               | Because                                                             |
| ---------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| How a limiter lets requests through or turns them away           | `rate-limit`                      | It runs the real algorithm; nothing on screen is invented.          |
| How one request moves through the user's own system              | `request-flow`                    | It comes from an `arch-visualize` model, with `file:line` evidence. |
| A back-and-forth between named parties (login, retry, handshake) | `sequence`                        | Rows appear in order, one idea at a time.                           |
| A function, a config or a change to either                       | `code`                            | Highlighted lines, focus on the part being explained, or a diff.    |
| A list of facts, a quote, a plain title, a chart of real numbers | `list`, `quote`, `title`, `chart` | No diagram needed.                                                  |

Do not use a diagram for a beat that is one sentence. Do not stack two technical scenes back to back without a title or a one-line list between them; the viewer needs a moment.

## Props by example

`rate-limit` (written by `simulate.mjs`; do not write the results):

```json
{
  "seed": 42,
  "count": 80,
  "pattern": { "type": "poisson", "ratePerSec": 6 },
  "algos": [{ "algo": "token-bucket", "capacity": 5, "refillPerSec": 3 }]
}
```

`sequence` (our text format; `A->B` is a request, `B-->A` a reply, `Note over A,B: text`):

```
participant C as Client
participant S as Server
C->S: GET /api
S-->C: 429 Too Many
Note over C,S: retry after 1 s
```

Mermaid `sequenceDiagram` text works too, with arrows, participants and notes only. `loop`, `alt` and `activate` are refused. Up to 6 participants, 12 rows, 30 characters a row, 16 for a name. A label that does not fit its space is an error; shorten it.

`code`: `{"language":"ts","file":"limiter.ts","code":"...","focus":[{"lines":[2,4],"line":0}]}`.

`request-flow`: never hand-written; see `arch-import.md`.
