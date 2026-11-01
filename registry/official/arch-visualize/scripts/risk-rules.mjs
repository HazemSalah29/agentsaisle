// The wording of every rule (AV-R01 to AV-R18): what it means, why it is only a possible risk, what to check
// and the options with their trade-offs. Text lives here as data so tests can read it. Also the small helper
// that builds a risk from a rule.
const uniqueSorted = (xs) => [...new Set(xs)].sort();

export const MAX_EVIDENCE = 5;

/** Rule texts. `heuristic` rules say so in their explanation. */
export const RULES = {
  "AV-R01": {
    title: "Single database with no replica or backup configuration",
    severity: "warn",
    why: "The model has one database and none of the files read mention a replica, a standby, a backup tool or a managed database service.",
    check:
      "Confirm where backups are taken and that a restore has been tried. Decide whether a replica or a managed service is worth its cost for this project.",
    fixes: [
      {
        text: "Take scheduled backups and rehearse a restore.",
        tradeoff:
          "Costs storage and an hour of practice; it protects against loss, not against downtime.",
      },
      {
        text: "Use a managed database that handles backups and failover.",
        tradeoff: "Less control and a monthly bill; fewer things to run yourself.",
      },
      {
        text: "Add a read replica or standby.",
        tradeoff: "Costs money and adds replication lag; a replica is not a backup.",
      },
    ],
  },
  "AV-R02": {
    title: "Cache entries written without an expiry",
    severity: "info",
    heuristic: true,
    why: "Heuristic: a Redis write has no expiry option (EX, PX, ttl) and no expire call close by, so the entry stays until it is evicted or deleted.",
    check:
      "Check the eviction policy and whether these keys should expire. Some data (counters, locks you release yourself) is meant to stay; adding a TTL there can lose data.",
    fixes: [
      {
        text: "Set an expiry (EX, PX or ttl) when the entry can be rebuilt.",
        tradeoff: "A short expiry means more cache misses and more load on the source.",
      },
      {
        text: "Set a memory limit and an eviction policy on Redis.",
        tradeoff: "Entries can disappear when memory is full, so keep only data you can rebuild.",
      },
    ],
  },
  "AV-R03": {
    title: "No rate limiting found on a public API",
    severity: "warn",
    heuristic: true,
    why: "Heuristic: the app defines public routes (including Next.js route handlers), but no rate-limit package, middleware or helper appears in the dependencies or code read. It may be done at a gateway, CDN or proxy that these files do not show.",
    check:
      "Look for rate limiting at the proxy, CDN or API gateway. If there is none, consider limits on login, signup and expensive routes first.",
    fixes: [
      {
        text: "Add a rate limiter at the proxy, CDN or gateway.",
        tradeoff: "One place to manage; the app itself stays unaware of limits.",
      },
      {
        text: "Add a limiter in the app, first on login, signup and expensive routes.",
        tradeoff:
          "Needs a shared store such as Redis to work across instances; users behind one address share a limit.",
      },
    ],
  },
  "AV-R04": {
    title: "External call without a timeout",
    severity: "warn",
    heuristic: true,
    why: "Heuristic: a call to an outside host has no AbortSignal.timeout, signal or timeout option, so a slow provider can hold the request open.",
    check:
      "Check the client's default timeout. Add an explicit one that is shorter than your own request limit, and decide what the user sees when it fires.",
    fixes: [
      {
        text: "Set a timeout on the call or on the shared client, shorter than your own request limit.",
        tradeoff: "A timeout that is too short cuts off slow successes.",
      },
      {
        text: "Pair the timeout with one retry and a clear error for the user.",
        tradeoff: "Retries multiply load on a provider that is already slow.",
      },
    ],
  },
  "AV-R05": {
    title: "Database query inside a loop",
    severity: "warn",
    heuristic: true,
    why: "Heuristic: an awaited database call sits inside a loop or an async map, which often means one query per item (the N+1 pattern).",
    check:
      "Check how many items the loop runs over. A single batched query (findMany with a list, a join, an IN clause) is usually faster, but can be heavier for very large lists.",
    fixes: [
      {
        text: "Load the items with one batched query (a list, a join, an IN clause).",
        tradeoff: "Can use more memory or hit parameter limits on very large lists.",
      },
      {
        text: "Keep the loop but cap the number of items.",
        tradeoff: "Simple, but later items are skipped or need paging.",
      },
    ],
  },
  "AV-R06": {
    title: "Slow work done during the request",
    severity: "info",
    heuristic: true,
    why: "Heuristic: a route handler sends email or SMS, processes files or handles a payment webhook directly, and the model has no queue.",
    check:
      "Check how long this takes under load and what happens if it fails. A background job adds a queue to run and monitor; for small volumes doing it inline can be the simpler choice.",
    fixes: [
      {
        text: "Move the slow work to a background job.",
        tradeoff: "Adds a queue and a worker to run, monitor and retry.",
      },
      {
        text: "Keep it inline but give it a timeout and a clear failure message.",
        tradeoff: "No new parts, but a slow provider still holds the request open.",
      },
    ],
  },
  "AV-R07": {
    title: "Secret-looking variable exposed to the browser",
    severity: "warn",
    why: "A variable with a browser-exposed prefix (NEXT_PUBLIC_, VITE_ and similar) has a name containing SECRET, PRIVATE, KEY, TOKEN or PASSWORD. Such variables are copied into the public JavaScript bundle. Only the name was read, never the value.",
    check:
      "Check whether the value is really meant to be public. If it is a secret, move it to the server and rotate it, because it may already be in a deployed bundle.",
    fixes: [
      {
        text: "Move the value to the server and call it from there.",
        tradeoff: "One more request hop for the browser.",
      },
      {
        text: "If it was a secret, rotate it, because it may already be in a deployed bundle.",
        tradeoff: "Anything using the old value must be updated.",
      },
    ],
  },
  "AV-R08": {
    title: "No health check endpoint found",
    severity: "info",
    heuristic: true,
    why: "Heuristic: the app defines routes but none of the files read has a /health, /healthz or /ready route.",
    check:
      "Check whether your host, load balancer or orchestrator probes the service another way (a TCP check, the home page). If not, a small health route lets it restart or stop sending traffic to a stuck instance.",
    fixes: [
      {
        text: "Add a small liveness route that returns 200 without touching other services.",
        tradeoff: "Cheap, but it only shows the process is up.",
      },
      {
        text: "Add a separate readiness route that checks the database.",
        tradeoff:
          "A slow database can then take the instance out of rotation; keep it apart from liveness.",
      },
    ],
  },
  "AV-R09": {
    title: "Serverless functions may connect straight to Postgres",
    severity: "warn",
    heuristic: true,
    why: "Heuristic: a serverless host file sits beside code that uses a Postgres client, and no connection pooler marker was found. Each function instance can open its own connections and exhaust the database limit under load. Only dependency names and variable names were read, not values.",
    check:
      "Check whether the connection string already points at a pooler (PgBouncer, a provider's pooled host, Prisma Accelerate, Hyperdrive). If not, consider one; it adds a service and some limits on session features.",
    fixes: [
      {
        text: "Point the connection string at a pooler (PgBouncer, a provider's pooled host, Prisma Accelerate or Hyperdrive).",
        tradeoff: "Another service and some limits on session features.",
      },
      {
        text: "Limit the pool size per function and the number of concurrent functions.",
        tradeoff: "Caps the damage, but can slow bursts of traffic.",
      },
    ],
  },
  "AV-R10": {
    title: "Data service exposed or unprotected in docker-compose",
    severity: "warn",
    why: "A compose service for a data store publishes its port to the host on all interfaces, or Redis has no password (requirepass) configured.",
    check:
      "Check where this compose file is used. For local development it is often fine; on a shared or public machine, bind ports to 127.0.0.1, set a password and keep the service off public networks.",
    fixes: [
      {
        text: "Bind published ports to 127.0.0.1 or remove them.",
        tradeoff: "Other machines can no longer reach the service, including ones that should.",
      },
      {
        text: "Set a password (requirepass) and keep the service off public networks.",
        tradeoff: "Every client needs the password.",
      },
    ],
  },
  "AV-R11": {
    title: "Some synchronous calls have a timeout recorded and these do not",
    severity: "info",
    heuristic: true,
    why: "Heuristic: the model records a timeout on at least one synchronous connection but not on these, so the calls may behave differently when a service is slow. A model that records no timeouts at all is not flagged, because that only means none were looked for.",
    check:
      "Look at the client or call behind each connection. Decide whether the missing timeout is deliberate, and record it in the model when it is set.",
    fixes: [
      {
        text: "Set an explicit timeout on each call, shorter than your own request limit.",
        tradeoff: "A timeout that is too short cuts off slow successes.",
      },
      {
        text: "Share one client configuration so every call gets the same timeout.",
        tradeoff: "One value fits all calls badly if some are slower on purpose.",
      },
    ],
  },
  "AV-R12": {
    title: "Retries with no backoff noted",
    severity: "warn",
    heuristic: true,
    why: "Heuristic: a connection retries a failed call, and nothing in its evidence notes a delay between attempts (backoff or jitter). Immediate retries can pile load onto a service that is already struggling.",
    check:
      "Check how the retry waits. If it retries at once, add a growing delay with some randomness, and a limit on attempts.",
    fixes: [
      {
        text: "Wait longer after each failed attempt (exponential backoff) and add jitter.",
        tradeoff: "Slower recovery for the caller when the failure was brief.",
      },
      {
        text: "Cap the number of attempts and fail with a clear error.",
        tradeoff: "Some calls that would have succeeded on a later try now fail.",
      },
    ],
  },
  "AV-R13": {
    title: "Connection crosses a trust zone with no authentication or encryption",
    severity: "warn",
    why: "A connection joins components in different trust zones and is recorded as having no authentication (auth: none) or no TLS (tls: false), with a file as evidence.",
    check:
      "Check whether the connection stays on a private network that you control. If it can be reached from outside its zone, add authentication and encryption.",
    fixes: [
      {
        text: "Turn on TLS for the connection (mutual TLS inside a private network if you can).",
        tradeoff: "Certificates to issue and renew; a small cost per connection.",
      },
      {
        text: "Require a credential (a token, API key or signed request) on the receiving side.",
        tradeoff: "Every caller needs the credential and a way to rotate it.",
      },
    ],
  },
  "AV-R14": {
    title: "Personal data reaches a third party or logs",
    severity: "warn",
    why: "A connection is recorded as carrying personal data (pii) to a component in the third-party zone or to one that holds logs, or a third-party component is recorded as holding it.",
    check:
      "Check whether this data really goes there, what the other side does with it, and whether it can be left out, masked or hashed first.",
    fixes: [
      {
        text: "Remove or mask personal fields before the data leaves (or before it is logged).",
        tradeoff: "Support and debugging lose some detail.",
      },
      {
        text: "Check the third party's data agreement and retention, and record the decision.",
        tradeoff: "Takes time; it may show the service is not a fit.",
      },
    ],
  },
  "AV-R15": {
    title: "AI agent with write or run tools and no audit grade",
    severity: "warn",
    why: "An AI component (an agent, an MCP server or a skill) is recorded with tools that can write files or run commands, and no audit result is linked to it, so nobody has recorded a look at what it can do.",
    check:
      "Look at what the tools can reach. Run an audit on the component (for example with aisle audit) and link the result, or narrow the tools.",
    fixes: [
      {
        text: "Run an audit on it and link the result as its audit file.",
        tradeoff: "An audit reduces risk; it cannot prove safety.",
      },
      {
        text: "Give it only the tools it needs, read-only where possible.",
        tradeoff: "Some tasks need a person to approve a step instead.",
      },
    ],
  },
  "AV-R16": {
    title: "AI component with a low audit grade",
    severity: "warn",
    why: "An AI component has an audit grade of D or F in a linked audit result.",
    check:
      "Open the audit file and read the findings. Decide whether to fix, replace or remove the component.",
    fixes: [
      {
        text: "Fix the findings in the audit and run it again.",
        tradeoff: "Time spent; the grade only reflects the checks that exist.",
      },
      {
        text: "Replace the component with one that audits better, or remove it.",
        tradeoff: "You lose what it did, and a replacement needs its own look.",
      },
    ],
  },
  "AV-R17": {
    title: "Many synchronous calls in one step",
    severity: "info",
    heuristic: true,
    why: "Heuristic: one step of a request flow makes more than four synchronous calls at the same time, so the step is as slow as the slowest of them and fails if any one of them does.",
    check:
      "Check whether all of them must finish before the request can answer. Some may be able to run later or be optional.",
    fixes: [
      {
        text: "Move calls that are not needed for the answer to a background job.",
        tradeoff: "Adds a queue; the result is not ready when the user gets the answer.",
      },
      {
        text: "Mark the calls that can fail gracefully as optional and give them a timeout.",
        tradeoff: "The answer can be partial, so the page must cope with missing pieces.",
      },
    ],
  },
  "AV-R18": {
    title: "Single copy of a component that several flows depend on",
    severity: "warn",
    why: "A component is recorded as running as one replica, and three or more request flows pass through it, so one failure or restart interrupts all of them.",
    check:
      "Check whether one copy is enough: how long a restart takes, and what the flows do while it is gone.",
    fixes: [
      {
        text: "Run a second copy behind a load balancer.",
        tradeoff: "Costs more, and state held in memory must move out or be shared.",
      },
      {
        text: "Keep one copy but add a health check and fast automatic restart.",
        tradeoff: "There is still a gap during each restart.",
      },
    ],
  },
};

export const ev = (file, line, note) => ({ file, line, note });
/** A risk from rule `id`, naming `nodes` and pointing at `evidence`. */
export const risk = (id, nodes, evidence, extra = {}) => ({
  id,
  title: RULES[id].title,
  severity: RULES[id].severity,
  nodes: uniqueSorted(nodes.filter(Boolean)),
  evidence: evidence.slice(0, MAX_EVIDENCE),
  why: RULES[id].why,
  check: RULES[id].check,
  fixes: RULES[id].fixes,
  source: "rule",
  ...extra,
});
