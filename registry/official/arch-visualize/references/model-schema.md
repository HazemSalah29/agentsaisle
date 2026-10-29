# The model (`docs/architecture.json`)

One JSON file is the source of truth between the scripts. `assets/model.schema.json` defines it; `model-check.mjs` enforces it. Start from `docs/architecture.draft.json` (nodes with evidence, plus edges from `depends_on`).

```json
{
  "version": 1,
  "project": "shop",
  "nodes": [
    {
      "id": "api",
      "label": "Shop API",
      "role": "backend",
      "tech": "express",
      "tier": "backend",
      "evidence": [{ "file": "apps/api/package.json", "line": 6, "note": "dependency express" }]
    }
  ],
  "edges": [
    {
      "id": "api-cache",
      "from": "api",
      "to": "cache",
      "protocol": "TCP (Redis)",
      "sync": true,
      "evidence": [{ "file": "apps/api/src/lib/session.ts", "line": 3 }]
    }
  ],
  "flows": [
    {
      "id": "load-profile",
      "name": "User loads their profile",
      "steps": [
        { "edge": "web-api", "label": "GET /api/me" },
        { "edge": "api-cache", "label": "Look up session" },
        { "event": "cache-miss", "node": "cache" },
        { "edge": "web-api", "reverse": true, "label": "200 OK" }
      ]
    }
  ],
  "risks": [],
  "inferred": ["edge:bullmq-cache"]
}
```

## Fields

| Field                                    | Rule                                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project`                                | Display name, at most 80 characters.                                                                                                                                                                                      |
| `nodes[].id`, `edges[].id`, `flows[].id` | Lowercase letters, digits and hyphens, unique in their list. Edge ids read well as `from-to`.                                                                                                                             |
| `nodes[].label`                          | What the component does ("Orders database"), at most 80 characters. Plain text only.                                                                                                                                      |
| `nodes[].role`                           | `client`, `edge`, `frontend`, `backend`, `worker`, `queue`, `cache`, `database`, `storage`, `search`, `auth`, `external`, `observability`.                                                                                |
| `nodes[].tier`                           | Sets the column: `clients`, `edge`, `frontend`, `backend`, `async`, `data`, `external`. Usual mapping: worker and queue go to `async`; cache, database, storage and search to `data`; third-party services to `external`. |
| `nodes[].tech`                           | An id from `assets/tech-catalog.json` (for example `nextjs`, `redis`, `postgresql`), or `generic-<role>` when unknown. The checker rejects anything else.                                                                 |
| `evidence`                               | `{ file, line, note }` with a path relative to the project (no absolute paths, no `..`). Required on every node and edge unless listed in `inferred`.                                                                     |
| `edges[].from` / `to`                    | Node ids. `from` is the side that starts the call.                                                                                                                                                                        |
| `edges[].protocol`, `sync`               | Free text such as `HTTP`, `TCP (SQL)`; `sync: false` for queues and background work.                                                                                                                                      |
| `inferred`                               | `node:<id>` or `edge:<id>` for anything you believe exists but no file shows. Drawn dashed and explained in the side panel. Each entry must point at a real item.                                                         |
| `risks`                                  | Written by `risk-check.mjs` (`source: "rule"`) and by you (`source: "agent"`, with evidence). See `risks.md`.                                                                                                             |

## Flow steps

- `{ "edge": "<edge id>", "label": "..." }` moves a dot from the edge's `from` to its `to`.
- Add `"reverse": true` for the response travelling back along the same edge.
- `{ "event": "cache-miss", "node": "<node id>" }` flashes a node; add `label` to word it yourself.
- At most 5 flows per model. `model-check.mjs` requires at least one.

## Never

- Put a secret value anywhere (keys, passwords, connection strings with passwords). The checker fails on strings that look like credentials.
- Put markup in labels. The page shows text only, so `<b>` would appear literally.
