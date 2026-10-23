#!/usr/bin/env node
// Generates deterministic, realistic-looking seed data from a small JSON spec. The same seed always
// produces the same rows. It writes SQL, JSON or CSV text; it never connects to a database.
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FIRST = [
  "Ada",
  "Ben",
  "Chloe",
  "Dev",
  "Elena",
  "Farid",
  "Grace",
  "Hugo",
  "Iris",
  "Jonas",
  "Keiko",
  "Liam",
  "Maya",
  "Noor",
  "Omar",
  "Priya",
  "Quinn",
  "Rosa",
  "Sam",
  "Tara",
  "Uma",
  "Victor",
  "Wren",
  "Xavier",
  "Yara",
  "Zane",
  "Amara",
  "Bruno",
  "Clara",
  "Diego",
];
const LAST = [
  "Alvarez",
  "Brooks",
  "Chen",
  "Dubois",
  "Evans",
  "Fischer",
  "Garcia",
  "Hassan",
  "Ito",
  "Jensen",
  "Kim",
  "Lopez",
  "Mbeki",
  "Nakamura",
  "Okafor",
  "Petrov",
  "Quartey",
  "Rossi",
  "Singh",
  "Tanaka",
  "Usman",
  "Varga",
  "Walker",
  "Xu",
  "Young",
  "Zielinski",
];
const WORDS = [
  "project",
  "invoice",
  "team",
  "release",
  "review",
  "budget",
  "client",
  "report",
  "launch",
  "update",
  "plan",
  "design",
  "support",
  "account",
  "order",
  "report",
  "meeting",
  "draft",
  "schedule",
  "feedback",
  "quality",
  "delivery",
  "contract",
  "payment",
  "roadmap",
];
const COMPANIES = [
  "Northwind",
  "Harbor & Co",
  "Bluepeak",
  "Kiln Studio",
  "Meridian",
  "Larkspur",
  "Oakridge",
  "Tidewater",
  "Foxglove",
  "Ironbridge",
];
const CITIES = [
  "Lisbon",
  "Oslo",
  "Austin",
  "Nairobi",
  "Osaka",
  "Toronto",
  "Berlin",
  "Mumbai",
  "Lima",
  "Cairo",
];

/** Small, fast, seedable generator (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, list) => list[Math.floor(r() * list.length)];
const int = (r, min, max) => min + Math.floor(r() * (max - min + 1));
const pad = (n, w = 2) => String(n).padStart(w, "0");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Generators by name. Each takes (random, options, row index, row so far). */
export const GENERATORS = {
  serial: (_r, _o, i) => i + 1,
  uuid: (r) => {
    const h = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16)).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${"89ab"[Math.floor(r() * 4)]}${h.slice(17, 20)}-${h.slice(20)}`;
  },
  firstName: (r) => pick(r, FIRST),
  lastName: (r) => pick(r, LAST),
  fullName: (r) => `${pick(r, FIRST)} ${pick(r, LAST)}`,
  email: (r, _o, i) => `${slug(pick(r, FIRST))}.${slug(pick(r, LAST))}${i + 1}@example.com`,
  company: (r) => pick(r, COMPANIES),
  city: (r) => pick(r, CITIES),
  word: (r) => pick(r, WORDS),
  sentence: (r) => {
    const n = int(r, 5, 10);
    const s = Array.from({ length: n }, () => pick(r, WORDS)).join(" ");
    return s[0].toUpperCase() + s.slice(1) + ".";
  },
  bool: (r, o) => r() < (o.chance ?? 0.5),
  int: (r, o) => int(r, o.min ?? 0, o.max ?? 1000),
  decimal: (r, o) =>
    Number(((o.min ?? 0) + r() * ((o.max ?? 1000) - (o.min ?? 0))).toFixed(o.places ?? 2)),
  oneOf: (r, o) => pick(r, o.values),
  timestamp: (r, o) => {
    const from = Date.parse(o.from ?? "2024-01-01");
    const to = Date.parse(o.to ?? "2025-01-01");
    const d = new Date(from + Math.floor(r() * (to - from)));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  },
  date: (r, o) => GENERATORS.timestamp(r, o).slice(0, 10),
  constant: (_r, o) => o.value,
};

/** Normalize a column spec: "email", { type: "int", min: 1 }, { oneOf: [...] }, { ref: "teams.id" }. */
function normalize(name, spec) {
  if (typeof spec === "string") return { type: spec };
  if (spec && typeof spec === "object") {
    if (spec.ref) return { ref: spec.ref };
    if (spec.oneOf) return { type: "oneOf", values: spec.oneOf };
    if (spec.type) return spec;
  }
  throw new Error(`column "${name}": expected a generator name, { type }, { oneOf } or { ref }.`);
}

/** Order tables so every referenced table is generated first. Throws on a cycle or a missing table. */
export function order(tables) {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const out = [];
  const state = new Map();
  const visit = (t, trail) => {
    if (state.get(t.name) === "done") return;
    if (state.get(t.name) === "busy")
      throw new Error(`tables reference each other in a loop: ${[...trail, t.name].join(" -> ")}.`);
    state.set(t.name, "busy");
    for (const [col, raw] of Object.entries(t.columns)) {
      const c = normalize(col, raw);
      if (!c.ref) continue;
      const [refTable] = c.ref.split(".");
      const target = byName.get(refTable);
      if (!target)
        throw new Error(`${t.name}.${col} references "${refTable}", which is not in the spec.`);
      if (refTable !== t.name) visit(target, [...trail, t.name]);
    }
    state.set(t.name, "done");
    out.push(t);
  };
  tables.forEach((t) => visit(t, []));
  return out;
}

/** Generate rows: { tableName: [row, ...] }. Pure: the same spec and seed give the same result. */
export function generate(spec, seedOverride) {
  if (!spec?.tables?.length) throw new Error('spec needs a non-empty "tables" array.');
  const seed = seedOverride ?? spec.seed ?? 1;
  const out = {};
  for (const table of order(spec.tables)) {
    const r = rng(seed + [...table.name].reduce((s, ch) => s + ch.charCodeAt(0), 0));
    const rows = [];
    for (let i = 0; i < (table.rows ?? 10); i++) {
      const row = {};
      for (const [col, raw] of Object.entries(table.columns)) {
        const c = normalize(col, raw);
        if (c.ref) {
          const [refTable, refCol] = c.ref.split(".");
          const pool = out[refTable];
          if (!pool?.length)
            throw new Error(`${table.name}.${col}: "${refTable}" has no rows to reference.`);
          if (!(refCol in pool[0]))
            throw new Error(`${table.name}.${col}: "${refTable}" has no column "${refCol}".`);
          row[col] = pool[Math.floor(r() * pool.length)][refCol];
          continue;
        }
        const gen = GENERATORS[c.type];
        if (!gen)
          throw new Error(
            `${table.name}.${col}: unknown generator "${c.type}". Known: ${Object.keys(GENERATORS).join(", ")}.`,
          );
        row[col] = gen(r, c, i, row);
      }
      rows.push(row);
    }
    out[table.name] = rows;
  }
  return out;
}

const sqlValue = (v) =>
  v === null || v === undefined
    ? "NULL"
    : typeof v === "number"
      ? String(v)
      : typeof v === "boolean"
        ? v
          ? "TRUE"
          : "FALSE"
        : `'${String(v).replace(/'/g, "''")}'`;

export function toSql(data, batch = 100) {
  const out = [];
  for (const [table, rows] of Object.entries(data)) {
    if (rows.length === 0) continue;
    const cols = Object.keys(rows[0]);
    for (let i = 0; i < rows.length; i += batch) {
      const chunk = rows
        .slice(i, i + batch)
        .map((row) => `  (${cols.map((c) => sqlValue(row[c])).join(", ")})`);
      out.push(`INSERT INTO ${table} (${cols.join(", ")}) VALUES\n${chunk.join(",\n")};`);
    }
  }
  return out.join("\n\n") + "\n";
}

const csvCell = (v) =>
  /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
export function toCsv(rows) {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  return (
    [cols.join(","), ...rows.map((row) => cols.map((c) => csvCell(row[c])).join(","))].join("\n") +
    "\n"
  );
}

function main(argv) {
  const get = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const file = argv.find(
    (a, i) => !a.startsWith("--") && !["--seed", "--format", "--out"].includes(argv[i - 1]),
  );
  if (!file) {
    console.log("seed-data: pass a spec file. Options: --seed N, --format sql|json|csv, --out DIR");
    process.exit(1);
  }
  try {
    const spec = JSON.parse(readFileSync(path.resolve(file), "utf8"));
    const seed = get("--seed") === undefined ? undefined : Number(get("--seed"));
    const data = generate(spec, seed);
    const format = get("--format") ?? "sql";
    const out = get("--out");
    const render = { sql: () => toSql(data), json: () => JSON.stringify(data, null, 2) + "\n" }[
      format
    ];
    if (format === "csv") {
      if (!out) throw new Error("--format csv needs --out DIR (one file per table).");
      mkdirSync(path.resolve(out), { recursive: true });
      for (const [t, rows] of Object.entries(data))
        writeFileSync(path.join(path.resolve(out), `${t}.csv`), toCsv(rows));
      console.log(
        `seed-data: wrote ${Object.keys(data).length} CSV files to ${out} (seed ${seed ?? spec.seed ?? 1})`,
      );
    } else if (render) {
      if (out) {
        mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
        writeFileSync(path.resolve(out), render());
        console.log(
          `seed-data: wrote ${Object.values(data).reduce((n, r) => n + r.length, 0)} rows to ${out} (seed ${seed ?? spec.seed ?? 1})`,
        );
      } else process.stdout.write(render());
    } else throw new Error(`unknown format "${format}". Use sql, json or csv.`);
  } catch (e) {
    console.log(`seed-data: ${e.message}`);
    process.exit(1);
  }
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
