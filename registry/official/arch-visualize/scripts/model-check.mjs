// Stage 3a: validate a model against assets/model.schema.json with a small built-in validator, check the
// links between its parts, and fail on anything that looks like a credential. Read-only.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";

const SECRET_RES = [
  /sk-(?:ant-)?[A-Za-z0-9_-]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{40,}/,
  /AKIA[0-9A-Z]{16}/,
  /xox[abprs]-[A-Za-z0-9-]{10,}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /[sr]k_live_[A-Za-z0-9]{16,}/,
  /npm_[A-Za-z0-9]{36}/,
  /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]{3,}@/i, // user:password@host
];

const load = (file) => JSON.parse(readFileSync(file, "utf8"));
export const loadSchema = () => load(path.join(skillDir(), "assets", "model.schema.json"));
export const loadCatalog = () => load(path.join(skillDir(), "assets", "tech-catalog.json"));

/** Every technology id the catalog knows (env-key entries are generic and excluded). */
export function knownTech(catalog) {
  const out = new Set();
  for (const k of ["deps", "images", "hosting", "pyDeps", "goModules", "prismaProviders"])
    for (const v of Object.values(catalog[k] ?? {})) out.add(v.tech);
  return out;
}

const typeOk = (t, v) =>
  t === "array"
    ? Array.isArray(v)
    : t === "object"
      ? v && typeof v === "object" && !Array.isArray(v)
      : t === "integer"
        ? Number.isInteger(v)
        : typeof v === t;

/** Validate `value` against the subset of JSON Schema the model schema uses. Returns problems. */
export function validate(schema, value, root = schema, at = "$") {
  const out = [];
  if (schema.$ref) {
    const target = schema.$ref
      .replace(/^#\//, "")
      .split("/")
      .reduce((o, k) => o?.[k], root);
    return validate(target, value, root, at);
  }
  if (schema.anyOf) {
    if (!schema.anyOf.some((sub) => validate(sub, value, root, at).length === 0))
      out.push(`${at}: "${String(value).slice(0, 40)}" is not an allowed value`);
    return out;
  }
  if ("const" in schema && value !== schema.const)
    out.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value))
    out.push(`${at}: "${String(value).slice(0, 40)}" is not one of ${schema.enum.join(", ")}`);
  if (schema.type && !typeOk(schema.type, value)) return [...out, `${at}: expected ${schema.type}`];
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) out.push(`${at}: is empty`);
    if (schema.maxLength && value.length > schema.maxLength)
      out.push(`${at}: longer than ${schema.maxLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      out.push(`${at}: "${value.slice(0, 40)}" has the wrong format`);
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum)
    out.push(`${at}: must be at least ${schema.minimum}`);
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      out.push(`${at}: at most ${schema.maxItems} items`);
    if (schema.minItems !== undefined && value.length < schema.minItems)
      out.push(`${at}: at least ${schema.minItems} item(s)`);
    if (schema.items)
      value.forEach((v, i) => out.push(...validate(schema.items, v, root, `${at}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const k of schema.required ?? []) if (!(k in value)) out.push(`${at}: missing "${k}"`);
    for (const [k, sub] of Object.entries(schema.properties ?? {}))
      if (k in value) out.push(...validate(sub, value[k], root, `${at}.${k}`));
  }
  return out;
}

function* strings(value, at = "$") {
  if (typeof value === "string") yield [at, value];
  else if (Array.isArray(value))
    for (let i = 0; i < value.length; i++) yield* strings(value[i], `${at}[${i}]`);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) yield* strings(v, `${at}.${k}`);
}

/**
 * A v1 model as v2, in memory. v2 only adds optional fields, so the upgrade changes the version number.
 * Never mutates its input; running it on a v2 model returns an equal copy.
 */
export function upgradeModel(model) {
  if (!model || typeof model !== "object" || Array.isArray(model)) return model;
  return model.version === 1 ? { ...model, version: 2 } : { ...model };
}

const hasEvidence = (item) => (item.evidence?.length ?? 0) > 0;
const relativeOk = (p) => !path.isAbsolute(p) && !p.split(/[\\/]/).includes("..");

/** Problems with the v2 fields: facts need evidence, references must exist, no secrets in groups. */
function checkV2(model, nodeIds, root, problems) {
  const groups = model.groups ?? [];
  const groupIds = new Set();
  groups.forEach((g, i) => {
    if (groupIds.has(g.id)) problems.push(`groups[${i}]: duplicate id "${g.id}"`);
    groupIds.add(g.id);
  });
  const parent = new Map(groups.map((g) => [g.id, g.parent]));
  groups.forEach((g, i) => {
    if (g.parent && !groupIds.has(g.parent))
      problems.push(`groups[${i}] ${g.id}: parent "${g.parent}" is not a group`);
    for (let cur = g.parent, hops = 0; cur; cur = parent.get(cur), hops++)
      if (cur === g.id || hops > groups.length) {
        problems.push(`groups[${i}] ${g.id}: groups must not contain themselves`);
        break;
      }
  });
  model.nodes.forEach((n, i) => {
    const at = `nodes[${i}] ${n.id}`;
    if (n.group && !groupIds.has(n.group))
      problems.push(`${at}: group "${n.group}" is not declared`);
    if (typeof n.replicas === "number" && !hasEvidence(n))
      problems.push(`${at}: replicas needs evidence, or use "unknown"`);
    if (n.ai?.tools?.length && !hasEvidence(n))
      problems.push(`${at}: ai.tools needs evidence (the file that lists the tools)`);
    if (n.ai?.auditGrade && !n.ai.auditSource)
      problems.push(`${at}: ai.auditGrade needs ai.auditSource (an aisle audit JSON file)`);
    if (n.ai?.auditSource) {
      const src = n.ai.auditSource;
      if (!relativeOk(src)) problems.push(`${at}: ai.auditSource must be relative to the project`);
      else if (root) {
        const file = path.join(root, src);
        let grade;
        try {
          grade =
            statSync(file).size < 5_000_000 ? JSON.parse(readFileSync(file, "utf8")).grade : null;
        } catch {
          grade = null;
        }
        if (!existsSync(file) || grade === null || grade === undefined)
          problems.push(
            `${at}: ai.auditSource "${src.slice(0, 60)}" is not a readable aisle audit JSON file`,
          );
        else if (n.ai.auditGrade && grade !== n.ai.auditGrade)
          problems.push(
            `${at}: ai.auditGrade ${n.ai.auditGrade} does not match the audit file (${grade})`,
          );
      }
    }
  });
  model.edges.forEach((e, i) => {
    const at = `edges[${i}] ${e.id}`;
    const claim = (field, on) => {
      if (on && !hasEvidence(e))
        problems.push(
          `${at}: ${field} needs evidence${field === "timeoutMs" || field === "retries" || field === "optional" ? "" : ', or use "unknown"'}`,
        );
    };
    claim("timeoutMs", e.timeoutMs !== undefined);
    claim("retries", e.retries !== undefined);
    claim("optional", e.optional === true);
    claim("tls", typeof e.tls === "boolean");
    claim("auth", e.auth !== undefined && e.auth !== "unknown");
  });
  (model.views ?? []).forEach((v, i) => {
    for (const id of v.focus ?? [])
      if (!nodeIds.has(id)) problems.push(`views[${i}] ${v.id}: focus "${id}" is not a node`);
  });
}

const MAX_DETAIL_SYMBOLS = 600; // across the whole model, so the page stays one small offline file
const MAX_AGENT_NOTES = 30; // descriptions written by the agent instead of copied from a comment, per node

/**
 * Problems with the version 3 fields: `nodes[].detail` (functions, components, routes) and `edges[].via`.
 * Every symbol points at a file and line; every reference points at a symbol that exists. With `verifyFiles`
 * the file must exist under `root` and the line must be inside it.
 */
function checkDetail(model, root, verifyFiles, problems) {
  const hasDetail = model.nodes.some((n) => n.detail) || model.edges.some((e) => e.via);
  if (!hasDetail) return;
  if (model.version !== 3) problems.push("detail and via need model version 3");
  const ids = new Map(); // symbol id -> node id
  let total = 0;
  const lineCounts = new Map();
  const linesOf = (rel) => {
    if (!lineCounts.has(rel)) {
      let n = null;
      try {
        const file = path.join(root, rel);
        if (statSync(file).size < 2 * 1024 * 1024)
          n = readFileSync(file, "utf8").split(/\r?\n/).length;
      } catch {
        n = null;
      }
      lineCounts.set(rel, n);
    }
    return lineCounts.get(rel);
  };
  model.nodes.forEach((n, i) => {
    if (!n.detail) return;
    let agent = 0;
    n.detail.symbols.forEach((x, j) => {
      const at = `nodes[${i}] ${n.id} detail.symbols[${j}]`;
      total++;
      if (ids.has(x.id)) problems.push(`${at}: duplicate symbol id "${x.id.slice(0, 80)}"`);
      ids.set(x.id, n.id);
      if (!relativeOk(x.file)) problems.push(`${at}: file must be relative to the project`);
      if (!x.id.startsWith(`${x.file}#`))
        problems.push(`${at}: id must start with its file and "#"`);
      if (x.endLine !== undefined && x.endLine < x.line)
        problems.push(`${at}: endLine is before line`);
      if (x.docBy === "agent") agent++;
      if (x.docBy && !x.doc) problems.push(`${at}: docBy needs a doc`);
      if (verifyFiles && relativeOk(x.file)) {
        const count = linesOf(x.file);
        if (count === null)
          problems.push(`${at}: file "${x.file.slice(0, 80)}" not found under the project root`);
        else if (x.line > count || (x.endLine ?? 0) > count)
          problems.push(
            `${at}: line ${x.endLine ?? x.line} is past the end of ${x.file.slice(0, 80)}`,
          );
      }
    });
    if (agent > MAX_AGENT_NOTES)
      problems.push(
        `nodes[${i}] ${n.id}: ${agent} descriptions written by the agent (at most ${MAX_AGENT_NOTES})`,
      );
  });
  if (total > MAX_DETAIL_SYMBOLS)
    problems.push(
      `detail: ${total} symbols in the model (at most ${MAX_DETAIL_SYMBOLS}); focus on fewer`,
    );
  model.nodes.forEach((n, i) => {
    n.detail?.symbols.forEach((x, j) => {
      const at = `nodes[${i}] ${n.id} detail.symbols[${j}]`;
      const must = (to, what) => {
        if (to !== undefined && !ids.has(to))
          problems.push(`${at}: ${what} "${String(to).slice(0, 80)}" is not a symbol in the model`);
      };
      x.calls.forEach((c) => must(c.to, "call target"));
      x.renders.forEach((r) => must(r.to, "render target"));
      x.fetches.forEach((f) => must(f.to, "fetch target"));
      x.rpc.forEach((r) => must(r.to, "rpc target"));
      x.calledBy.forEach((c) => must(c, "calledBy"));
    });
  });
  model.edges.forEach((e, i) => {
    e.via?.forEach((v, j) => {
      const at = `edges[${i}] ${e.id} via[${j}]`;
      for (const [end, nodeId] of [
        ["from", e.from],
        ["to", e.to],
      ]) {
        const owner = ids.get(v[end]);
        if (owner === undefined)
          problems.push(`${at}: ${end} "${v[end].slice(0, 80)}" is not a symbol in the model`);
        else if (owner !== nodeId)
          problems.push(
            `${at}: ${end} symbol belongs to node ${owner}, but the connection ${end === "from" ? "starts" : "ends"} at ${nodeId}`,
          );
      }
    });
  });
}

/** All problems with `model`. `draft` allows a model with no flows yet. */
export function checkModel(
  model,
  {
    draft = false,
    root = null,
    schema = loadSchema(),
    catalog = loadCatalog(),
    verifyFiles = false,
  } = {},
) {
  model = upgradeModel(model);
  const problems = validate(schema, model);
  if (problems.length) return problems; // links below assume the right shapes
  const nodeIds = new Set();
  const edgeIds = new Set();
  const inferred = new Set(model.inferred ?? []);
  const techs = knownTech(catalog);
  model.nodes.forEach((n, i) => {
    if (nodeIds.has(n.id)) problems.push(`nodes[${i}]: duplicate id "${n.id}"`);
    nodeIds.add(n.id);
    if (!techs.has(n.tech) && n.tech !== `generic-${n.role}`)
      problems.push(
        `nodes[${i}] ${n.id}: unknown tech "${n.tech}" (use a catalog id or generic-${n.role})`,
      );
    if (!n.evidence?.length && !inferred.has(`node:${n.id}`))
      problems.push(`nodes[${i}] ${n.id}: needs evidence or an "inferred" entry node:${n.id}`);
  });
  model.edges.forEach((e, i) => {
    if (edgeIds.has(e.id)) problems.push(`edges[${i}]: duplicate id "${e.id}"`);
    edgeIds.add(e.id);
    for (const end of ["from", "to"])
      if (!nodeIds.has(e[end]))
        problems.push(`edges[${i}] ${e.id}: ${end} "${e[end]}" is not a node`);
    if (!e.evidence?.length && !inferred.has(`edge:${e.id}`))
      problems.push(`edges[${i}] ${e.id}: needs evidence or an "inferred" entry edge:${e.id}`);
  });
  for (const ref of inferred) {
    const [kind, id] = ref.split(":");
    if (!(kind === "node" ? nodeIds : edgeIds).has(id))
      problems.push(`inferred: "${ref}" does not exist`);
  }
  const cands = model.candidates ?? [];
  cands.forEach((c, i) => {
    for (const end of ["from", "to"])
      if (!nodeIds.has(c[end]))
        problems.push(`candidates[${i}] ${c.id}: ${end} "${c[end]}" is not a node`);
    if (c.confirms && !edgeIds.has(c.confirms))
      problems.push(`candidates[${i}] ${c.id}: confirms "${c.confirms}", which is not an edge`);
  });
  if (!draft && cands.length)
    problems.push(
      `candidates: ${cands.length} edge candidate(s) left. Confirm each as an edge (with its evidence) or delete it.`,
    );
  if (!draft && model.flows.length === 0)
    problems.push("flows: add at least one request flow (1 to 5)");
  const flowIds = new Set();
  model.flows.forEach((f, i) => {
    if (flowIds.has(f.id)) problems.push(`flows[${i}]: duplicate id "${f.id}"`);
    flowIds.add(f.id);
    f.steps.forEach((s, j) => {
      const at = `flows[${i}].steps[${j}]`;
      if (!s.edge && !s.event) problems.push(`${at}: needs an edge or an event`);
      if (s.together && (!s.edge || !f.steps[j - 1]?.edge))
        problems.push(`${at}: "together" needs an edge step and an edge step right before it`);
      if (s.edge && !edgeIds.has(s.edge)) problems.push(`${at}: edge "${s.edge}" does not exist`);
      if (s.event && !nodeIds.has(s.node))
        problems.push(`${at}: event "${s.event}" needs an existing node`);
    });
  });
  model.risks.forEach((r, i) => {
    for (const id of r.nodes)
      if (!nodeIds.has(id)) problems.push(`risks[${i}] ${r.id}: node "${id}" does not exist`);
  });
  checkV2(model, nodeIds, root, problems);
  checkDetail(model, root ?? process.cwd(), verifyFiles, problems);
  for (const group of [
    model.nodes,
    model.edges,
    model.risks,
    model.groups ?? [],
    model.candidates ?? [],
  ])
    for (const item of group)
      for (const ev of item.evidence ?? [])
        if (path.isAbsolute(ev.file) || ev.file.split(/[\\/]/).includes(".."))
          problems.push(
            `${item.id}: evidence path "${ev.file.slice(0, 60)}" must be relative to the project`,
          );
  for (const [at, s] of strings(model))
    if (SECRET_RES.some((re) => re.test(s)))
      problems.push(`${at}: looks like a credential; remove the value`);
  return problems;
}

function run(argv) {
  const { flags } = parseArgs(argv, {
    strings: ["model", "root"],
    booleans: ["draft", "write-upgrade"],
  });
  const file = path.resolve(flags.model ?? "docs/architecture.json");
  let model;
  try {
    model = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`model-check: cannot read ${file}: ${e.message}`);
    return 2;
  }
  const root = flags.root ? path.resolve(flags.root) : process.cwd();
  // symbol files are only looked up on disk when --root is given, because the default root is just the current folder
  const problems = checkModel(model, {
    draft: Boolean(flags.draft),
    root,
    verifyFiles: Boolean(flags.root),
  });
  if (problems.length === 0) {
    const m = model;
    if (flags["write-upgrade"] && model.version === 1) {
      writeFileSync(file, `${JSON.stringify(upgradeModel(model), null, 2)}\n`);
      console.log("upgraded the file to model version 2");
    }
    console.log(
      `model ok: ${m.nodes.length} nodes, ${m.edges.length} edges, ${m.flows.length} flows, ${m.risks.length} risks`,
    );
    return 0;
  }
  console.log(
    capLines(
      problems,
      `${problems.length} problem(s) found in ${path.relative(process.cwd(), file) || file}`,
    ),
  );
  return 1;
}

if (isEntry(import.meta.url)) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (e) {
    console.error(`model-check: ${e.message}`);
    process.exitCode = 2;
  }
}
