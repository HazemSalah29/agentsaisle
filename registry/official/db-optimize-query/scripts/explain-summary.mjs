#!/usr/bin/env node
// Summarizes PostgreSQL EXPLAIN (ANALYZE, FORMAT JSON) output. It reads files or stdin only; it never
// connects to a database. Give it two files (before, after) to compare timings.
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_LINES = 40;

/** Pull the JSON array out of raw psql output or a plain JSON file. */
export function parsePlan(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start)
    throw new Error("no JSON plan found. Run EXPLAIN (ANALYZE, FORMAT JSON) and pass its output.");
  const data = JSON.parse(text.slice(start, end + 1));
  const top = Array.isArray(data) ? data[0] : data;
  if (!top?.Plan) throw new Error("the JSON has no Plan. Use EXPLAIN (ANALYZE, FORMAT JSON).");
  return { plan: top.Plan, executionMs: top["Execution Time"], planningMs: top["Planning Time"] };
}

/** Flatten the plan tree to nodes with their own (exclusive) time. */
export function flatten(plan) {
  const nodes = [];
  const walk = (n, depth) => {
    const kids = n.Plans ?? [];
    const loops = n["Actual Loops"] ?? 1;
    const total = (n["Actual Total Time"] ?? 0) * loops;
    const childTotal = kids.reduce(
      (s, k) => s + (k["Actual Total Time"] ?? 0) * (k["Actual Loops"] ?? 1),
      0,
    );
    nodes.push({
      type: n["Node Type"],
      relation: n["Relation Name"],
      index: n["Index Name"],
      depth,
      loops,
      estRows: n["Plan Rows"],
      rows: n["Actual Rows"],
      removed: n["Rows Removed by Filter"] ?? 0,
      filter: n["Filter"],
      ownMs: Math.max(0, total - childTotal),
      sortMethod: n["Sort Method"],
      sortSpace: n["Sort Space Type"],
      batches: n["Hash Batches"],
    });
    kids.forEach((k) => walk(k, depth + 1));
  };
  walk(plan, 0);
  return nodes;
}

const label = (n) =>
  `${n.type}${n.relation ? ` on ${n.relation}` : ""}${n.index ? ` using ${n.index}` : ""}`;

export function analyze({ plan, executionMs }) {
  const nodes = flatten(plan);
  const findings = [];
  for (const n of nodes) {
    const scanned = (n.rows + n.removed) * n.loops;
    if (n.type === "Seq Scan" && scanned >= 1000)
      findings.push({
        rule: "seq-scan",
        message: `${label(n)} read ${scanned.toLocaleString("en-US")} rows${n.removed ? ` and discarded ${(n.removed * n.loops).toLocaleString("en-US")}` : ""}${n.filter ? ` (filter ${n.filter})` : ""}. Consider an index.`,
      });
    if (n.estRows > 0 && n.rows >= 0) {
      const ratio = Math.max(n.rows / n.estRows, n.estRows / Math.max(n.rows, 1));
      if (ratio >= 10 && Math.max(n.rows, n.estRows) >= 100)
        findings.push({
          rule: "bad-estimate",
          message: `${label(n)} expected ${n.estRows} rows, got ${n.rows} (${Math.round(ratio)}x off). Run ANALYZE or check the statistics.`,
        });
    }
    if (n.loops >= 1000)
      findings.push({
        rule: "many-loops",
        message: `${label(n)} ran ${n.loops.toLocaleString("en-US")} times. This is the shape of an N+1; join or batch instead.`,
      });
    if (n.sortSpace === "Disk" || /external/i.test(n.sortMethod ?? ""))
      findings.push({
        rule: "sort-on-disk",
        message: `${label(n)} spilled to disk. Add an index that returns rows in order, or raise work_mem.`,
      });
    if (n.batches > 1)
      findings.push({
        rule: "hash-spill",
        message: `${label(n)} used ${n.batches} batches (spilled). Raise work_mem or reduce the rows.`,
      });
  }
  const slowest = [...nodes]
    .sort((a, b) => b.ownMs - a.ownMs)
    .slice(0, 3)
    .filter((n) => n.ownMs > 0);
  return {
    executionMs,
    findings,
    slowest,
    seqScans: nodes.filter((n) => n.type === "Seq Scan").length,
  };
}

const ms = (v) => (v === undefined ? "n/a" : `${v.toFixed(v < 10 ? 2 : 1)} ms`);

export function summarize(a) {
  const lines = [
    `explain-summary: execution ${ms(a.executionMs)}, ${a.seqScans} sequential scan${a.seqScans === 1 ? "" : "s"}`,
  ];
  for (const n of a.slowest) lines.push(`  slowest: ${label(n)} ${ms(n.ownMs)}`);
  if (a.findings.length === 0) lines.push("  no problems found");
  for (const f of a.findings) lines.push(`  ${f.rule}: ${f.message}`);
  return clip(lines);
}

export function compare(before, after) {
  const b = analyze(before);
  const a = analyze(after);
  const lines = ["explain-summary: before and after"];
  if (b.executionMs !== undefined && a.executionMs !== undefined) {
    const pct = b.executionMs === 0 ? 0 : ((a.executionMs - b.executionMs) / b.executionMs) * 100;
    lines.push(
      `  execution ${ms(b.executionMs)} -> ${ms(a.executionMs)} (${pct <= 0 ? "" : "+"}${pct.toFixed(0)}%)`,
    );
  }
  lines.push(`  sequential scans ${b.seqScans} -> ${a.seqScans}`);
  lines.push(`  problems ${b.findings.length} -> ${a.findings.length}`);
  const left = new Set(a.findings.map((f) => f.message));
  for (const f of b.findings.filter((x) => !left.has(x.message)))
    lines.push(`  fixed: ${f.rule}: ${f.message}`);
  const had = new Set(b.findings.map((f) => f.message));
  for (const f of a.findings.filter((x) => !had.has(x.message)))
    lines.push(`  new: ${f.rule}: ${f.message}`);
  return clip(lines);
}

const clip = (lines) =>
  (lines.length <= MAX_LINES
    ? lines
    : [...lines.slice(0, MAX_LINES - 1), `  ... ${lines.length - MAX_LINES + 1} more`]
  ).join("\n");

function main(argv) {
  const files = argv.filter((a) => !a.startsWith("--"));
  try {
    if (files.length >= 2) {
      console.log(
        compare(
          parsePlan(readFileSync(path.resolve(files[0]), "utf8")),
          parsePlan(readFileSync(path.resolve(files[1]), "utf8")),
        ),
      );
      return;
    }
    const text = files[0] ? readFileSync(path.resolve(files[0]), "utf8") : readFileSync(0, "utf8");
    const a = analyze(parsePlan(text));
    console.log(summarize(a));
    process.exit(a.findings.length ? 1 : 0);
  } catch (e) {
    console.log(`explain-summary: ${e.message}`);
    process.exit(1);
  }
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
