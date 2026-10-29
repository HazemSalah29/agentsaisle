// Stage 1: find the components of a project and the evidence for each. Reads dependency files, compose
// files, Dockerfiles, Prisma schemas, hosting files and env example KEY NAMES as text, then writes a draft
// model. Never opens .env files, never runs project code, never touches the network.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  capLines,
  envKeyNames,
  findLine,
  isEntry,
  isExampleEnv,
  listFiles,
  parseArgs,
  parseYaml,
  readText,
  skillDir,
} from "./_lib.mjs";

export const TIER_OF_ROLE = {
  client: "clients",
  edge: "edge",
  frontend: "frontend",
  backend: "backend",
  worker: "async",
  queue: "async",
  cache: "data",
  database: "data",
  storage: "data",
  search: "data",
  auth: "backend",
  external: "external",
  observability: "external",
};
const TIER_ORDER = ["clients", "edge", "frontend", "backend", "async", "data", "external"];
const COMPOSE = /^(docker-compose|compose)(\.[\w-]+)?\.ya?ml$/;
const GENERIC_TECH = { database: "generic-database", email: "generic-external" };

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/^@[^/]+\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "app";

const loadCatalog = () =>
  JSON.parse(readFileSync(path.join(skillDir(), "assets", "tech-catalog.json"), "utf8"));

/** Match an image reference such as "bitnami/redis:7" to a catalog entry. */
function matchImage(catalog, image) {
  const name = image.split("@")[0].split(":")[0].split("/").pop().toLowerCase();
  return catalog.images[name] ? { name, ...catalog.images[name] } : null;
}

/**
 * Find components under `root`. Returns { model, report } where model is the draft model and report
 * holds the counts the CLI prints.
 */
export function discover(root, catalog = loadCatalog()) {
  const want = (n) =>
    n === "package.json" ||
    n === "requirements.txt" ||
    n === "pyproject.toml" ||
    n === "go.mod" ||
    n === "schema.prisma" ||
    n === "Dockerfile" ||
    n.startsWith("Dockerfile.") ||
    COMPOSE.test(n) ||
    isExampleEnv(n) ||
    Boolean(catalog.hosting[n]);
  const { files, stats } = listFiles(root, want);
  const notes = [];
  const read = [];
  const claims = []; // { exclusive?, tech, role, label, weak, external, evidence, appDir? }
  const addClaim = (c) => claims.push(c);
  const text = (rel) => {
    const t = readText(path.join(root, rel));
    if (t === null) notes.push(`skipped ${rel} (over 2 MB)`);
    else read.push(rel);
    return t;
  };
  const dirOf = (rel) => (path.posix.dirname(rel) === "." ? "" : path.posix.dirname(rel));
  const appNodes = []; // { dir, role, tech, label, evidence }
  const composeServices = []; // { svc, deps, rel }
  const composeEvidence = []; // { svc, buildDir, ev }
  const dockerEvidence = []; // { dir, ev }
  let projectName = "";

  for (const rel of files) {
    const base = path.posix.basename(rel);
    const dir = dirOf(rel);
    if (base === "package.json") {
      const t = text(rel);
      if (t === null) continue;
      let pkg;
      try {
        pkg = JSON.parse(t);
      } catch {
        notes.push(`skipped ${rel} (not valid JSON)`);
        continue;
      }
      if (dir === "" && typeof pkg.name === "string") projectName = pkg.name;
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const found = Object.keys(deps)
        .sort()
        .filter((d) => catalog.deps[d])
        .map((d) => ({
          dep: d,
          ...catalog.deps[d],
          line: findLine(t, new RegExp(`"${d.replace(/[/@.-]/g, "\\$&")}"\\s*:`)),
        }));
      const hasStrongApp = found.some(
        (f) => !f.weak && (f.role === "frontend" || f.role === "backend"),
      );
      const nameHint = `${dir} ${pkg.name ?? ""}`;
      const looksWorker = /worker|jobs?\b|consumer/i.test(nameHint);
      for (const f of found) {
        const ev = { file: rel, line: f.line, note: `dependency ${f.dep}` };
        if (f.role === "frontend" || f.role === "backend") {
          if (f.weak && hasStrongApp) continue;
          appNodes.push({ dir, role: f.role, tech: f.tech, label: f.label, evidence: [ev] });
        } else addClaim({ ...f, evidence: [ev] });
      }
      if (looksWorker && found.some((f) => f.role === "queue" || f.role === "cache")) {
        const q = found.find((f) => f.role === "queue") ?? found[0];
        appNodes.push({
          dir,
          role: "worker",
          tech: "generic-worker",
          label: "Background worker",
          evidence: [{ file: rel, line: q.line, note: `dependency ${q.dep}` }],
        });
      }
    } else if (base === "requirements.txt" || base === "pyproject.toml") {
      const t = text(rel);
      if (t === null) continue;
      for (const [name, c] of Object.entries(catalog.pyDeps).sort()) {
        const re = new RegExp(
          `^\\s*["']?${name.replace(/[.-]/g, "\\$&")}(?=[\\s=<>~!\\[;"',]|$)`,
          "im",
        );
        if (!re.test(t)) continue;
        const ev = { file: rel, line: findLine(t, re), note: `python package ${name}` };
        if (c.role === "backend" || c.role === "frontend")
          appNodes.push({ dir, role: c.role, tech: c.tech, label: c.label, evidence: [ev] });
        else addClaim({ ...c, evidence: [ev] });
      }
    } else if (base === "go.mod") {
      const t = text(rel);
      if (t === null) continue;
      for (const [mod, c] of Object.entries(catalog.goModules).sort()) {
        if (!t.includes(mod)) continue;
        const ev = {
          file: rel,
          line: findLine(t, new RegExp(mod.replace(/[./-]/g, "\\$&"))),
          note: `go module ${mod}`,
        };
        if (c.role === "backend")
          appNodes.push({ dir, role: c.role, tech: c.tech, label: c.label, evidence: [ev] });
        else addClaim({ ...c, evidence: [ev] });
      }
    } else if (base === "schema.prisma") {
      const t = text(rel);
      if (t === null) continue;
      const m = /datasource\s+\w+\s*\{[^}]*?provider\s*=\s*"([^"]+)"/s.exec(t);
      const p = m && catalog.prismaProviders[m[1].toLowerCase()];
      if (p)
        addClaim({
          tech: p.tech,
          role: "database",
          label: p.label,
          evidence: [
            { file: rel, line: findLine(t, /provider\s*=/), note: `datasource provider ${m[1]}` },
          ],
        });
    } else if (base === "Dockerfile" || base.startsWith("Dockerfile.")) {
      const t = text(rel);
      if (t === null) continue;
      const froms = [...t.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/gim)];
      const last = froms[froms.length - 1];
      if (!last) continue;
      const expose = /^\s*EXPOSE\s+(\S+)/im.exec(t);
      const ev = {
        file: rel,
        line: findLine(
          t,
          new RegExp(`^\\s*FROM\\s+.*${last[1].replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`, "i"),
        ),
        note: `base image ${last[1]}${expose ? `, exposes ${expose[1]}` : ""}`,
      };
      const img = matchImage(catalog, last[1]);
      if (img) addClaim({ ...img, evidence: [ev] });
      else dockerEvidence.push({ dir, ev });
    } else if (COMPOSE.test(base)) {
      const t = text(rel);
      if (t === null) continue;
      const { data, lineOf } = parseYaml(t);
      for (const [svc, def] of Object.entries(data.services ?? {}).sort()) {
        if (!def || typeof def !== "object") continue;
        const sev = (note, p) => ({ file: rel, line: lineOf(p), note });
        const ports = Array.isArray(def.ports) ? def.ports.map(String).join(", ") : "";
        const depends = Array.isArray(def.depends_on)
          ? def.depends_on
          : Object.keys(def.depends_on ?? {});
        const deps = depends.map((d, i) => ({
          to: String(d),
          line: lineOf(
            Array.isArray(def.depends_on)
              ? `services.${svc}.depends_on[${i}]`
              : `services.${svc}.depends_on.${d}`,
          ),
        }));
        if (typeof def.image === "string") {
          const img = matchImage(catalog, def.image);
          if (!img) {
            notes.push(`unknown image ${def.image} (service ${svc})`);
            continue;
          }
          const note = `image ${def.image}${ports ? `, ports ${ports}` : ""}`;
          composeServices.push({ svc, deps, rel });
          addClaim({
            ...img,
            exclusive: slug(svc),
            svc,
            evidence: [sev(note, `services.${svc}.image`)],
          });
        } else if (def.build) {
          const ctx = typeof def.build === "string" ? def.build : (def.build.context ?? ".");
          const buildDir = path.posix
            .normalize(path.posix.join(dir, String(ctx)))
            .replace(/^\.$/, "");
          composeServices.push({ svc, deps, rel, buildDir });
          composeEvidence.push({
            svc,
            buildDir,
            ev: sev(
              `service ${svc} builds ${ctx}${ports ? `, ports ${ports}` : ""}`,
              `services.${svc}`,
            ),
          });
        }
      }
    } else if (isExampleEnv(base)) {
      const t = text(rel);
      if (t === null) continue;
      for (const { key, line } of envKeyNames(t)) {
        for (const k of catalog.envKeys)
          if (new RegExp(k.pattern).test(key)) {
            addClaim({
              tech: k.tech,
              role: k.role,
              label: k.tech,
              env: true,
              evidence: [{ file: rel, line, note: k.note.replace(/[A-Z_*]+$/, key) }],
            });
            break;
          }
      }
    } else if (catalog.hosting[base]) {
      addClaim({
        ...catalog.hosting[base],
        evidence: [{ file: rel, line: 1, note: `hosting file ${base}` }],
      });
    }
  }

  // ---- merge claims into nodes
  const nodes = [];
  const usedIds = new Set();
  const uniqueId = (want) => {
    let id = slug(want);
    for (let i = 2; usedIds.has(id); i++) id = `${slug(want)}-${i}`;
    usedIds.add(id);
    return id;
  };
  const addEv = (node, ev) => {
    if (!node.evidence.some((e) => e.file === ev.file && e.line === ev.line && e.note === ev.note))
      node.evidence.push(ev);
  };
  const mkNode = (id, label, role, tech, evidence, external) => {
    const n = {
      id,
      label,
      role,
      tech,
      tier: external ? "external" : TIER_OF_ROLE[role],
      evidence: [...evidence],
    };
    nodes.push(n);
    return n;
  };
  // 1. app nodes (one per directory and role)
  const dupLabels = {};
  for (const a of appNodes) dupLabels[a.label] = (dupLabels[a.label] ?? 0) + 1;
  const appKey = new Map();
  for (const a of appNodes) {
    const k = `${a.dir}|${a.role}`;
    if (appKey.has(k)) {
      for (const ev of a.evidence) addEv(appKey.get(k), ev);
      continue;
    }
    const sameDir = appNodes.filter((x) => x.dir === a.dir).map((x) => x.role);
    const base = a.dir
      ? path.posix.basename(a.dir)
      : projectName || path.basename(path.resolve(root));
    const id = uniqueId(new Set(sameDir).size > 1 ? `${base}-${a.role}` : base);
    const label = dupLabels[a.label] > 1 && a.dir ? `${a.label} (${a.dir})` : a.label;
    appKey.set(k, mkNode(id, label, a.role, a.tech, a.evidence));
  }
  // 2. compose services give exclusive infra nodes, or evidence for app nodes
  const svcNode = new Map();
  for (const c of claims.filter((c) => c.exclusive)) {
    const n = mkNode(uniqueId(c.exclusive), c.label, c.role, c.tech, c.evidence);
    svcNode.set(c.svc, n);
  }
  for (const ce of composeEvidence) {
    const target = [...appKey.values()].find((n) => dirOf(n.evidence[0].file) === ce.buildDir);
    if (target) {
      addEv(target, ce.ev);
      svcNode.set(ce.svc, target);
    } else {
      svcNode.set(ce.svc, mkNode(uniqueId(ce.svc), ce.svc, "backend", "generic-backend", [ce.ev]));
    }
  }
  for (const { dir, ev } of dockerEvidence) {
    const target = [...appKey.values()].find((n) => dirOf(n.evidence[0].file) === dir);
    if (target) addEv(target, ev);
  }
  // 3. remaining claims attach to a matching node or create one
  const rank = (c) => (c.env ? 2 : c.weak ? 1 : 0);
  for (const c of claims.filter((c) => !c.exclusive).sort((a, b) => rank(a) - rank(b))) {
    const infra = nodes.filter((n) => !appKeyHas(n));
    let target = infra.find((n) => n.tech === c.tech);
    if (!target && (c.weak || GENERIC_TECH[c.tech]))
      target = infra.find((n) => n.role === c.role && n.tech !== "generic-worker");
    if (target) {
      for (const ev of c.evidence) addEv(target, ev);
      continue;
    }
    const tech = GENERIC_TECH[c.tech] ?? c.tech;
    const label = c.env && !GENERIC_TECH[c.tech] ? c.label : (c.label ?? tech);
    const isGeneric = Boolean(GENERIC_TECH[c.tech]);
    mkNode(
      uniqueId(isGeneric ? c.role : c.tech),
      isGeneric ? c.role[0].toUpperCase() + c.role.slice(1) : label,
      c.role,
      tech,
      c.evidence,
      c.external,
    );
  }
  function appKeyHas(n) {
    return [...appKey.values()].includes(n);
  }

  // ---- edges from compose depends_on
  const edges = [];
  const edgeIds = new Set();
  for (const s of composeServices) {
    const from = svcNode.get(s.svc);
    for (const d of s.deps) {
      const to = svcNode.get(d.to);
      if (!from || !to || from === to) continue;
      const id = `${from.id}-${to.id}`;
      if (edgeIds.has(id)) continue;
      edgeIds.add(id);
      edges.push({
        id,
        from: from.id,
        to: to.id,
        sync: true,
        evidence: [{ file: s.rel, line: d.line, note: `depends_on ${d.to}` }],
      });
    }
  }

  nodes.sort(
    (a, b) =>
      TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const n of nodes)
    n.evidence.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
  edges.sort((a, b) => (a.id < b.id ? -1 : 1));
  const model = {
    version: 1,
    project: (projectName || path.basename(path.resolve(root))).slice(0, 80),
    nodes,
    edges,
    flows: [],
    risks: [],
    inferred: [],
  };
  return { model, report: { read, stats, notes } };
}

function run(argv) {
  const { flags } = parseArgs(argv, { strings: ["root", "out"] });
  const root = path.resolve(flags.root ?? ".");
  const { model, report } = discover(root);
  const out = path.resolve(flags.out ?? path.join(root, "docs", "architecture.draft.json"));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(model, null, 2) + "\n");
  const lines = model.nodes.map(
    (n) =>
      `${n.tier.padEnd(9)} ${n.role.padEnd(8)} ${n.id} (${n.tech}, ${n.evidence.length} evidence)`,
  );
  const extra = [];
  if (report.stats.skippedSecret)
    extra.push(`${report.stats.skippedSecret} secret-named file(s) never opened`);
  if (report.stats.truncated) extra.push("stopped at 2,000 files");
  extra.push(...report.notes);
  const summary = [
    `Found ${model.nodes.length} components and ${model.edges.length} links; read ${report.read.length} files.`,
    ...extra.slice(0, 6),
    `Draft written to ${path.relative(process.cwd(), out) || out}`,
  ].join("\n");
  console.log(capLines(lines, summary));
  return 0;
}

if (isEntry(import.meta.url)) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (e) {
    console.error(`discover: ${e.message}`);
    process.exitCode = 2;
  }
}
