// What-if: if these components go down, what else fails, what is only delayed and which flows break. Reads the
// model and nothing else; the result is what the model says, not a prediction about production.
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";

/** Load the simulation module the page also uses. It is our own file, run in an empty context. */
export function loadSim() {
  const context = vm.createContext({});
  vm.runInContext(
    readFileSync(path.join(skillDir(), "assets", "lib", "simulate.js"), "utf8"),
    context,
  );
  return context.ArchSim;
}

// Labels come from the project; never let one write control codes into a terminal.
const plain = (text) =>
  String(text ?? "")
    // eslint-disable-next-line no-control-regex -- removing control codes is the point
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .slice(0, 80);

const WHY = {
  sync: (c, who, ev) => `${who} fails: it calls ${c} with no fallback${ev}`,
  fallback: (c, who, ev) => `${who} is degraded: it calls ${c} but has a fallback${ev}`,
  delayed: (c, who, ev) =>
    `${who} is delayed: it works asynchronously, so work queues up while ${c} is down${ev}`,
};

/** The text report, as lines. */
export function describe(model, result) {
  const label = (id) => plain(model.nodes.find((n) => n.id === id)?.label ?? id);
  const ids = (status) =>
    Object.keys(result.nodes).filter((id) => result.nodes[id].status === status);
  const lines = [
    `What-if from the model (not a prediction about production). Down: ${result.down.map(label).join(", ") || "nothing"}`,
  ];
  if (result.ignored.length)
    lines.push(`Ignored (not components): ${result.ignored.map(plain).join(", ")}`);
  const failed = ids("failed");
  const degraded = ids("degraded");
  lines.push(`failed (${failed.length}): ${failed.map(label).join(", ") || "none"}`);
  lines.push(`degraded (${degraded.length}): ${degraded.map(label).join(", ") || "none"}`);
  lines.push(`unaffected: ${result.counts.unaffected}`);
  const why = [];
  for (const id of [...failed, ...degraded]) {
    const link = result.nodes[id].chain[0];
    if (!link) continue;
    const ev = link.evidence
      ? ` (${plain(link.evidence.file)}${link.evidence.line ? ":" + link.evidence.line : ""})`
      : "";
    why.push(`  ${WHY[link.kind](label(link.cause), label(id), ev)}`);
  }
  if (why.length) lines.push("Why:", ...why);
  const broken = result.flows.filter((f) => f.status !== "ok");
  if (broken.length) {
    lines.push("Flows:");
    for (const f of broken)
      lines.push(`  ${plain(f.name)}: ${f.status} at step ${f.step} (${label(f.node)})`);
  }
  return lines;
}

function run(argv) {
  const { flags } = parseArgs(argv, { strings: ["model", "down"], booleans: ["json"] });
  const file = path.resolve(flags.model ?? "docs/architecture.json");
  let model;
  try {
    model = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`simulate: cannot read ${file}: ${e.message}`);
    return 2;
  }
  if (!flags.down) {
    console.error("simulate: say what goes down, for example --down redis or --down redis,db");
    return 2;
  }
  const down = String(flags.down)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const result = loadSim().simulate(model, down);
  if (!result.down.length) {
    console.error(`simulate: none of ${down.map(plain).join(", ")} is a component in the model`);
    return 2;
  }
  if (flags.json) console.log(JSON.stringify(result));
  else {
    const lines = describe(model, result);
    console.log(capLines(lines.slice(0, -1), lines[lines.length - 1]));
  }
  return 0;
}

if (isEntry(import.meta.url)) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (e) {
    console.error(`simulate: ${e.message}`);
    process.exitCode = 2;
  }
}
