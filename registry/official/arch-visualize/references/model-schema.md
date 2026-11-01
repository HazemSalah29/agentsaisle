# The model (`docs/architecture.json`)

One JSON file is the source of truth between the scripts. `assets/model.schema.json` defines it; `model-check.mjs` enforces it. Start from `docs/architecture.draft.json` (nodes with evidence, plus edges from `depends_on`).

```json
{
  "version": 2,
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

## Version 2 fields (all optional)

Version 1 models still work: the scripts read them as version 2 in memory, and `model-check.mjs --model <file> --write-upgrade` saves the upgrade. Add these only when a file shows them; otherwise leave them out.

| Field                             | Values and rule                                                                                                                                                                                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groups[]`                        | `{ id, label, kind, parent?, evidence }`. `kind`: `deploy`, `namespace`, `package`, `other`. A group never contains itself.                                                                                                                                                        |
| `nodes[].group`                   | Id of a declared group.                                                                                                                                                                                                                                                            |
| `nodes[].zone`                    | `public`, `dmz`, `private`, `third-party`, `user-device`.                                                                                                                                                                                                                          |
| `nodes[].data`, `edges[].carries` | Labels only, never values: `pii`, `credentials`, `payments`, `health`, `secrets-ref`, `logs`.                                                                                                                                                                                      |
| `nodes[].replicas`                | A number (needs evidence on the node) or `"unknown"`.                                                                                                                                                                                                                              |
| `nodes[].ai`                      | `{ kind, auditGrade?, auditSource? }`. `kind`: `llm-provider`, `agent`, `mcp-server`, `skill`, `vector-store`. A grade needs `auditSource`, a relative path to an `aisle audit` JSON file whose `grade` matches; the checker reads it from `--root` (default: the current folder). |
| `nodes[].owner`                   | Free text such as a team, at most 80 characters.                                                                                                                                                                                                                                   |
| `edges[].auth`                    | `none`, `session`, `jwt`, `api-key`, `mtls`, `oauth`, `unknown`.                                                                                                                                                                                                                   |
| `edges[].tls`                     | `true`, `false` or `"unknown"`.                                                                                                                                                                                                                                                    |
| `edges[].timeoutMs`, `retries`    | Whole numbers, only where a file sets them (give the file and line as edge evidence).                                                                                                                                                                                              |
| `edges[].optional`                | `true` when the caller keeps working if the callee fails (try/catch fallback, circuit breaker); needs evidence.                                                                                                                                                                    |
| `views[]`                         | `{ id, name, lens, focus?, camera? }` saved starting views. `lens`: `system`, `flows`, `security`, `failure`, `ai`, `diff`. `focus` lists node ids.                                                                                                                                |

### Evidence rule for facts

A field that states a fact (`timeoutMs`, `retries`, `tls`, `auth` other than `unknown`, `replicas` as a number, `optional: true`) needs evidence on its node or edge. If you cannot point at a file and line, write `"unknown"` or leave the field out. The checker fails a fact without evidence.

## Flow steps

- `{ "edge": "<edge id>", "label": "..." }` moves a dot from the edge's `from` to its `to`.
- Add `"reverse": true` for the response travelling back along the same edge.
- `{ "event": "cache-miss", "node": "<node id>" }` flashes a node; add `label` to word it yourself.
- At most 5 flows per model. `model-check.mjs` requires at least one.

## Never

- Put a secret value anywhere (keys, passwords, connection strings with passwords). The checker fails on strings that look like credentials.
- Put markup in labels. The page shows text only, so `<b>` would appear literally.
