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

Not covered in 0.1.0: Kubernetes manifests, Terraform, and reading Python or Go source for connections.

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
