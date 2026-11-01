// What changed in the architecture between two models? Writes a diff file the page can show in its Diff
// lens, and prints a short summary. Reads the two models and nothing else; a change is not a failure, so the
// exit code is 0 whenever the diff ran.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";
import { checkModel, upgradeModel } from "./model-check.mjs";

/** Load the diff module the page also uses. It is our own file, run in an empty context. */
export function loadDiff() {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(path.join(skillDir(), "assets", "lib", "diff.js"), "utf8"), context);
  return context.ArchDiff;
}

// Labels come from the project; never let one write control codes into a terminal.
const plain = (text) =>
  String(text ?? "")
    // eslint-disable-next-line no-control-regex -- removing control codes is the point
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .slice(0, 80);
const show = (v) => plain(v === null || v === undefined ? "none" : JSON.stringify(v));

/** Compare two models (any version) and return the plain-data diff. */
export function diffModels(baseInput, headInput) {
  const base = upgradeModel(baseInput);
  const head = upgradeModel(headInput);
  for (const [name, model] of [
    ["base", base],
    ["head", head],
  ]) {
    const problems = checkModel(model);
    if (problems.length)
      throw Object.assign(new Error(`${name} model has problems`), { problems, which: name });
  }
  // a copy made here, so what we write is plain data and not an object from the other context
  return JSON.parse(JSON.stringify(loadDiff().diff(base, head)));
}

/** The text report, as lines. */
export function describe(result) {
  const c = result.counts;
  if (result.empty) return ["No architecture changes."];
  const label = (id) => plain(id);
  const lines = [
    `components: +${c.nodesAdded} -${c.nodesRemoved} changed ${c.nodesChanged} renamed ${c.nodesRenamed}`,
    `connections: +${c.edgesAdded} -${c.edgesRemoved} changed ${c.edgesChanged}`,
    `risks: +${c.risksAdded} -${c.risksRemoved}`,
  ];
  for (const n of result.nodes.added) lines.push(`added: ${plain(n.label ?? n.id)}`);
  for (const n of result.nodes.removed) lines.push(`removed: ${plain(n.label ?? n.id)}`);
  for (const r of result.nodes.renamed) lines.push(`renamed: ${label(r.from)} to ${label(r.to)}`);
  for (const n of result.nodes.changed)
    for (const x of n.changes)
      lines.push(`changed: ${label(n.id)} ${x.field} ${show(x.before)} to ${show(x.after)}`);
  for (const e of result.edges.added) lines.push(`added: ${label(e.from)} -> ${label(e.to)}`);
  for (const e of result.edges.removed) lines.push(`removed: ${label(e.from)} -> ${label(e.to)}`);
  for (const e of result.edges.changed)
    for (const x of e.changes)
      lines.push(
        `changed: ${label(e.from)} -> ${label(e.to)} ${x.field} ${show(x.before)} to ${show(x.after)}`,
      );
  for (const r of result.risks.added) lines.push(`new risk: ${plain(r.title ?? r.id)}`);
  for (const r of result.risks.removed) lines.push(`risk gone: ${plain(r.title ?? r.id)}`);
  return lines;
}

function readModel(file, name) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`cannot read the ${name} model ${file}: ${e.message}`);
  }
}

function run(argv) {
  const { flags } = parseArgs(argv, {
    strings: ["base", "head", "out"],
    booleans: ["force"],
  });
  if (!flags.base || !flags.head) {
    console.error("diff: give --base <old model> and --head <new model>");
    return 2;
  }
  const out = path.resolve(flags.out ?? "docs/architecture.diff.json");
  if (existsSync(out) && !flags.force) {
    let ours = false;
    try {
      ours = JSON.parse(readFileSync(out, "utf8")).kind === "arch-diff";
    } catch {
      ours = false;
    }
    if (!ours) {
      console.error(`diff: ${out} exists and is not a diff file. Use --force to replace it.`);
      return 2;
    }
  }
  let result;
  try {
    result = diffModels(
      readModel(path.resolve(flags.base), "base"),
      readModel(path.resolve(flags.head), "head"),
    );
  } catch (e) {
    console.error(`diff: ${e.message}`);
    for (const p of (e.problems ?? []).slice(0, 5)) console.error(`  ${plain(p)}`);
    return 2;
  }
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  const lines = describe(result);
  lines.push(`Wrote ${flags.out ?? "docs/architecture.diff.json"}`);
  console.log(capLines(lines.slice(0, -1), lines[lines.length - 1]));
  return 0;
}

if (isEntry(import.meta.url)) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (e) {
    console.error(`diff: ${e.message}`);
    process.exitCode = 2;
  }
}
