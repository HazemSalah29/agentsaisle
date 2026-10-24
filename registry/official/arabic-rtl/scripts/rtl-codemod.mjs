#!/usr/bin/env node
// Rewrites physical Tailwind classes (ml-4, pr-2, text-left, rounded-l-lg ...) to logical ones
// (ms-4, pe-2, text-start, rounded-s-lg ...). Dry run by default; --write applies. Idempotent.
// Only text inside string and template literals is touched, so identifiers and prose are safe.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { rewriteClassString } from "./_classmap.mjs";
import {
  capLines,
  findKitDirs,
  kitNote,
  isEntry,
  lineIndex,
  parseArgs,
  stringSegments,
  tailwindVersion,
  walk,
} from "./_lib.mjs";

/** Tailwind added logical utilities (ms-*, start-*, rounded-s-*) in v3.3. */
export const MIN_TAILWIND = [3, 3];

/** Rewrite one source file's text. Returns { text, changes: [{line, from, to}], manual: [{line, ...}] }. */
export function transform(src, opts = {}) {
  const lineOf = lineIndex(src);
  const changes = [];
  const manual = [];
  let out = "";
  let cursor = 0;
  for (const seg of stringSegments(src)) {
    if (!/\S/.test(seg.text)) continue;
    // Edge tokens glued to an interpolation are incomplete; protect them from rewriting.
    const r = rewriteSegment(seg, opts);
    if (r.text === seg.text && !r.manual.length) continue;
    out += src.slice(cursor, seg.start) + r.text;
    cursor = seg.end;
    const line = lineOf(seg.start);
    for (const c of r.changes) changes.push({ line, from: c.from, to: c.to });
    for (const m of r.manual) manual.push({ line, from: m.from, rule: m.rule, fix: m.fix });
  }
  return { text: out + src.slice(cursor), changes, manual };
}

function rewriteSegment(seg, opts) {
  const { text, glueStart, glueEnd } = seg;
  // Split off a first/last token that touches an interpolation and leave it as is.
  let head = "";
  let tail = "";
  let mid = text;
  if (glueStart) {
    const m = /^\S+/.exec(mid);
    if (m) {
      head = m[0];
      mid = mid.slice(head.length);
    }
  }
  if (glueEnd) {
    const m = /\S+$/.exec(mid);
    if (m) {
      tail = m[0];
      mid = mid.slice(0, mid.length - tail.length);
    }
  }
  const r = rewriteClassString(mid, opts);
  return { ...r, text: head + r.text + tail };
}

export function run(root, { write = false, includeKit = false } = {}) {
  const tw = tailwindVersion(root);
  if (tw && (tw[0] < MIN_TAILWIND[0] || (tw[0] === MIN_TAILWIND[0] && tw[1] < MIN_TAILWIND[1]))) {
    return {
      refused: `Tailwind ${tw.join(".")} has no logical utilities (needs ${MIN_TAILWIND.join(".")}+). Upgrade, or use rtl:/ltr: variants by hand.`,
      files: [],
    };
  }
  const files = [];
  for (const file of walk(root, { includeKit })) {
    const src = readFileSync(file, "utf8");
    const r = transform(src, { spaceXLogical: Boolean(tw && tw[0] >= 4) });
    if (!r.changes.length && !r.manual.length) continue;
    files.push({ file: path.relative(root, file) || path.basename(file), ...r });
    if (write && r.text !== src) writeFileSync(file, r.text);
  }
  return { files, tailwind: tw };
}

function main(argv) {
  const { flags, positional } = parseArgs(argv, { booleans: ["write", "json", "include-kit"] });
  const root = path.resolve(positional[0] ?? ".");
  const res = run(root, { write: Boolean(flags.write), includeKit: Boolean(flags["include-kit"]) });
  if (res.refused) {
    console.error(res.refused);
    process.exit(2);
  }
  if (flags.json) {
    console.log(
      JSON.stringify(
        res.files.map((f) => ({ file: f.file, changes: f.changes, manual: f.manual })),
        null,
        2,
      ),
    );
    return;
  }
  const lines = [];
  let changed = 0;
  let manualCount = 0;
  for (const f of res.files) {
    changed += f.changes.length;
    manualCount += f.manual.length;
    if (f.changes.length) lines.push(`${f.file}: ${f.changes.length} class(es)`);
    for (const c of f.changes.slice(0, 3)) lines.push(`  L${c.line} ${c.from} -> ${c.to}`);
    for (const m of f.manual) lines.push(`  MANUAL L${m.line} ${m.from} (${m.rule}): ${m.fix}`);
  }
  // Say so when a design-kit folder was stepped over, and how many classes are in it.
  let note = "";
  const kitDirs = flags["include-kit"] ? [] : findKitDirs(root).map((d) => path.join(root, d));
  if (kitDirs.length) {
    let inside = 0;
    for (const d of kitDirs)
      inside += run(d, { includeKit: true }).files.reduce((n, f) => n + f.changes.length, 0);
    note = `\n${kitNote(
      kitDirs.map((d) => path.relative(process.cwd(), d)),
      ` (${inside} class(es) inside)`,
    )}`;
  }
  const mode = flags.write ? "written" : "dry run, nothing written (use --write)";
  console.log(
    capLines(
      lines,
      `${changed} class(es) in ${res.files.filter((f) => f.changes.length).length} file(s), ${manualCount} for manual review. ${mode}${note}`,
    ),
  );
}

if (isEntry(import.meta.url)) main(process.argv.slice(2));
