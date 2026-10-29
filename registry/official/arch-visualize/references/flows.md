# Request flows

A flow is one journey a request takes. The page plays it as a dot travelling edge by edge, with the step label shown in a caption.

## Choosing flows (1 to 5)

Pick the journeys a newcomer needs to understand the system:

1. **A read** that touches the cache and the database (page load, profile, list).
2. **A write** that matters (checkout, signup, publish), including any outside service.
3. **A background job** started by a request and finished by a worker (email, report, import).
4. **Login or auth**, if it involves a separate service.

Skip near-duplicates. Prefer real routes from the code over generic ones, and take labels from them (`GET /api/me`, `POST /api/checkout`).

## Writing steps

- Walk the code in call order. One step per hop along an existing edge: `{ "edge": "api-db", "label": "SELECT user" }`.
- Show the answer coming back with `reverse: true` on the same edge: `{ "edge": "api-db", "reverse": true, "label": "Row returned" }`. Do this where the response matters, not for every hop.
- Use an event for something that happens at a node, such as a cache miss or a retry: `{ "event": "cache-miss", "node": "cache" }`.
- Keep labels short (about 4 words). They are plain text.
- Keep a flow to roughly 4 to 10 steps. Split long ones.
- Branches (cache hit versus miss): show the path you can prove from the code, and name the branch in the flow `name` or an event label.
- Asynchronous work (queue to worker): start a separate flow at the queue edge; the first flow ends at the enqueue step.

## Checks

- Every `edge` in a step exists in `edges`, and every event `node` exists in `nodes`. `model-check.mjs` fails otherwise.
- A step that moves along an edge the code never uses is wrong; if you are unsure, mark that edge `inferred`.
