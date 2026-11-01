# Discovery

`discover.mjs` reads these files as text and writes a draft model. It never runs project code, never opens `.env` files (it counts them by name), reads at most 2,000 files and 2 MB per file, and skips `node_modules`, `.git`, `.next`, `dist`, `build`, `coverage`, `.turbo`, `.vercel`, `.claude` and `.agents`.

## What it finds

| Source                                                                    | Gives                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json` (any depth)                                                | Apps (`next`, `express`, `fastify`, `hono`, `koa`, `@nestjs/core`; `react-dom`, `vue`, `svelte` when nothing stronger), workers (a folder or package named worker, jobs or consumer that uses a queue or Redis), and services by client library (`ioredis`, `pg`, `mongoose`, `bullmq`, `amqplib`, `kafkajs`, `stripe`, `resend`, `@aws-sdk/client-s3`, and more). |
| `schema.prisma`                                                           | The database engine from `datasource ... provider`.                                                                                                                                                                                                                                                                                                                |
| `docker-compose.yml`                                                      | Each service with an `image` becomes a node, with ports in its evidence; `build:` services attach to the app in that folder; `depends_on` becomes a draft edge.                                                                                                                                                                                                    |
| `Dockerfile`                                                              | Base image and exposed port, added to the app in that folder.                                                                                                                                                                                                                                                                                                      |
| `.env.example`, `.env.sample`, `.env.template`                            | Key **names** only (`DATABASE_URL`, `REDIS_URL`, `STRIPE_*`). Values are never kept.                                                                                                                                                                                                                                                                               |
| `vercel.json`, `netlify.toml`, `fly.toml`, `render.yaml`, `wrangler.toml` | A hosting node.                                                                                                                                                                                                                                                                                                                                                    |
| `requirements.txt`, `pyproject.toml`, `go.mod`                            | Basic framework and client detection only.                                                                                                                                                                                                                                                                                                                         |

Not covered: Terraform, and reading Python or Go source for connections. Also not detected: extra processes started from scripts or `server/` folders (a WebSocket server, a cron runner), and compose settings such as a mounted Docker socket. Look for them when you read the entry points, and add them as nodes (with the file and line) or as your own risks.

## Edge candidates

Besides components and `depends_on` edges, the draft has a `candidates` list: connections the files suggest but do not prove. Each has a `confidence` (`high`, `medium`, `low`), the `evidence` lines it comes from and a short `why`. **Confirm or drop every one**: `model-check.mjs` fails while any are left (it accepts them with `--draft`).

| Source (JavaScript and TypeScript code is read as text, never run)                 | Gives                                               | Confidence |
| ---------------------------------------------------------------------------------- | --------------------------------------------------- | ---------- |
| Import of a known client library plus `new Client(...)` in an app's folder         | app to the matching component                       | high       |
| Import alone                                                                       | the same                                            | medium     |
| `new Queue("n")` and `new Worker("n")` with the same name                          | app to queue and queue to worker, both asynchronous | high       |
| Producer and consumer with different names, or only one side                       | the same, separate                                  | medium     |
| A literal API host (`api.stripe.com`, `api.openai.com`, ...)                       | app to that service                                 | medium     |
| `process.env.X` where X is a known service name (`REDIS_URL`) or names a component | app to that component (the **name** only)           | medium     |
| docker-compose `links`                                                             | service to service                                  | medium     |
| Kubernetes Deployment environment value that is a Service host                     | Deployment to the component that owns that Service  | medium     |
| `.mcp.json` / `mcp.json` beside an app                                             | app to each listed MCP server (a new component)     | medium     |

A shared docker-compose network only adds a line of evidence to a candidate that already exists. Candidates for a pair that already has an edge carry `confirms: "<edge id>"`.

A candidate may also carry facts you can copy to the edge, each with its evidence line: `timeoutMs` and `retries` (literals in the arguments of that client or call only), and `optional: true` when every use of the client sits in a `try` whose `catch` carries on (no rethrow, no error status), the call has a handled `.catch`, or the file imports a circuit-breaker library. Check each; they are suggestions.

Discovery also fills node facts when a file states them: `replicas` from `deploy.replicas` in compose or `spec.replicas` in a Deployment; `ai` (`llm-provider`, `vector-store`, `mcp-server`, `skill`) and, for a skill, `ai.tools` from its `allowed-tools`.

Limits: it is regular expressions over text. Calls through a wrapper, dependency injection, dynamic names or generated code are missed, and an import can look like a connection when it is not. Python and Go code are not read for connections. It never records TLS, authentication, zones or data labels: a person has to read the configuration for those, and write `"unknown"` when no file shows them. It never records a value: only names, host names, queue names and numbers.

## Filling the gaps (read only what you need)

1. Search before reading: `grep` for `new Redis`, `createClient`, `new Queue`, `new Worker`, `prisma.`, `fetch(`, `axios`, `app.get`, `router.`, `process.env.` names.
2. For each pair of nodes that talk, read the few lines where the call happens, and record that file and line as the edge's evidence.
3. Services the draft missed (an outside API called with `fetch`, a CDN, a mail provider): add a node with `role: external` and evidence from the call site, or `generic-external` tech.
4. A component you are told exists but cannot find in any file: add it and mark it `inferred`.
5. Several apps share one database or cache: keep one node and one edge from each app.

## When the draft looks wrong

- Two nodes for one thing: keep the one with better evidence and rewrite edges that used the other.
- A framework detected in a tooling folder (docs site, scripts): delete the node.
- Nothing found: say so; ask the user which parts exist rather than inventing a diagram.
