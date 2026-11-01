// Edge candidates: connections the files suggest but do not prove. Reads JavaScript and TypeScript source as
// text (never runs it): imports of known client libraries, the constructors that follow them, literal API hosts,
// queue producers and consumers, and the environment variable NAMES the code reads. Every candidate has a
// confidence and the file and line it comes from, and the agent confirms or drops each one.
import path from "node:path";
import { balanced } from "./_lib.mjs";

const APP_ROLES = new Set(["frontend", "backend", "worker"]);
const PROTOCOL = {
  redis: "TCP (Redis)",
  postgresql: "TCP (SQL)",
  mysql: "TCP (SQL)",
  mongodb: "TCP (MongoDB)",
  sqlite: "file",
  bullmq: "TCP (Redis queue)",
};
const PROTOCOL_BY_ROLE = {
  cache: "TCP",
  database: "TCP",
  queue: "TCP",
  external: "HTTPS",
  storage: "HTTPS",
  search: "HTTPS",
  observability: "HTTPS",
};
const RANK = { low: 0, medium: 1, high: 2 };
const MAX_EVIDENCE = 5;
const URLISH = /_(URL|URI|HOST|ENDPOINT|BASE_URL|API|API_URL)$/;
const NOISE = new Set([
  "URL",
  "URI",
  "HOST",
  "ENDPOINT",
  "BASE",
  "API",
  "PUBLIC",
  "NEXT",
  "VITE",
  "SERVER",
  "INTERNAL",
]);

export const dirOf = (rel) => (path.posix.dirname(rel) === "." ? "" : path.posix.dirname(rel));
export const lineOfIndex = (text, index) => text.slice(0, index).split("\n").length;
const slugWords = (s) =>
  String(s)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);

/** The app, worker or frontend node whose folder holds `file`: the deepest folder wins. */
export function ownerOf(nodes, file) {
  let best = null;
  let bestLen = -1;
  for (const n of nodes) {
    if (!APP_ROLES.has(n.role)) continue;
    for (const ev of n.evidence ?? []) {
      if (
        !/(^|\/)(package\.json|Dockerfile[\w.]*|go\.mod|requirements\.txt|pyproject\.toml)$/.test(
          ev.file,
        )
      )
        continue;
      const d = dirOf(ev.file);
      if ((d === "" || file === d || file.startsWith(d + "/")) && d.length > bestLen) {
        best = n;
        bestLen = d.length;
      }
    }
  }
  return best;
}

/** The node a library or host stands for: same technology, else the only non-app node of that role. */
function targetFor(nodes, entry) {
  const infra = nodes.filter((n) => !APP_ROLES.has(n.role));
  const same = infra.find((n) => n.tech === entry.tech);
  if (same) return same;
  // by role, but an AI part (a vector store) is never taken for a plain database or search service
  const sameRole = infra.filter(
    (n) => n.role === entry.role && Boolean(n.ai) === Boolean(entry.ai),
  );
  return sameRole.length === 1 ? sameRole[0] : null;
}

const specifierRoot = (spec) => {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
};

/** Names a file brings in from `spec`: `import Redis from "x"`, `import { Queue, Worker } from "x"`, and the CommonJS form of the same. */
function importedNames(text, spec) {
  const names = [];
  const esc = spec.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  for (const m of text.matchAll(new RegExp(`import\\s+([^;]*?)\\s+from\\s+["']${esc}["']`, "g"))) {
    for (const part of m[1].replace(/[{}*]/g, ",").split(","))
      names.push(...part.split(/\s+as\s+|\s+/).filter((w) => /^[A-Za-z_$][\w$]*$/.test(w)));
  }
  for (const m of text.matchAll(
    new RegExp(
      `(?:const|let|var)\\s+(\\{[^}]*\\}|[\\w$]+)\\s*=\\s*require\\(\\s*["']${esc}["']`,
      "g",
    ),
  ))
    names.push(
      ...m[1]
        .replace(/[{}]/g, ",")
        .split(",")
        .map((w) => w.split(":").pop().trim())
        .filter(Boolean),
    );
  return [...new Set(names)];
}

const TIMEOUT_RES = [
  /\b(?:timeout|connectTimeout|commandTimeout|requestTimeout)\s*:\s*(\d[\d_]*)\b/,
  /\bAbortSignal\.timeout\(\s*(\d[\d_]*)\s*\)/,
];
const RETRY_RE = /\b(?:retries|maxRetries|max_retries|maxAttempts)\s*:\s*(\d+)\b/;
const BREAKER = /["'](opossum|cockatiel)["']/;
const CALL_START =
  /\b(?:new\s+[A-Z]\w*|fetch|axios(?:\.\w+)?|got(?:\.\w+)?|ky(?:\.\w+)?|\w+\.(?:get|post|put|patch|delete|request))\s*\(/;
// a catch block that answers with an error status is not a fallback
const ERROR_ANSWER = /\b(?:res\.status\(\s*5\d\d|status:\s*5\d\d|sendStatus\(\s*5\d\d)/;

/** try blocks whose catch block neither rethrows nor answers with an error: [{ from, to, catchLine }] as line ranges. */
function fallbackBlocks(text) {
  const out = [];
  for (const m of text.matchAll(/\btry\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    const body = balanced(text, open);
    if (!body) continue;
    const after = /^\s*catch\b[^{]*\{/.exec(text.slice(body.end));
    if (!after) continue;
    const catchOpen = body.end + after[0].length - 1;
    const handler = balanced(text, catchOpen);
    if (!handler || /\bthrow\b/.test(handler.text) || ERROR_ANSWER.test(handler.text)) continue;
    out.push({
      from: lineOfIndex(text, open),
      to: lineOfIndex(text, body.end),
      catchLine: lineOfIndex(text, catchOpen),
    });
  }
  return out;
}

/** The argument text of the call that starts on `line`: { text, from } where `from` is its first line. */
function callArgs(text, line) {
  const before =
    text
      .split("\n")
      .slice(0, line - 1)
      .join("\n").length + (line > 1 ? 1 : 0);
  const rest = text.slice(
    before,
    text.indexOf("\n", before) < 0 ? undefined : text.indexOf("\n", before),
  );
  const m = CALL_START.exec(rest);
  if (!m) return null;
  const body = balanced(text, before + m.index + m[0].length - 1);
  return body ? { text: body.text, from: line } : null;
}

/**
 * Add literal timeouts, retry counts and fallbacks. Timeouts and retries are read only from the arguments of
 * the call or constructor on the evidence line, so a neighbouring client's settings are not mistaken for this
 * one's. A fallback needs every use of the client to sit in a try block whose catch carries on.
 */
function enrich(candidates, texts) {
  for (const c of candidates) {
    for (const ev of [...c.evidence]) {
      const text = texts.get(ev.file);
      if (text === undefined || /^imports /.test(ev.note ?? "")) continue;
      const args = callArgs(text, ev.line);
      if (args) {
        const rows = args.text.split("\n");
        rows.forEach((row, i) => {
          const at = args.from + i;
          for (const re of TIMEOUT_RES) {
            const t = c.timeoutMs === undefined && re.exec(row);
            if (t) {
              c.timeoutMs = Number(t[1].replace(/_/g, ""));
              c.evidence.push({ file: ev.file, line: at, note: `timeout ${c.timeoutMs} ms` });
              break;
            }
          }
          const r = c.retries === undefined && RETRY_RE.exec(row);
          if (r) {
            c.retries = Number(r[1]);
            c.evidence.push({ file: ev.file, line: at, note: `${c.retries} retries` });
          }
        });
      }
      if (c.optional === undefined) {
        const lines = text.split("\n");
        const decl = /^\s*(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=/.exec(
          lines[ev.line - 1] ?? "",
        );
        const uses = decl
          ? lines
              .map((row, i) =>
                i + 1 !== ev.line &&
                new RegExp(`\\b${decl[1].replace(/\$/g, "\\$")}\\.\\w+\\(`).test(row)
                  ? i + 1
                  : 0,
              )
              .filter(Boolean)
          : [ev.line];
        const blocks = fallbackBlocks(text);
        const guarded = uses.map((u) => blocks.find((b) => u > b.from && u < b.to));
        const chained = /\.catch\(\s*(?:\([^)]*\)|\w+)?\s*=>\s*(?!\s*\{?\s*throw)/.test(
          lines.slice(Math.max(0, ev.line - 1), ev.line + 2).join(" "),
        );
        if (uses.length && guarded.every(Boolean)) {
          c.optional = true;
          c.evidence.push({
            file: ev.file,
            line: guarded[0].catchLine,
            note: "every use is in a try block whose catch carries on",
          });
        } else if (chained) {
          c.optional = true;
          c.evidence.push({
            file: ev.file,
            line: ev.line,
            note: "failure is caught and handled on the call",
          });
        } else if (BREAKER.test(text)) {
          c.optional = true;
          c.evidence.push({ file: ev.file, line: 1, note: "file uses a circuit breaker library" });
        }
      }
    }
  }
}

/**
 * Candidates for the connections the source files suggest. `sources` is [{ rel, text }] with comments
 * already masked. Returns [{ id, from, to, protocol, sync, confidence, why, evidence }] sorted by id.
 */
export function findCandidates({ nodes, edges, sources, catalog, hints = [], networks = [] }) {
  const found = new Map();
  const add = (from, to, c) => {
    if (!from || !to || from.id === to.id) return;
    const id = `${from.id}-${to.id}`;
    const cur = found.get(id);
    const ev = c.evidence;
    if (!cur) {
      found.set(id, {
        id,
        from: from.id,
        to: to.id,
        ...(c.protocol ? { protocol: c.protocol } : {}),
        sync: c.sync,
        confidence: c.confidence,
        why: c.why,
        evidence: [ev],
      });
      return;
    }
    if (!cur.evidence.some((e) => e.file === ev.file && e.line === ev.line)) cur.evidence.push(ev);
    if (RANK[c.confidence] > RANK[cur.confidence]) {
      cur.confidence = c.confidence;
      cur.why = c.why;
    }
    if (!cur.protocol && c.protocol) cur.protocol = c.protocol;
  };
  const queueUse = []; // { file, kind, name, line, owner, node }
  // candidates found outside source files (compose links, Kubernetes service names)
  for (const h of hints)
    add(h.from, h.to, {
      sync: h.sync ?? true,
      protocol: h.protocol,
      confidence: h.confidence,
      why: h.why,
      evidence: h.evidence,
    });

  for (const src of sources) {
    const owner = ownerOf(nodes, src.rel);
    if (!owner) continue;
    const { text } = src;
    const seen = new Set();
    for (const m of text.matchAll(/(?:from\s+|require\(\s*|import\(\s*)["']([^"'./][^"']*)["']/g)) {
      const root = specifierRoot(m[1]);
      const entry = catalog.deps[root];
      if (!entry || APP_ROLES.has(entry.role) || entry.inProcess || seen.has(root)) continue;
      seen.add(root);
      const target = targetFor(nodes, entry);
      if (!target) continue;
      const line = lineOfIndex(text, m.index);
      const names = importedNames(text, m[1]);
      const used = names
        .map((n) => new RegExp(`\\bnew\\s+${n}\\s*\\(([^)]{0,80})`).exec(text))
        .find(Boolean);
      if (entry.role === "queue") {
        for (const q of text.matchAll(/\bnew\s+(Queue|Worker)\s*\(\s*["'`]([^"'`]+)["'`]/g))
          queueUse.push({
            file: src.rel,
            kind: q[1],
            name: q[2],
            line: lineOfIndex(text, q.index),
            owner,
            node: target,
          });
        if (!/\bnew\s+(Queue|Worker)\s*\(/.test(text))
          add(owner, target, {
            sync: false,
            protocol: PROTOCOL[entry.tech] ?? PROTOCOL_BY_ROLE.queue,
            confidence: "medium",
            why: `imports ${root}`,
            evidence: { file: src.rel, line, note: `imports ${root}` },
          });
        continue;
      }
      const li = used ? lineOfIndex(text, used.index) : line;
      add(owner, target, {
        sync: true,
        protocol: PROTOCOL[target.tech] ?? PROTOCOL[entry.tech] ?? PROTOCOL_BY_ROLE[entry.role],
        confidence: used ? "high" : "medium",
        why: used ? `imports ${root} and constructs a client` : `imports ${root}`,
        evidence: {
          file: src.rel,
          line: li,
          note: used
            ? `new ${used[0].split("(")[0].replace(/^new\s+/, "")}(...)`
            : `imports ${root}`,
        },
      });
    }
    // literal API hosts
    for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
      const host = m[1].toLowerCase();
      const hit = (catalog.hostPatterns ?? []).find(
        (h) => host === h.host || host.endsWith("." + h.host),
      );
      if (!hit) continue;
      const target = targetFor(nodes, { tech: hit.tech, role: "external" });
      add(owner, target, {
        sync: true,
        protocol: "HTTPS",
        confidence: "medium",
        why: `calls ${hit.host}`,
        evidence: { file: src.rel, line: lineOfIndex(text, m.index), note: `calls ${hit.host}` },
      });
    }
    // environment variable names the code reads
    for (const m of text.matchAll(/(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)/g)) {
      const name = m[1];
      const key = catalog.envKeys.find((k) => new RegExp(k.pattern).test(name));
      const line = lineOfIndex(text, m.index);
      let target = null;
      if (key) target = targetFor(nodes, { tech: key.tech, role: key.role });
      else if (URLISH.test(name)) {
        const words = name
          .split("_")
          .filter((w) => !NOISE.has(w))
          .map((w) => w.toLowerCase());
        target = nodes.find(
          (n) =>
            n.id !== owner.id &&
            words.some((w) => w.length >= 3 && slugWords(`${n.id} ${n.label}`).includes(w)),
        );
      }
      if (!target) continue;
      add(owner, target, {
        sync: target.role !== "queue",
        protocol: PROTOCOL[target.tech] ?? PROTOCOL_BY_ROLE[target.role],
        confidence: "medium",
        why: `reads ${name}`,
        evidence: { file: src.rel, line, note: `reads ${name}` },
      });
    }
  }

  // queues: a producer and a consumer with the same name belong together
  const names = {};
  for (const u of queueUse) (names[u.name] ??= new Set()).add(u.kind);
  for (const u of queueUse) {
    const paired = names[u.name].size === 2;
    const evidence = { file: u.file, line: u.line, note: `new ${u.kind}("${u.name}")` };
    const c = {
      sync: false,
      protocol: PROTOCOL[u.node.tech] ?? PROTOCOL_BY_ROLE.queue,
      confidence: paired ? "high" : "medium",
      why: paired
        ? `${u.kind === "Queue" ? "produces to" : "consumes from"} queue "${u.name}", which has a ${u.kind === "Queue" ? "consumer" : "producer"}`
        : `${u.kind === "Queue" ? "produces to" : "consumes from"} queue "${u.name}"`,
      evidence,
    };
    if (u.kind === "Queue") add(u.owner, u.node, c);
    else add(u.node, u.owner, c);
  }

  // two components on the same user-defined network make a suspected connection between them more likely
  for (const net of networks) {
    for (const c of found.values()) {
      const same = (c.from === net.a && c.to === net.b) || (c.from === net.b && c.to === net.a);
      if (!same) continue;
      if (c.confidence === "low") c.confidence = "medium";
      if (!c.evidence.some((e) => e.file === net.file && e.line === net.line))
        c.evidence.push({ file: net.file, line: net.line, note: `both on network ${net.name}` });
    }
  }
  const byPair = new Map(edges.map((e) => [`${e.from}>${e.to}`, e.id]));
  const texts = new Map(sources.map((x) => [x.rel, x.text]));
  const all = [...found.values()];
  enrich(all, texts);
  return all
    .map((c) => {
      const confirms = byPair.get(`${c.from}>${c.to}`);
      return {
        ...c,
        evidence: c.evidence.slice(0, MAX_EVIDENCE + 3),
        ...(confirms ? { confirms } : {}),
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
