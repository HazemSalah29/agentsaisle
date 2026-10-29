// Stage 3a: validate a model against assets/model.schema.json with a small built-in validator, check the
// links between its parts, and fail on anything that looks like a credential. Read-only.
import { readFileSync } from "node:fs";
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

/** All problems with `model`. `draft` allows a model with no flows yet. */
export function checkModel(
  model,
  { draft = false, schema = loadSchema(), catalog = loadCatalog() } = {},
) {
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
  if (!draft && model.flows.length === 0)
    problems.push("flows: add at least one request flow (1 to 5)");
  const flowIds = new Set();
  model.flows.forEach((f, i) => {
    if (flowIds.has(f.id)) problems.push(`flows[${i}]: duplicate id "${f.id}"`);
    flowIds.add(f.id);
    f.steps.forEach((s, j) => {
      const at = `flows[${i}].steps[${j}]`;
      if (!s.edge && !s.event) problems.push(`${at}: needs an edge or an event`);
      if (s.edge && !edgeIds.has(s.edge)) problems.push(`${at}: edge "${s.edge}" does not exist`);
      if (s.event && !nodeIds.has(s.node))
        problems.push(`${at}: event "${s.event}" needs an existing node`);
    });
  });
  model.risks.forEach((r, i) => {
    for (const id of r.nodes)
      if (!nodeIds.has(id)) problems.push(`risks[${i}] ${r.id}: node "${id}" does not exist`);
  });
  for (const group of [model.nodes, model.edges, model.risks])
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
  const { flags } = parseArgs(argv, { strings: ["model"], booleans: ["draft"] });
  const file = path.resolve(flags.model ?? "docs/architecture.json");
  let model;
  try {
    model = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`model-check: cannot read ${file}: ${e.message}`);
    return 2;
  }
  const problems = checkModel(model, { draft: Boolean(flags.draft) });
  if (problems.length === 0) {
    const m = model;
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
