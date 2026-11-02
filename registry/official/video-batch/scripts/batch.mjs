#!/usr/bin/env node
// Makes one project folder per row of a CSV from a template project whose video.json and script.md hold
// {{column}} placeholders. For the user's own data, on this machine only: nothing is sent anywhere, the CSV is
// never copied into the output, and what is printed is counts and column names, never cell values.
// Dry run by default: nothing is written until --apply.
// Usage: node batch.mjs --template projects/onboarding --csv people.csv --out projects/onboarding-batch [--apply] [--limit 50]
//        node batch.mjs --clean projects/onboarding-batch
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const MARK = ".aisle-batch";
const MAX_BYTES = 1024 * 1024;
const MAX_ROWS = 200;
const MAX_COLS = 20;
const MAX_CELL = 80;
const COL = /^[a-z][a-z0-9_]{0,31}$/;
const HOLE = /\{\{\s*([a-z][a-z0-9_]{0,31})\s*\}\}/g;
const SKIP_DIRS = new Set(["voice", "exports", "publish", "qa", "node_modules"]);
const SKIP_EXT = /\.(mp4|mov|webm|wav|mp3)$/i;
const UNSAFE = new RegExp("[\\p{Cc}\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]", "gu");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** RFC 4180 CSV: quotes, doubled quotes, commas and newlines inside quotes. Returns rows of strings. Pure. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  const s = String(text).replace(new RegExp("^\\uFEFF"), "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (q) throw new Error("The CSV has an opening quote that is never closed.");
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

/** { columns, records } from CSV text, or throws a sentence. Cell text is cleaned and capped. */
export function readTable(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one data row.");
  const columns = rows[0].map((h) => h.trim());
  if (columns.length > MAX_COLS) throw new Error(`More than ${MAX_COLS} columns.`);
  const bad = columns.find((c) => !COL.test(c));
  if (bad !== undefined)
    throw new Error(
      "Column names are lowercase letters, digits and _, starting with a letter (up to 32).",
    );
  if (new Set(columns).size !== columns.length) throw new Error("Two columns have the same name.");
  if (rows.length - 1 > MAX_ROWS) throw new Error(`More than ${MAX_ROWS} rows; split the file.`);
  const records = rows.slice(1).map((r, i) => {
    if (r.length !== columns.length)
      throw new Error(`Data row ${i + 1} has ${r.length} cells; the header has ${columns.length}.`);
    return Object.fromEntries(
      columns.map((c, k) => [c, r[k].replace(UNSAFE, " ").trim().slice(0, MAX_CELL)]),
    );
  });
  return { columns, records };
}

const fill = (str, rec) => str.replace(HOLE, (_, k) => rec[k]);
/** Fill every string in a JSON value (values only: a cell can never change the structure). */
export function fillJson(v, rec) {
  if (typeof v === "string") return fill(v, rec);
  if (Array.isArray(v)) return v.map((x) => fillJson(x, rec));
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillJson(x, rec)]));
  return v;
}

/** Placeholder names used in the template texts. */
export const holesIn = (...texts) => [
  ...new Set(texts.flatMap((t) => [...t.matchAll(HOLE)].map((m) => m[1]))),
];

function copyTree(from, to, skipTop) {
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue;
    if (skipTop && (e.name === "video.json" || e.name === "script.md" || e.name === MARK)) continue;
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) copyTree(path.join(from, e.name), path.join(to, e.name), false);
    } else if (!SKIP_EXT.test(e.name)) copyFileSync(path.join(from, e.name), path.join(to, e.name));
  }
}

function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), {
      booleans: ["apply"],
      strings: ["template", "csv", "out", "limit", "clean"],
    });
    if (flags.clean) {
      if (!existsSync(path.join(flags.clean, MARK)))
        throw new Error(
          `${flags.clean} was not made by batch.mjs (no ${MARK} file); nothing removed.`,
        );
      rmSync(flags.clean, { recursive: true, force: true });
      console.log(`Removed ${flags.clean}.`);
      return;
    }
    if (!flags.template || !flags.csv || !flags.out)
      throw new Error("Give --template <project>, --csv <file> and --out <folder>");
    if (statSync(flags.csv).size > MAX_BYTES)
      throw new Error("The CSV is larger than 1 MB; refusing to read it.");
    const vj = path.join(flags.template, "video.json");
    const sm = path.join(flags.template, "script.md");
    const videoText = readFileSync(vj, "utf8");
    const scriptText = existsSync(sm) ? readFileSync(sm, "utf8") : "";
    const { columns, records } = readTable(readFileSync(flags.csv, "utf8"));
    const limit = Number(flags.limit ?? MAX_ROWS);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ROWS)
      throw new Error(`--limit is 1 to ${MAX_ROWS}.`);
    const used = holesIn(videoText, scriptText);
    if (!used.length)
      throw new Error(
        "The template has no {{column}} placeholders, so every video would be the same.",
      );
    const missing = used.filter((h) => !columns.includes(h));
    if (missing.length)
      throw new Error(`The template uses columns the CSV does not have: ${missing.join(", ")}.`);
    const empty = used.filter((h) => records.some((r) => r[h] === ""));
    if (empty.length)
      throw new Error(
        `Some rows have an empty value for: ${empty.join(", ")}. Fill them or remove those rows.`,
      );
    const rows = records.slice(0, limit);
    const lines = [
      `${plural(rows.length, "row", "rows")} of ${records.length}; placeholders used: ${used.join(", ")}.`,
      `Unused columns: ${columns.filter((c) => !used.includes(c)).join(", ") || "none"}.`,
    ];
    if (!flags.apply) {
      console.log(
        capLines(
          [
            ...lines,
            `Dry run: nothing written. Output would be ${flags.out}/row-001 ... row-${String(rows.length).padStart(3, "0")}.`,
          ],
          "Add --apply to write. Remove later with --clean.",
        ),
      );
      return;
    }
    if (existsSync(flags.out) && readdirSync(flags.out).length)
      throw new Error(`${flags.out} is not empty; choose a new folder.`);
    mkdirSync(flags.out, { recursive: true });
    writeFileSync(path.join(flags.out, MARK), "made by video-batch; remove with --clean\n");
    const template = JSON.parse(videoText);
    rows.forEach((rec, i) => {
      const dir = path.join(flags.out, `row-${String(i + 1).padStart(3, "0")}`);
      copyTree(flags.template, dir, true);
      writeFileSync(
        path.join(dir, "video.json"),
        `${JSON.stringify(fillJson(template, rec), null, 2)}\n`,
      );
      if (scriptText) writeFileSync(path.join(dir, "script.md"), fill(scriptText, rec));
    });
    console.log(
      capLines(
        [
          ...lines,
          `Wrote ${plural(rows.length, "project", "projects")} to ${flags.out}. The CSV was not copied.`,
        ],
        "These hold personal data: keep them local; remove with --clean when done.",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
