# Possible risks (AV-R rules)

`risk-check.mjs` adds these to the model. AV-R01 to AV-R10 read the project's files; AV-R11 to AV-R18 read the model's own facts. Every one is a **possible risk to check**, with the files it is based on. None is a verdict, and none says an architecture is good or bad. Rules marked _heuristic_ read code as text and can be wrong in both directions: they miss risks (code they cannot see) and flag things that are fine (limits set somewhere else).

Scope in 0.1: JavaScript and TypeScript source for the code rules; docker-compose, Dockerfiles, Prisma schemas, `package.json`, hosting files and env example **key names** for the rest. Python and Go dependency files make nodes in discovery, but the code rules do not read `.py` or `.go` files yet. Files named `.env`, `.env.local`, `*.pem` and `*.key` are never opened.

Severity is `info` (worth knowing) or `warn` (worth checking soon). The agent may add its own risks with `"source": "agent"`; they need evidence too (see "Adding risks yourself" at the end).

## AV-R01 Single database with no replica or backup configuration

- **Means:** one database holds all the data, and nothing in the files read says how it survives a failure.
- **Detected by:** exactly one `database` node, and no mention of replica, standby, backup, pgBackRest, WAL-G, Barman or read-only in compose, Dockerfiles, hosting files or config, and no managed-database dependency (Neon, PlanetScale, Supabase, Vercel Postgres, Turso).
- **False positives:** backups done by the hosting provider or a cron job outside the repo.
- **Check:** where backups go, when a restore was last tried, and whether a replica is worth it.
- **Trade-offs:** replicas cost money and add replication lag; managed services trade control for convenience.

## AV-R02 Cache entries written without an expiry (_heuristic_)

- **Means:** a Redis `set`, `hset` or `hmset` has no expiry, so the entry lives until evicted or deleted.
- **Detected by:** in a file importing `ioredis`, `redis` or `@upstash/redis`, a `.set(` on a Redis client without `EX`, `PX`, `EXAT`, `PXAT`, `KEEPTTL`, `ex:`, `px:` or `ttl` in its arguments, and no `.expire(` within a few lines; the same for `hset`/`hmset` without a following `.expire(`.
- **Silent for:** `set(key, value, "EX", 60)`, `{ ex: 60 }`, `setex`, and `.set` on things that are not Redis clients.
- **False positives:** counters and locks that are meant to stay, and expiry set in a wrapper function.
- **Check:** the eviction policy and whether each key should expire.
- **Trade-offs:** a TTL on data you cannot rebuild can lose it.

## AV-R03 No rate limiting found on a public API (_heuristic_)

- **Means:** the backend defines routes but no rate limiter appears.
- **Detected by:** an app that owns public routes (a `backend` app with `app.get`, `router.post` or Nest decorators, or a Next.js app with route handlers under `app/api` or `pages/api`) and no rate-limit dependency (`express-rate-limit`, `rate-limiter-flexible`, `@fastify/rate-limit`, `@upstash/ratelimit`, `@nestjs/throttler`, `hono-rate-limiter`), no helper such as `rateLimit(` or `checkRateLimit(`, no `rate-limit` or `throttle` file name and no nginx `limit_req`.
- **False positives:** limits at a CDN, gateway or load balancer these files do not show.
- **Check:** proxy and gateway settings; limits on login, signup and expensive routes first.
- **Trade-offs:** limits can block real users behind a shared address; a shared store (Redis) adds a dependency.

## AV-R04 External call without a timeout (_heuristic_)

- **Means:** a call to an outside host can wait forever on a slow provider.
- **Detected by:** `fetch`, `axios`, `got` or `ky` called with a literal URL to a host with a dot that is not local, and no `AbortSignal.timeout`, `signal` or `timeout` in the call. Calls made through a configured client instance are not seen.
- **False positives:** a timeout set on a shared client or at a proxy.
- **Check:** the client's default timeout, and what the user sees when it fires.
- **Trade-offs:** a short timeout can cut off a slow success; pair it with a retry or a clear error.

## AV-R05 Database query inside a loop (_heuristic_)

- **Means:** possibly one query per item (N+1).
- **Detected by:** an awaited ORM or SQL call (`prisma.*`, `knex`, `sequelize`, repositories, models, `pool.query`, `db.query`) inside the braces of `for`, `while`, `for await`, or inside `.forEach(async`, `.map(async`.
- **Silent for:** a query outside any loop, a loop that awaits something else, a single batched query.
- **False positives:** loops over a handful of items, or sequential work that must be ordered.
- **Check:** how many items the loop runs over in production.
- **Trade-offs:** one big batched query is usually faster but can use more memory or hit parameter limits.

## AV-R06 Slow work done during the request (_heuristic_)

- **Means:** email, SMS, image or file processing, or a payment webhook runs inside the request.
- **Detected by:** such a call in a route or handler file, and **no** `queue` node in the model.
- **Silent when:** a queue exists, or the call is in a worker.
- **False positives:** low volume where inline is fine.
- **Check:** time under load and what happens on failure or retry.
- **Trade-offs:** a queue adds a service to run, monitor and retry.

## AV-R07 Secret-looking variable exposed to the browser

- **Means:** names such as `NEXT_PUBLIC_..._SECRET` end up in the public bundle.
- **Detected by:** variable **names** (from env example files and `process.env.X` / `import.meta.env.X` in code) with a browser prefix (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, `EXPO_PUBLIC_`, `PUBLIC_`, `NUXT_PUBLIC_`, `GATSBY_`) and `SECRET`, `PRIVATE`, `KEY`, `TOKEN` or `PASSWORD` in the name. Names with `PUBLISHABLE`, `ANON`, `SITE_KEY`, `PUBLIC_KEY` or `MEASUREMENT` are treated as public by design.
- **False positives:** public keys with other names.
- **Check:** whether the value is a secret; if so move it server side and rotate it.
- **Trade-offs:** none for a real secret. Values are never read.

## AV-R08 No health check endpoint found (_heuristic_)

- **Means:** nothing tells a host or load balancer whether the service is alive.
- **Detected by:** an app that owns routes (as in AV-R03) and no `/health`, `/healthz`, `/ready`, `/readyz`, `/livez` or `/healthcheck` route string or file path.
- **False positives:** probes that use a TCP check or an existing page.
- **Check:** how the platform decides to restart or stop routing traffic.
- **Trade-offs:** a deep check that touches the database can take the service down when the database is slow; keep liveness and readiness separate.

## AV-R09 Serverless functions may connect straight to Postgres (_heuristic_)

- **Means:** each function instance can open its own database connections and exhaust the limit.
- **Detected by:** `vercel.json`, `netlify.toml` or `wrangler.toml` whose folder (the whole repo when it is at the root) has a Postgres client (`pg`, `postgres`, `@prisma/client` with a Postgres provider, `drizzle-orm` with a Postgres node), and no pooler marker (`pgbouncer`, `@neondatabase/serverless`, `@vercel/postgres`, `@prisma/extension-accelerate`, `prisma://`, Hyperdrive, "pooler", or variable names containing `POOL`, `DIRECT_URL`, `NON_POOLING`, `ACCELERATE`).
- **Deviation from the brief:** it also reads a `-pooler` host name in `.env.example`. That needs the value, and this skill reads env **names** only, so a pooled host that is visible only in a value is not seen.
- **False positives:** a pooled connection string kept only in the host's settings.
- **Check:** whether the connection string uses a pooler.
- **Trade-offs:** a pooler is another service and limits session features such as some prepared statements.

## AV-R10 Data service exposed or unprotected in docker-compose

- **Means:** a data store is reachable from outside, or Redis has no password.
- **Detected by:** a Redis, database, queue or search image whose `ports` publish to the host on all interfaces (`"5432:5432"`, `0.0.0.0:`), or a Redis service with no `requirepass` or `REDIS_PASSWORD`. Ports bound to `127.0.0.1` and `expose:` do not count.
- **False positives:** a compose file used only on a private development machine.
- **Check:** where the compose file runs; bind to `127.0.0.1`, set a password, keep it off public networks.
- **Trade-offs:** a password means every client needs it; local convenience versus safety.

## AV-R11 Some synchronous calls have a timeout recorded and these do not (_heuristic_)

- **Means:** the model records a timeout on at least one synchronous connection (`timeoutMs`) but not on others, so calls may behave differently when a service is slow.
- **Detected by:** at least one synchronous connection with `timeoutMs`, and others (not `sync: false`) without it.
- **Deviation from the brief:** the brief says "a sync call with no timeout evidence". Flagging every call in a model that records no timeouts would only say that none were looked for, and would repeat AV-R04, so this rule fires on the inconsistency.
- **False positives:** a deliberate longer or absent timeout, or one set where the model did not record it.
- **Check:** the client or call behind each connection; record the timeout in the model when it is set.
- **Trade-offs:** a short timeout can cut off a slow success.

## AV-R12 Retries with no backoff noted (_heuristic_)

- **Means:** a connection retries, and nothing in its evidence notes a delay between attempts.
- **Detected by:** `retries` above 0 on a connection whose evidence notes do not mention backoff, jitter or exponential waits.
- **False positives:** a backoff in a wrapper the evidence does not mention.
- **Check:** how the retry waits and how many attempts it makes.
- **Trade-offs:** longer waits slow recovery; fewer attempts fail sooner.

## AV-R13 Connection crosses a trust zone with no authentication or encryption

- **Means:** two components in different trust zones are joined with `auth: none` or `tls: false`.
- **Detected by:** a connection whose two ends both have a `zone`, the zones differ, and `auth` is `none` or `tls` is `false` (both need a file as evidence in the model).
- **False positives:** a link on a private network you control, recorded in different zones for another reason.
- **Check:** whether the link can be reached from outside its zone.
- **Trade-offs:** TLS means certificates; credentials need rotation.

## AV-R14 Personal data reaches a third party or logs

- **Means:** personal data goes to, or is held by, a third party or a logging component.
- **Detected by:** a connection whose `carries` has `pii` and whose target is in the `third-party` zone or holds `logs`; or a `third-party` component whose `data` has `pii`.
- **False positives:** the data may be masked or agreed with the third party in a way the model does not record.
- **Check:** where the data goes, what the other side does with it, and whether it can be left out or masked first.
- **Trade-offs:** masking loses detail for support and debugging.

## AV-R15 AI agent with write or run tools and no audit grade

- **Means:** an agent, MCP server or skill can write files or run commands, and no audit result is linked.
- **Detected by:** an `ai` component of kind `agent`, `mcp-server` or `skill`, with `tools` naming a write, edit, bash, shell, exec, run, delete or apply_patch tool, and no `auditGrade`.
- **False positives:** the tools may be limited by settings the model does not show.
- **Check:** what the tools can reach; run an audit (for example `aisle audit`) and link it as `auditSource`.
- **Trade-offs:** an audit reduces risk, it cannot prove safety; narrower tools mean more manual steps.

## AV-R16 AI component with a low audit grade

- **Means:** a linked audit result graded the component D or F.
- **Detected by:** `ai.auditGrade` of `D` or `F`. The grade is only accepted when `auditSource` points at a real audit file.
- **False positives:** the audit may be old.
- **Check:** open the audit file and read the findings.
- **Trade-offs:** fixing takes time; replacing means a new component to look at.

## AV-R17 Many synchronous calls in one step (_heuristic_)

- **Means:** one step of a flow makes more than four synchronous calls at once (`together` steps), so it is as slow as the slowest and fails if any one fails.
- **Detected by:** a flow step, plus the steps marked `together` after it, with more than four synchronous connections.
- **False positives:** calls that are fast and all required.
- **Check:** whether all of them must finish before the answer.
- **Trade-offs:** moving work to a background job adds a queue; the result is not ready at once.

## AV-R18 Single copy of a component that several flows depend on

- **Means:** one failure or restart of the component interrupts every flow that passes through it.
- **Detected by:** `replicas: 1` (with evidence) on a component that three or more flows use, as an end of a step's connection or as the node of an event.
- **False positives:** one copy may be enough where restarts are quick.
- **Check:** restart time, and what the flows do while it is gone.
- **Trade-offs:** a second copy costs more and shared state must move out of memory.

## Each risk carries options

Every risk has `fixes`: one to three options, each with its trade-off. They are choices to weigh, not instructions.

## SARIF for pull requests

`node scripts/risk-check.mjs --model docs/architecture.json --root . --format sarif --out docs/architecture.sarif` writes the same risks as SARIF 2.1.0 and leaves the model untouched (the default format updates the model). Each result points at the model file and at up to five evidence files and lines, and says "Possible risk to check". The output has no dates, so the same input gives the same file. Fields were checked against the SARIF 2.1.0 schema; whether a given code-scanning host shows `help` text in the same way is `TODO(verify)`.

## Adding risks yourself

After the script runs you may add risks from your own reading. Use `"source": "agent"`, a short `title`, a `why`, a `check`, the node ids and at least one `evidence` entry (file and line). Do not repeat a rule risk. If you cannot point at a file, do not add the risk. Never put a secret value in any field.
