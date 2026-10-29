// Stage 3b: add rule-based POSSIBLE risks (AV-R01 to AV-R10) to a model. Reads the project's files as text
// only: no project code is run, secret files are never opened, nothing touches the network. Every risk is
// something to check, not a verdict, and carries the evidence it is based on.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  balanced,
  capLines,
  envKeyNames,
  findLine,
  isEntry,
  isExampleEnv,
  listFiles,
  maskComments,
  parseArgs,
  parseYaml,
  readText,
} from "./_lib.mjs";
import { loadCatalog } from "./model-check.mjs";

const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const TESTISH =
  /(^|\/)(__tests__|tests?|specs?|e2e|__mocks__)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/;
const MAX_EVIDENCE = 5;

/** Rule texts. `heuristic` rules say so in their explanation. */
export const RULES = {
  "AV-R01": {
    title: "Single database with no replica or backup configuration",
    severity: "warn",
    why: "The model has one database and none of the files read mention a replica, a standby, a backup tool or a managed database service.",
    check:
      "Confirm where backups are taken and that a restore has been tried. Decide whether a replica or a managed service is worth its cost for this project.",
  },
  "AV-R02": {
    title: "Cache entries written without an expiry",
    severity: "info",
    heuristic: true,
    why: "Heuristic: a Redis write has no expiry option (EX, PX, ttl) and no expire call close by, so the entry stays until it is evicted or deleted.",
    check:
      "Check the eviction policy and whether these keys should expire. Some data (counters, locks you release yourself) is meant to stay; adding a TTL there can lose data.",
  },
  "AV-R03": {
    title: "No rate limiting found on a public API",
    severity: "warn",
    heuristic: true,
    why: "Heuristic: the backend defines routes, but no rate-limit package or middleware appears in the dependencies or code read. It may be done at a gateway, CDN or proxy that these files do not show.",
    check:
      "Look for rate limiting at the proxy, CDN or API gateway. If there is none, consider limits on login, signup and expensive routes first.",
  },
  "AV-R04": {
    title: "External call without a timeout",
    severity: "warn",
    heuristic: true,
    why: "Heuristic: a call to an outside host has no AbortSignal.timeout, signal or timeout option, so a slow provider can hold the request open.",
    check:
      "Check the client's default timeout. Add an explicit one that is shorter than your own request limit, and decide what the user sees when it fires.",
  },
  "AV-R05": {
    title: "Database query inside a loop",
    severity: "warn",
    heuristic: true,
    why: "Heuristic: an awaited database call sits inside a loop or an async map, which often means one query per item (the N+1 pattern).",
    check:
      "Check how many items the loop runs over. A single batched query (findMany with a list, a join, an IN clause) is usually faster, but can be heavier for very large lists.",
  },
  "AV-R06": {
    title: "Slow work done during the request",
    severity: "info",
    heuristic: true,
    why: "Heuristic: a route handler sends email or SMS, processes files or handles a payment webhook directly, and the model has no queue.",
    check:
      "Check how long this takes under load and what happens if it fails. A background job adds a queue to run and monitor; for small volumes doing it inline can be the simpler choice.",
  },
  "AV-R07": {
    title: "Secret-looking variable exposed to the browser",
    severity: "warn",
    why: "A variable with a browser-exposed prefix (NEXT_PUBLIC_, VITE_ and similar) has a name containing SECRET, PRIVATE, KEY, TOKEN or PASSWORD. Such variables are copied into the public JavaScript bundle. Only the name was read, never the value.",
    check:
      "Check whether the value is really meant to be public. If it is a secret, move it to the server and rotate it, because it may already be in a deployed bundle.",
  },
  "AV-R08": {
    title: "No health check endpoint found",
    severity: "info",
    heuristic: true,
    why: "Heuristic: the backend defines routes but none of the files read has a /health, /healthz or /ready route.",
    check:
      "Check whether your host, load balancer or orchestrator probes the service another way (a TCP check, the home page). If not, a small health route lets it restart or stop sending traffic to a stuck instance.",
  },
  "AV-R09": {
    title: "Serverless functions may connect straight to Postgres",
    severity: "warn",
    heuristic: true,
    why: "Heuristic: a serverless host file sits beside code that uses a Postgres client, and no connection pooler marker was found. Each function instance can open its own connections and exhaust the database limit under load. Only dependency names and variable names were read, not values.",
    check:
      "Check whether the connection string already points at a pooler (PgBouncer, a provider's pooled host, Prisma Accelerate, Hyperdrive). If not, consider one; it adds a service and some limits on session features.",
  },
  "AV-R10": {
    title: "Data service exposed or unprotected in docker-compose",
    severity: "warn",
    why: "A compose service for a data store publishes its port to the host on all interfaces, or Redis has no password (requirepass) configured.",
    check:
      "Check where this compose file is used. For local development it is often fine; on a shared or public machine, bind ports to 127.0.0.1, set a password and keep the service off public networks.",
  },
};

const dirOf = (f) => (path.posix.dirname(f) === "." ? "" : path.posix.dirname(f));
const lineOfIndex = (text, index) => text.slice(0, index).split("\n").length;
const uniq = (xs) => [...new Set(xs)];

const HOSTING_SERVERLESS = ["vercel.json", "netlify.toml", "wrangler.toml"];

/** Read everything the rules need, once. */
export function gather(root, model, catalog = loadCatalog()) {
  const want = (n) =>
    (SOURCE.test(n) && !/\.d\.ts$/.test(n)) ||
    n === "package.json" ||
    n === "schema.prisma" ||
    n === "Dockerfile" ||
    n.startsWith("Dockerfile.") ||
    /^(docker-compose|compose)(\.[\w-]+)?\.ya?ml$/.test(n) ||
    isExampleEnv(n) ||
    /\.conf$/.test(n) ||
    Boolean(catalog.hosting[n]);
  const { files: list, stats } = listFiles(root, want);
  const ctx = {
    model,
    catalog,
    stats,
    source: [],
    packages: [],
    compose: [],
    docker: [],
    hosting: [],
    prisma: [],
    env: [],
    conf: [],
  };
  for (const f of list) {
    const base = path.posix.basename(f);
    const text = readText(path.join(root, f));
    if (text === null) continue;
    if (base === "package.json") {
      try {
        const j = JSON.parse(text);
        const deps = { ...j.dependencies, ...j.devDependencies };
        ctx.packages.push({ rel: f, dir: dirOf(f), deps: Object.keys(deps).sort(), text });
      } catch {
        /* an unreadable package.json is skipped */
      }
    } else if (base === "schema.prisma") ctx.prisma.push({ rel: f, dir: dirOf(f), text });
    else if (base === "Dockerfile" || base.startsWith("Dockerfile."))
      ctx.docker.push({ rel: f, text });
    else if (/^(docker-compose|compose)(\.[\w-]+)?\.ya?ml$/.test(base)) {
      const y = parseYaml(text);
      ctx.compose.push({ rel: f, text, services: y.data.services ?? {}, lineOf: y.lineOf });
    } else if (isExampleEnv(base))
      for (const k of envKeyNames(text)) ctx.env.push({ ...k, file: f });
    else if (/\.conf$/.test(base)) ctx.conf.push({ rel: f, text });
    else if (catalog.hosting[base]) ctx.hosting.push({ rel: f, dir: dirOf(f), base, text });
    else if (SOURCE.test(base) && !TESTISH.test(f))
      ctx.source.push({ rel: f, dir: dirOf(f), text: maskComments(text) });
  }
  return ctx;
}

// ---- helpers shared by the rules
const appNodes = (m) => m.nodes.filter((n) => ["frontend", "backend", "worker"].includes(n.role));
function ownerNode(ctx, file) {
  let best = null;
  let bestLen = -1;
  for (const n of appNodes(ctx.model)) {
    for (const ev of n.evidence ?? []) {
      if (!/(^|\/)(package\.json|Dockerfile[\w.]*)$/.test(ev.file)) continue;
      const d = dirOf(ev.file);
      if ((d === "" || file === d || file.startsWith(d + "/")) && d.length > bestLen) {
        best = n;
        bestLen = d.length;
      }
    }
  }
  return best;
}
const ev = (file, line, note) => ({ file, line, note });
const risk = (id, nodes, evidence, extra = {}) => ({
  id,
  title: RULES[id].title,
  severity: RULES[id].severity,
  nodes: uniq(nodes.filter(Boolean)).sort(),
  evidence: evidence.slice(0, MAX_EVIDENCE),
  why: RULES[id].why,
  check: RULES[id].check,
  source: "rule",
  ...extra,
});
const byRole = (m, role) => m.nodes.filter((n) => n.role === role);

const ROUTE_DEF =
  /\b(?:app|router|server|api|fastify|route|routes|r)\.(?:get|post|put|patch|delete|all)\s*\(\s*["'`]\//;
const NEXT_HANDLER = /export\s+(?:async\s+)?(?:function|const)\s+(?:GET|POST|PUT|PATCH|DELETE)\b/;
const NEST_ROUTE = /@(?:Controller|Get|Post|Put|Patch|Delete)\s*\(/;
const isRouteFile = (f) =>
  ROUTE_DEF.test(f.text) ||
  NEST_ROUTE.test(f.text) ||
  (/(^|\/)(route|api)\b/.test(f.rel) && NEXT_HANDLER.test(f.text));
const isHandlerFile = (f) =>
  isRouteFile(f) ||
  /(^|\/)(routes?|controllers?|handlers?|api)\//.test(f.rel) ||
  NEXT_HANDLER.test(f.text);

// ---- the rules: each takes the gathered context and returns risks
function r01(ctx) {
  const dbs = byRole(ctx.model, "database");
  if (dbs.length !== 1) return [];
  const blob = [...ctx.compose, ...ctx.docker, ...ctx.hosting, ...ctx.conf]
    .map((x) => x.text)
    .join("\n")
    .toLowerCase();
  const deps = ctx.packages.flatMap((p) => p.deps).join(" ");
  if (
    /\b(replicas?|standby|pgbackrest|wal-g|barman|pg_basebackup|backups?|read[-_]only)\b/.test(blob)
  )
    return [];
  if (
    /(@neondatabase\/|@planetscale\/|@supabase\/|@vercel\/postgres|@libsql\/|@turso\/)/.test(deps)
  )
    return [];
  const db = dbs[0];
  const rank = (e) =>
    /^image/.test(e.note ?? "")
      ? 0
      : /^datasource/.test(e.note ?? "")
        ? 1
        : /^env key/.test(e.note ?? "")
          ? 3
          : 2;
  const sorted = [...(db.evidence ?? [])].sort((a, b) => rank(a) - rank(b));
  return [risk("AV-R01", [db.id], sorted.slice(0, 2))];
}

function r02(ctx) {
  const out = [];
  const nodes = [];
  for (const f of ctx.source) {
    if (!/(?:from\s+|require\(\s*)["'](?:ioredis|redis|@upstash\/redis)["']/.test(f.text)) continue;
    const names = uniq([
      ...[
        ...f.text.matchAll(
          /\b(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:new\s+(?:Redis|IORedis|Cluster)|createClient|Redis\.fromEnv)/g,
        ),
      ].map((m) => m[1]),
    ]);
    const recv = names.length ? `(?:${names.join("|")}|\\w*[Rr]edis\\w*)` : "\\w*[Rr]edis\\w*";
    const re = new RegExp(`\\b${recv}\\.(set|hset|hmset)\\s*\\(`, "g");
    let m;
    while ((m = re.exec(f.text))) {
      const open = m.index + m[0].length - 1;
      const call = balanced(f.text, open);
      if (!call) continue;
      const near = f.text
        .slice(call.end, call.end + 400)
        .split("\n")
        .slice(0, 6)
        .join("\n");
      const hasExpire = /\.(?:expire|pexpire|expireat)\s*\(/.test(near);
      let ok = hasExpire;
      if (m[1] === "set")
        ok =
          ok ||
          /["'`](?:EX|PX|EXAT|PXAT|KEEPTTL)["'`]/i.test(call.text) ||
          /\b(?:ex|px|exat|pxat|ttl|expire\w*)\s*:/i.test(call.text) ||
          /\bttl\b/i.test(call.text);
      if (!ok) {
        out.push(ev(f.rel, lineOfIndex(f.text, m.index), `redis .${m[1]}() without an expiry`));
        const owner = ownerNode(ctx, f.rel);
        if (owner) nodes.push(owner.id);
      }
    }
  }
  if (!out.length) return [];
  const cache = byRole(ctx.model, "cache").map((n) => n.id);
  return [risk("AV-R02", [...cache, ...nodes], out)];
}

const RATE_DEPS =
  /^(express-rate-limit|rate-limiter-flexible|@fastify\/rate-limit|@upstash\/ratelimit|@nestjs\/throttler|hono-rate-limiter|express-slow-down|koa-ratelimit|koa2-ratelimit|@hono-rate-limiter\/.*)$/;
function r03(ctx) {
  const backends = byRole(ctx.model, "backend");
  if (!backends.length) return [];
  const routes = ctx.source.filter(isRouteFile);
  if (!routes.length) return [];
  if (ctx.packages.some((p) => p.deps.some((d) => RATE_DEPS.test(d)))) return [];
  if (
    ctx.source.some((f) =>
      /\b(?:rateLimit|rateLimiter|Ratelimit|RateLimiter|ThrottlerModule|slowDown)\b/.test(f.text),
    )
  )
    return [];
  if (ctx.conf.some((c) => /\blimit_req\b/.test(c.text))) return [];
  const evidence = routes
    .slice(0, 3)
    .map((f) =>
      ev(f.rel, lineOfIndex(f.text, Math.max(0, f.text.search(ROUTE_DEF))), "route defined here"),
    );
  return [
    risk(
      "AV-R03",
      backends.map((n) => n.id),
      evidence,
    ),
  ];
}

const LOCAL_HOST = /^(localhost|127\.|0\.0\.0\.0|\[::1\]|.*\.local$|.*\.internal$|.*\.localhost$)/;
function r04(ctx) {
  const out = [];
  const nodes = [];
  const externals = byRole(ctx.model, "external");
  const re =
    /\b(fetch|axios(?:\.(?:get|post|put|patch|delete|head|request))?|got|ky)\s*\(\s*(["'`])(https?:\/\/([^/"'`\s$:?#]+)[^"'`\s$]*)/g;
  for (const f of ctx.source) {
    let m;
    while ((m = re.exec(f.text))) {
      const host = m[4].toLowerCase();
      if (!host.includes(".") || LOCAL_HOST.test(host)) continue;
      const open = f.text.indexOf("(", m.index);
      const call = balanced(f.text, open);
      if (!call) continue;
      if (/AbortSignal\.timeout|\bsignal\b|\btimeout\b/.test(call.text)) continue;
      out.push(ev(f.rel, lineOfIndex(f.text, m.index), `${m[1]} to ${host} without a timeout`));
      const ext = externals.find((n) => host.includes(n.tech) || host.includes(n.id));
      const target = ext ?? ownerNode(ctx, f.rel);
      if (target) nodes.push(target.id);
      const owner = ownerNode(ctx, f.rel);
      if (owner && ext) nodes.push(owner.id);
    }
  }
  return out.length ? [risk("AV-R04", nodes, out)] : [];
}

const LOOP_START = /\b(?:for|while)\s*(?:await\s*)?\(|\.(?:forEach|map|flatMap)\s*\(\s*async\b/g;
const ORM_AWAIT =
  /\bawait\s+(?:this\.)?[\w$.]*?\b(?:prisma|knex|sequelize|em|manager|supabase|drizzle|tx|\w+Repository|\w+Repo|repo|\w+Model)\b[\w$.]*\.(?:findUnique\w*|findFirst\w*|findMany|findOne|findById|findByPk|find|create\w*|update\w*|delete\w*|destroy|upsert|count|aggregate|select|insert|save|remove)\s*\(/;
const SQL_AWAIT =
  /\bawait\s+[\w$.]*\b(?:client|conn|connection|pool|db)\.(?:query|execute|one|many|any|none|oneOrNone)\s*\(/;
function r05(ctx) {
  const out = [];
  const nodes = [];
  for (const f of ctx.source) {
    const seen = new Set();
    let m;
    LOOP_START.lastIndex = 0;
    while ((m = LOOP_START.exec(f.text))) {
      const open = f.text.indexOf("(", m.index);
      const head = balanced(f.text, open);
      if (!head) continue;
      let body;
      let base = open + 1;
      if (!m[0].startsWith(".")) {
        let j = head.end;
        while (/\s/.test(f.text[j] ?? "")) j++;
        if (f.text[j] === "{") {
          body = balanced(f.text, j)?.text ?? null;
          base = j + 1;
        } else {
          body = f.text.slice(j, f.text.indexOf(";", j) + 1);
          base = j;
        }
        if (body === null) continue;
      } else body = head.text;
      for (const re of [ORM_AWAIT, SQL_AWAIT]) {
        const g = new RegExp(re.source, "g");
        let q;
        while ((q = g.exec(body))) {
          const line = lineOfIndex(f.text, base + q.index);
          if (seen.has(line)) continue;
          seen.add(line);
          out.push(ev(f.rel, line, "awaited database call inside a loop"));
          const owner = ownerNode(ctx, f.rel);
          if (owner) nodes.push(owner.id);
        }
      }
    }
  }
  out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
  return out.length ? [risk("AV-R05", nodes, out)] : [];
}

const SLOW =
  /\b(?:resend\.emails\.send|\.emails\.send|sendMail|sgMail\.send|messages\.create|sharp\s*\(|ffmpeg|puppeteer\.launch|\.constructEvent)\b/;
function r06(ctx) {
  if (byRole(ctx.model, "queue").length) return [];
  const out = [];
  const nodes = [];
  for (const f of ctx.source) {
    if (!isHandlerFile(f)) continue;
    const m = SLOW.exec(f.text);
    if (!m) continue;
    out.push(ev(f.rel, lineOfIndex(f.text, m.index), `${m[0].trim()} called in a request handler`));
    const owner = ownerNode(ctx, f.rel);
    if (owner) nodes.push(owner.id);
  }
  return out.length ? [risk("AV-R06", nodes, out)] : [];
}

const BROWSER_PREFIX = /^(NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|PUBLIC_|NUXT_PUBLIC_|GATSBY_)/;
const SENSITIVE = /(SECRET|PRIVATE|KEY|TOKEN|PASSWORD)/;
const PUBLIC_BY_DESIGN = /(PUBLISHABLE|ANON|SITE_KEY|PUBLIC_KEY|MEASUREMENT)/;
export const isSecretLookingBrowserName = (name) =>
  BROWSER_PREFIX.test(name) && SENSITIVE.test(name) && !PUBLIC_BY_DESIGN.test(name);
function r07(ctx) {
  const out = [];
  const seen = new Set();
  for (const k of ctx.env)
    if (isSecretLookingBrowserName(k.key) && !seen.has(k.key)) {
      seen.add(k.key);
      out.push(ev(k.file, k.line, `env name ${k.key} (value not read)`));
    }
  for (const f of ctx.source) {
    const re =
      /\b(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)|\b(?:process\.env|import\.meta\.env)\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]/g;
    let m;
    while ((m = re.exec(f.text))) {
      const name = m[1] ?? m[2];
      if (isSecretLookingBrowserName(name) && !seen.has(name)) {
        seen.add(name);
        out.push(ev(f.rel, lineOfIndex(f.text, m.index), `env name ${name} (value not read)`));
      }
    }
  }
  return out.length
    ? [
        risk(
          "AV-R07",
          byRole(ctx.model, "frontend").map((n) => n.id),
          out,
        ),
      ]
    : [];
}

const HEALTH_ROUTE =
  /["'`]\/(?:api\/)?(?:health|healthz|ready|readyz|livez|healthcheck)(?:["'`/?])/;
const HEALTH_PATH = /(^|\/)(?:health|healthz|ready|readyz|livez|healthcheck)(\/|\.[cm]?[jt]sx?$)/;
function r08(ctx) {
  const backends = byRole(ctx.model, "backend");
  if (!backends.length || !ctx.source.some(isRouteFile)) return [];
  if (ctx.source.some((f) => HEALTH_ROUTE.test(f.text) || HEALTH_PATH.test(f.rel))) return [];
  const evidence = backends.flatMap((n) =>
    (n.evidence ?? [])
      .filter((e) => /^dependency|^python|^go module/.test(e.note ?? ""))
      .slice(0, 1),
  );
  return [
    risk(
      "AV-R08",
      backends.map((n) => n.id),
      evidence,
    ),
  ];
}

const POOLER_DEPS = /^(@neondatabase\/serverless|@vercel\/postgres|@prisma\/extension-accelerate)$/;
function r09(ctx) {
  const out = [];
  const nodes = [];
  const hasPgNode = ctx.model.nodes.some((n) => n.tech === "postgresql");
  for (const h of ctx.hosting) {
    if (!HOSTING_SERVERLESS.includes(h.base)) continue;
    const inside = (d) => h.dir === "" || d === h.dir || d.startsWith(h.dir + "/");
    const pkgs = ctx.packages.filter((p) => inside(p.dir));
    const prismaPg = ctx.prisma.some(
      (s) => inside(s.dir) && /provider\s*=\s*"postgres(?:ql)?"/.test(s.text),
    );
    const client = pkgs.flatMap((p) =>
      p.deps
        .filter(
          (d) =>
            d === "pg" ||
            d === "postgres" ||
            (d === "@prisma/client" && prismaPg) ||
            (d === "drizzle-orm" && hasPgNode),
        )
        .map((d) => ({ p, d })),
    );
    if (!client.length) continue;
    if (pkgs.some((p) => p.deps.some((d) => POOLER_DEPS.test(d)))) continue;
    const scoped = ctx.source.filter((f) => inside(f.dir));
    if (scoped.some((f) => /pgbouncer|prisma:\/\/|hyperdrive|pooler/i.test(f.text))) continue;
    if (/pgbouncer|hyperdrive|pooler/i.test(h.text)) continue;
    if (
      ctx.env.some(
        (k) => inside(dirOf(k.file)) && /(POOL|DIRECT_URL|NON_POOLING|ACCELERATE)/.test(k.key),
      )
    )
      continue;
    out.push(ev(h.rel, 1, `serverless host file ${h.base}`));
    out.push(
      ev(
        client[0].p.rel,
        findLine(client[0].p.text, new RegExp(`"${client[0].d.replace(/[/@.-]/g, "\\$&")}"\\s*:`)),
        `Postgres client ${client[0].d}`,
      ),
    );
    const host = ctx.model.nodes.find((n) => (n.evidence ?? []).some((e) => e.file === h.rel));
    if (host) nodes.push(host.id);
    nodes.push(...ctx.model.nodes.filter((n) => n.tech === "postgresql").map((n) => n.id));
  }
  return out.length ? [risk("AV-R09", nodes, out)] : [];
}

const LOOPBACK = /^(127\.|localhost$|::1$|\[::1\])/;
function publishedOnAllInterfaces(port) {
  if (port && typeof port === "object") {
    if (port.published === undefined) return false;
    return !LOOPBACK.test(String(port.host_ip ?? ""));
  }
  const parts = String(port)
    .replace(/\/(tcp|udp)$/, "")
    .split(":");
  if (parts.length === 1) return false; // container port only: not published
  if (parts.length === 2) return true; // host:container
  return !LOOPBACK.test(parts[0]); // ip:host:container
}
function hasRedisPassword(def) {
  const cmd = Array.isArray(def.command) ? def.command.join(" ") : String(def.command ?? "");
  const env = Array.isArray(def.environment)
    ? def.environment.map(String).join(" ")
    : Object.keys(def.environment ?? {}).join(" ");
  return /requirepass|--requirepass/.test(cmd) || /REDIS_PASSWORD|REDIS_ARGS/.test(env);
}
function r10(ctx) {
  const out = [];
  const nodes = [];
  const DATA = ["database", "cache", "queue", "search"];
  for (const c of ctx.compose) {
    for (const [svc, def] of Object.entries(c.services)) {
      if (!def || typeof def.image !== "string") continue;
      const name = def.image.split("@")[0].split(":")[0].split("/").pop().toLowerCase();
      const info = ctx.catalog.images[name];
      if (!info || !DATA.includes(info.role)) continue;
      const imageLine = c.lineOf(`services.${svc}.image`);
      const portsLine = c.lineOf(`services.${svc}.ports`);
      const ports = Array.isArray(def.ports) ? def.ports : [];
      const open = ports.filter(publishedOnAllInterfaces);
      const noPass = info.tech === "redis" && !hasRedisPassword(def);
      if (!open.length && !noPass) continue;
      if (open.length)
        out.push(
          ev(
            c.rel,
            portsLine,
            `${svc}: port ${open.map((p) => (typeof p === "object" ? p.published : p)).join(", ")} published on all interfaces`,
          ),
        );
      if (noPass)
        out.push(ev(c.rel, imageLine, `${svc}: Redis has no requirepass or REDIS_PASSWORD`));
      const node = ctx.model.nodes.find((n) =>
        (n.evidence ?? []).some((e) => e.file === c.rel && e.line === imageLine),
      );
      if (node) nodes.push(node.id);
    }
  }
  return out.length ? [risk("AV-R10", nodes, out)] : [];
}

export const RULE_FUNCTIONS = [r01, r02, r03, r04, r05, r06, r07, r08, r09, r10];

/** All rule risks for `model`, found by reading `root`. Pure with respect to the model. */
export function findRisks(root, model, catalog = loadCatalog()) {
  const ctx = gather(root, model, catalog);
  const risks = RULE_FUNCTIONS.flatMap((fn) => fn(ctx)).sort((a, b) => (a.id < b.id ? -1 : 1));
  return { risks, stats: ctx.stats };
}

function run(argv) {
  const { flags } = parseArgs(argv, { strings: ["model", "root", "out"] });
  const modelFile = path.resolve(flags.model ?? "docs/architecture.json");
  const root = path.resolve(flags.root ?? ".");
  const out = path.resolve(flags.out ?? modelFile);
  let model;
  try {
    model = JSON.parse(readFileSync(modelFile, "utf8"));
  } catch (e) {
    console.error(`risk-check: cannot read ${modelFile}: ${e.message}`);
    return 2;
  }
  if (!Array.isArray(model.nodes) || !Array.isArray(model.edges)) {
    console.error("risk-check: the model has no nodes or edges. Run model-check.mjs first.");
    return 2;
  }
  const { risks, stats } = findRisks(root, model);
  const kept = (model.risks ?? []).filter((r) => r.source !== "rule");
  model.risks = [...kept, ...risks];
  writeFileSync(out, JSON.stringify(model, null, 2) + "\n");
  const lines = risks.map((r) => {
    const e = r.evidence[0];
    return `${r.id} ${r.severity.padEnd(4)} ${r.title}${e ? ` - ${e.file}:${e.line}` : ""}`;
  });
  const notes = [];
  if (stats.skippedSecret) notes.push(`${stats.skippedSecret} secret-named file(s) never opened`);
  if (stats.truncated) notes.push("stopped at 2,000 files");
  const summary = [
    `${risks.length} possible risk(s) from rules, ${kept.length} added by the agent. These are things to check, not verdicts.`,
    ...notes,
    `Model updated: ${path.relative(process.cwd(), out) || out}`,
  ].join("\n");
  console.log(capLines(lines, summary));
  return 0;
}

if (isEntry(import.meta.url)) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (e) {
    console.error(`risk-check: ${e.message}`);
    process.exitCode = 2;
  }
}
