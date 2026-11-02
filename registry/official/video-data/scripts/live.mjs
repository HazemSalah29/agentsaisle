#!/usr/bin/env node
// Turns fetched data (data/<id>.json) into a draft chart-video project: video.json, script.md and facts.md.
// `init` writes a starter live.config.json. Every number spoken or drawn is a value in the data, or a change
// computed from two values in it; each fact names its source and date. Stale or thin data is refused. Offline:
// only fetch.mjs uses the network.
// Usage: node live.mjs init --out live.config.json [--source npm|github|url]
//        node live.mjs build --config live.config.json --data data/<id>.json --out projects/<slug> [--max-age-days 8]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";
import { configProblems, plain } from "./sources.mjs";

const FORMATS = ["reel-9x16", "short-9x16", "youtube-16x9", "square-1x1"];
const SOURCE_NAME = { npm: "the npm registry", github: "GitHub", url: "a public data file" };
const SOURCE_SHORT = { npm: "npm", github: "GitHub", url: "public data" };
const fmt = (n) => new Intl.NumberFormat("en-US").format(n);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const num = (v) => typeof v === "number" && Number.isFinite(v);

const STARTERS = {
  npm: {
    id: "npm-weekly",
    title: "This week in npm downloads",
    source: "npm",
    items: ["react", "vue", "svelte"],
    metric: "Weekly downloads",
    format: "short-9x16",
  },
  github: {
    id: "stars-weekly",
    title: "GitHub stars right now",
    source: "github",
    items: ["vuejs/vue", "sveltejs/svelte"],
    metric: "Stars",
    format: "short-9x16",
  },
  url: {
    id: "my-data",
    title: "My weekly numbers",
    source: "url",
    url: "https://data.example.org/numbers.csv",
    allowedHosts: ["data.example.org"],
    labelField: "name",
    valueField: "value",
    previousField: "last_week",
    metric: "Value",
    format: "short-9x16",
  },
};

/** Problems with fetched data, as readable strings. Pure. */
export function dataProblems(d, now = Date.now(), maxAgeDays = 8) {
  const out = [];
  if (!d || typeof d !== "object" || !Array.isArray(d.items))
    return ["data: not a data file written by fetch.mjs"];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.asOf ?? "")) out.push("data.asOf: a date");
  const t = Date.parse(d.fetchedAt ?? "");
  if (!Number.isFinite(t)) out.push("data.fetchedAt: a time");
  else if (now - t > maxAgeDays * 86_400_000)
    out.push(
      `The data is older than ${maxAgeDays} days (fetched ${d.fetchedAt.slice(0, 10)}). Run fetch.mjs again; never reuse old numbers as new.`,
    );
  if (d.items.length < 2 || d.items.length > 8) out.push("data.items: 2 to 8 items");
  d.items.forEach((i, k) => {
    if (typeof i?.label !== "string" || !i.label || !num(i.value))
      out.push(`data.items[${k}]: a label and a number`);
    if (i?.previous !== undefined && !num(i.previous))
      out.push(`data.items[${k}].previous: a number`);
  });
  return out;
}

const pct = (v, p) => (p > 0 ? Math.round(((v - p) / p) * 100) : null);
const signed = (n) => (n > 0 ? `up ${n}%` : n < 0 ? `down ${Math.abs(n)}%` : "unchanged");

/** The project files. Pure: `data` and `config` in, files out. */
export function buildLive(data, config) {
  const lines = [];
  const facts = [];
  const fact = (text, source) => {
    facts.push({ id: `f${facts.length + 1}`, text, source });
    return `f${facts.length}`;
  };
  const line = (text, beat, factId) => {
    lines.push({ id: `l${lines.length + 1}`, text, beat, fact: factId });
    return `l${lines.length}`;
  };
  const where = SOURCE_NAME[data.source] ?? "a public source";
  const short = SOURCE_SHORT[data.source] ?? "public data";
  const src = `${where}, fetched ${data.asOf}`;
  const unit = data.unit ? ` ${data.unit}` : "";
  const items = [...data.items].sort((a, b) => b.value - a.value);
  const metric = plain(data.metric || "Value", 40);
  const title = plain(config.title, 60);
  const hook = line(`${title}: here is what ${where} says, as of ${data.asOf}.`, "hook");
  const top = items[0];
  const second = items[1];
  const topFact = fact(
    `${top.label} leads with ${fmt(top.value)}${unit} ${metric.toLowerCase()}, ahead of ${second.label} with ${fmt(second.value)}${unit}.`,
    src,
  );
  const chartLines = [
    line(
      `${top.label} leads with ${fmt(top.value)}${unit}, ahead of ${second.label} with ${fmt(second.value)}${unit}.`,
      "setup",
      topFact,
    ),
  ];
  const moves = items
    .map((i) => ({ i, p: num(i.previous) ? pct(i.value, i.previous) : null }))
    .filter((m) => m.p !== null)
    .sort((a, b) => Math.abs(b.p) - Math.abs(a.p));
  const scenes = [
    {
      id: "s1",
      kind: "title",
      props: { text: title, subtitle: `${short}, as of ${data.asOf}` },
      narration: [hook],
    },
    {
      id: "s2",
      kind: "chart",
      props: {
        type: "bar",
        title: `${metric} (${short}, ${data.asOf})`.slice(0, 120),
        ...(data.unit ? { unit: data.unit } : {}),
        data: items.map((i) => ({ label: plain(i.label, 40), value: i.value })),
      },
      narration: chartLines,
    },
  ];
  const changeItems = [];
  const changeLines = [];
  for (const m of moves.slice(0, 3)) {
    const text = `${m.i.label} is ${signed(m.p)} from ${fmt(m.i.previous)} to ${fmt(m.i.value)}.`;
    changeItems.push(`${m.i.label}: ${signed(m.p)}`);
    changeLines.push(
      line(
        text,
        "step",
        fact(text, `${src}; change computed from the previous value in the same source`),
      ),
    );
  }
  if (changeItems.length)
    scenes.push({
      id: "s3",
      kind: "list",
      props: { heading: "What changed", items: changeItems },
      narration: changeLines,
    });
  const last = line(
    `The numbers come from ${where}, fetched ${data.asOf}.`,
    "lesson",
    fact(
      `Source: ${(data.urls ?? []).slice(0, 3).join(" ") || where}. Fetched ${data.fetchedAt}.`,
      "fetch ledger",
    ),
  );
  scenes.push({
    id: `s${scenes.length + 1}`,
    kind: "list",
    props: { heading: "Where this comes from", items: [where, `Fetched ${data.asOf}`] },
    narration: [last],
  });
  const video = {
    version: 1,
    meta: {
      title,
      type: "explainer",
      format: config.format ?? "short-9x16",
      fps: 30,
      lang: "en",
      audience: "developers who follow the ecosystem",
    },
    script: "script.md",
    scenes,
  };
  const script = `# ${title}\n\n${lines.map((l) => `[${l.id}] ${l.text}\n  beat: ${l.beat}${l.fact ? `\n  fact: ${l.fact}` : ""}\n`).join("\n")}`;
  const factsMd = `# Facts\n\n${facts.map((f) => `- [${f.id}] ${f.text} Source: ${f.source}`).join("\n")}\n`;
  return {
    video,
    script,
    facts: factsMd,
    summary: {
      items: items.length,
      changes: changeItems.length,
      big: moves.filter((m) => Math.abs(m.p) >= 100).map((m) => m.i.label),
    },
  };
}

function main() {
  try {
    const { flags, positional } = parseArgs(process.argv.slice(2), {
      strings: ["config", "data", "out", "max-age-days", "source"],
    });
    const [cmd] = positional;
    if (cmd === "init") {
      const kind = flags.source ?? "npm";
      if (!STARTERS[kind]) throw new Error("--source is npm, github or url.");
      const out = flags.out ?? "live.config.json";
      if (existsSync(out)) throw new Error(`${out} exists; it is never overwritten.`);
      writeFileSync(out, `${JSON.stringify(STARTERS[kind], null, 2)}\n`);
      console.log(`Wrote ${out}. Edit it, then: node fetch.mjs --config ${out}`);
      return;
    }
    if (cmd !== "build" || !flags.config || !flags.data || !flags.out)
      throw new Error(
        "Usage: node live.mjs init|build --config live.config.json --data data/<id>.json --out projects/<slug>",
      );
    const config = JSON.parse(readFileSync(flags.config, "utf8"));
    const bad = configProblems(config);
    if (bad.length) throw new Error(`live.config.json: ${bad[0]}`);
    if (config.format !== undefined && !FORMATS.includes(config.format))
      throw new Error(`format is one of ${FORMATS.join(", ")}.`);
    const age = flags["max-age-days"] === undefined ? 8 : Number(flags["max-age-days"]);
    if (!Number.isFinite(age) || age < 1 || age > 31) throw new Error("--max-age-days: 1 to 31");
    const data = JSON.parse(readFileSync(flags.data, "utf8"));
    const problems = dataProblems(data, Date.now(), age);
    if (problems.length) throw new Error(`Cannot build:\n${problems.slice(0, 6).join("\n")}`);
    if (data.id !== config.id)
      throw new Error(`The data is for "${data.id}" but the config is "${config.id}".`);
    if (existsSync(path.join(flags.out, "video.json")))
      throw new Error(
        `${flags.out}/video.json exists; choose a new folder (for example one per week) so nothing is overwritten.`,
      );
    const r = buildLive(data, config);
    mkdirSync(flags.out, { recursive: true });
    writeFileSync(path.join(flags.out, "video.json"), `${JSON.stringify(r.video, null, 2)}\n`);
    writeFileSync(path.join(flags.out, "script.md"), r.script);
    writeFileSync(path.join(flags.out, "facts.md"), r.facts);
    console.log(
      capLines(
        [
          `Wrote ${flags.out}: ${plural(r.summary.items, "item", "items")}, ${plural(r.summary.changes, "computed change", "computed changes")}.`,
          ...(r.summary.big.length
            ? [
                `Check before publishing: ${r.summary.big.join(", ")} changed by 100% or more. Real data can glitch; look at the source first.`,
              ]
            : []),
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
