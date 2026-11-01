// Edge candidates: connections the files suggest but do not prove. Reads JavaScript and TypeScript source as
// text (never runs it): imports of known client libraries, the constructors that follow them, literal API hosts,
// queue producers and consumers, and the environment variable NAMES the code reads. Every candidate has a
// confidence and the file and line it comes from, and the agent confirms or drops each one.
import path from "node:path";

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
  const sameRole = infra.filter((n) => n.role === entry.role);
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

/**
 * Candidates for the connections the source files suggest. `sources` is [{ rel, text }] with comments
 * already masked. Returns [{ id, from, to, protocol, sync, confidence, why, evidence }] sorted by id.
 */
export function findCandidates({ nodes, edges, sources, catalog }) {
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

  const byPair = new Map(edges.map((e) => [`${e.from}>${e.to}`, e.id]));
  return [...found.values()]
    .map((c) => {
      const confirms = byPair.get(`${c.from}>${c.to}`);
      return {
        ...c,
        evidence: c.evidence.slice(0, MAX_EVIDENCE),
        ...(confirms ? { confirms } : {}),
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
