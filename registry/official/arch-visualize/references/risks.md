# Possible risks (AV-R rules)

`risk-check.mjs` adds these to the model. Every one is a **possible risk to check**, with the files it is based on. None is a verdict, and none says an architecture is good or bad. Rules marked _heuristic_ read code as text and can be wrong in both directions: they miss risks (code they cannot see) and flag things that are fine (limits set somewhere else).

Scope in 0.1.0: JavaScript and TypeScript source for the code rules; docker-compose, Dockerfiles, Prisma schemas, `package.json`, hosting files and env example **key names** for the rest. Python and Go dependency files make nodes in discovery, but the code rules do not read `.py` or `.go` files yet. Files named `.env`, `.env.local`, `*.pem` and `*.key` are never opened.

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
- **Detected by:** a `backend` node with route definitions (`app.get`, `router.post`, Nest decorators, Next route handlers) and no rate-limit dependency (`express-rate-limit`, `rate-limiter-flexible`, `@fastify/rate-limit`, `@upstash/ratelimit`, `@nestjs/throttler`, `hono-rate-limiter`), no `rateLimit(`-style call and no nginx `limit_req`.
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
- **Detected by:** a `backend` node with routes and no `/health`, `/healthz`, `/ready`, `/readyz`, `/livez` or `/healthcheck` route string or file path.
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

## Adding risks yourself

After the script runs you may add risks from your own reading. Use `"source": "agent"`, a short `title`, a `why`, a `check`, the node ids and at least one `evidence` entry (file and line). Do not repeat a rule risk. If you cannot point at a file, do not add the risk. Never put a secret value in any field.
