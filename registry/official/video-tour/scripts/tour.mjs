#!/usr/bin/env node
// Turns an arch-visualize model (docs/architecture.json) into a draft codebase-tour project: video.json, script.md
// and facts.md. Everything shown or said comes from the model (counts, labels, `file:line` evidence); nothing is
// invented. The model is read as data only. Never runs anything from the project it describes.
// Usage: node tour.mjs --model docs/architecture.json --out projects/<slug> [--flows a,b] [--max-flows 3] [--format short-9x16]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MAX_BYTES, importFlow } from "./_arch-import.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const TIERS = ["clients", "edge", "frontend", "backend", "async", "data", "external"];
const FORMATS = ["reel-9x16", "short-9x16", "youtube-16x9", "square-1x1"];
const UNSAFE = new RegExp("[\\p{Cc}\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]", "gu");
const clean = (t, max) =>
  String(t ?? "")
    .replace(UNSAFE, " ")
    .trim()
    .slice(0, max);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Pick flows: the ones asked for, else the longest ones (most to show), at most `max`. */
export function pickFlows(model, wanted, max) {
  const flows = (model.flows ?? []).filter((f) => f?.id && f.steps?.length);
  if (wanted?.length) {
    const missing = wanted.filter((id) => !flows.some((f) => f.id === id));
    if (missing.length) throw new Error(`No such flow: ${missing.join(", ")}.`);
    return wanted.map((id) => flows.find((f) => f.id === id));
  }
  return [...flows].sort((a, b) => b.steps.length - a.steps.length).slice(0, max);
}

/** The project files for a tour, as { video, script, facts, summary }. Pure. */
export function buildTour(model, { flows, format = "short-9x16", slug = "tour" }) {
  const nodes = model.nodes ?? [];
  const name = clean(model.project?.name ?? model.project ?? slug, 60) || slug;
  const facts = [];
  const lines = [];
  const scenes = [];
  const fact = (text, source) => {
    facts.push({ id: `f${facts.length + 1}`, text, source });
    return `f${facts.length}`;
  };
  const line = (text, beat, factId) => {
    lines.push({ id: `l${lines.length + 1}`, text, beat, fact: factId });
    return `l${lines.length}`;
  };

  // Overview: component counts per tier, straight from the model.
  const counts = TIERS.map((t) => [t, nodes.filter((n) => n.tier === t).length]).filter(
    ([, n]) => n > 0,
  );
  const overviewFact = fact(
    `The model lists ${plural(nodes.length, "component", "components")} and ${plural((model.edges ?? []).length, "connection", "connections")}.`,
    "docs/architecture.json (nodes, edges)",
  );
  const hook = line(`This is a tour of ${name}, read from its own code.`, "hook");
  const count = line(
    `The model finds ${plural(nodes.length, "component", "components")}.`,
    "step",
    overviewFact,
  );
  scenes.push({
    id: "s1",
    kind: "title",
    props: { text: name, subtitle: "a tour from the code" },
    narration: [hook],
  });
  scenes.push({
    id: "s2",
    kind: "list",
    props: {
      heading: "What is in it",
      items: counts.map(([t, n]) => `${t}: ${n}`),
    },
    narration: [count],
  });

  // One request-flow scene per flow; one narration line per step so each step appears with its line.
  flows.forEach((flow, fi) => {
    const props = importFlow(model, flow.id);
    const label = new Map(props.nodes.map((n) => [n.id, n.label]));
    const edgeEnds = new Map(props.edges.map((e) => [e.id, e]));
    const ids = props.steps.map((st, si) => {
      let text;
      let f;
      if (st.edge) {
        const e = edgeEnds.get(st.edge);
        const [a, b] = st.reverse ? [e.to, e.from] : [e.from, e.to];
        text = `${label.get(a)} to ${label.get(b)}${st.label ? `: ${st.label}` : ""}.`;
        if (st.evidence) f = fact(`${text.replace(/\.$/, "")} is in the code.`, st.evidence);
      } else text = `${label.get(st.node)}: ${st.event}.`;
      return line(text, si === 0 ? "setup" : "step", f);
    });
    scenes.push({
      id: `s${fi + 3}`,
      kind: "request-flow",
      props,
      narration: ids,
    });
  });

  const outro = line("That is what the code says, not live traffic.", "button");
  scenes.push({
    id: `s${scenes.length + 1}`,
    kind: "title",
    props: { text: "From the code", subtitle: "every step has a file and line" },
    narration: [outro],
  });

  const video = {
    version: 1,
    meta: {
      title: `${name} tour`,
      type: "explainer",
      format,
      fps: 30,
      lang: "en",
      audience: "developers new to this codebase",
    },
    script: "script.md",
    scenes,
  };
  const script = `# ${name} tour\n\n${lines
    .map((l) => `[${l.id}] ${l.text}\n  beat: ${l.beat}${l.fact ? `\n  fact: ${l.fact}` : ""}\n`)
    .join("\n")}`;
  const factsMd = `# Facts\n\n${facts.map((f) => `- [${f.id}] ${f.text} Source: ${f.source}`).join("\n")}\n`;
  return {
    video,
    script,
    facts: factsMd,
    summary: { scenes: scenes.length, lines: lines.length, facts: facts.length },
  };
}

function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), {
      strings: ["model", "out", "flows", "max-flows", "format"],
    });
    if (!flags.model || !flags.out)
      throw new Error("Give --model docs/architecture.json and --out projects/<slug>");
    if (statSync(flags.model).size > MAX_BYTES)
      throw new Error("The model file is larger than 2 MB; refusing to read it.");
    const format = flags.format ?? "short-9x16";
    if (!FORMATS.includes(format)) throw new Error(`--format is one of ${FORMATS.join(", ")}.`);
    const max = Number(flags["max-flows"] ?? 3);
    if (!Number.isInteger(max) || max < 1 || max > 6) throw new Error("--max-flows is 1 to 6.");
    const model = JSON.parse(readFileSync(flags.model, "utf8"));
    if (![1, 2].includes(model?.version) || !Array.isArray(model.nodes))
      throw new Error("This does not look like an arch-visualize model (version 1 or 2 expected).");
    const flows = pickFlows(model, flags.flows?.split(",").filter(Boolean), max);
    if (!flows.length)
      throw new Error("The model has no flows with steps; run /arch-visualize again.");
    if (existsSync(path.join(flags.out, "video.json")))
      throw new Error(
        `${flags.out}/video.json exists; choose a new folder so nothing is overwritten.`,
      );
    const tour = buildTour(model, { flows, format, slug: path.basename(flags.out) });
    mkdirSync(flags.out, { recursive: true });
    writeFileSync(path.join(flags.out, "video.json"), `${JSON.stringify(tour.video, null, 2)}\n`);
    writeFileSync(path.join(flags.out, "script.md"), tour.script);
    writeFileSync(path.join(flags.out, "facts.md"), tour.facts);
    console.log(
      capLines(
        [
          `Wrote ${flags.out}: ${plural(tour.summary.scenes, "scene", "scenes")}, ${plural(tour.summary.lines, "line", "lines")}, ${plural(tour.summary.facts, "fact", "facts")}.`,
          `Flows: ${flows.map((f) => f.id).join(", ")}`,
        ],
        "Draft narration is mechanical: reword it with video-write, keep every fact id.",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
