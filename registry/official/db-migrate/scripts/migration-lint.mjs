#!/usr/bin/env node
// Flags lock and data-loss risks in a migration file. It reads text only; it never runs SQL.
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_LINES = 40;

export function detectEngine(sql) {
  if (/\bconcurrently\b|::\w+|\bserial\b|\bjsonb\b|\bbigserial\b|\bplpgsql\b/i.test(sql))
    return "postgres";
  if (/\bauto_increment\b|`\w+`|\bengine\s*=\s*innodb\b/i.test(sql)) return "mysql";
  if (/\bautoincrement\b|\bpragma\b/i.test(sql)) return "sqlite";
  if (/\bdb\.\w+\.(?:drop|deleteMany|updateMany|createIndex)\b|\bdropDatabase\b/.test(sql))
    return "mongodb";
  return "generic";
}

/** Blank out SQL and JS comments but keep line numbers. */
const blank = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(--|\/\/)[^\n]*/g, "");

/** Each rule: [id, level, engines (null = all), test(statement) -> message | null] */
const RULES = [
  [
    "drop-table",
    "warn",
    null,
    (s) =>
      /\bdrop\s+table\b/i.test(s)
        ? "DROP TABLE destroys data and cannot be rolled back. Rename it first and drop it in a later release."
        : null,
  ],
  [
    "drop-column",
    "warn",
    null,
    (s) =>
      /\bdrop\s+column\b/i.test(s)
        ? "DROP COLUMN destroys data, and running code may still read it. Stop using the column first, drop it in a later release."
        : null,
  ],
  [
    "truncate",
    "warn",
    null,
    (s) =>
      /\btruncate\b/i.test(s)
        ? "TRUNCATE removes every row and cannot be rolled back after commit."
        : null,
  ],
  [
    "delete-no-where",
    "warn",
    null,
    (s) =>
      /\bdelete\s+from\s+\S+\s*(?:;|$)/i.test(s.trim())
        ? "DELETE with no WHERE removes every row."
        : null,
  ],
  [
    "update-no-where",
    "warn",
    null,
    (s) =>
      /^\s*update\s+\S+\s+set\b(?![\s\S]*\bwhere\b)/i.test(s)
        ? "UPDATE with no WHERE touches every row. Batch large backfills."
        : null,
  ],
  [
    "not-null-no-default",
    "warn",
    null,
    (s) =>
      /\badd\s+column\b[^;]*\bnot\s+null\b/i.test(s) && !/\bdefault\b/i.test(s)
        ? "NOT NULL column with no DEFAULT fails on a table that has rows. Add it nullable, backfill, then set NOT NULL."
        : null,
  ],
  [
    "set-not-null",
    "warn",
    ["postgres"],
    (s) =>
      /\balter\s+column\b[^;]*\bset\s+not\s+null\b/i.test(s)
        ? "SET NOT NULL scans the whole table under an exclusive lock. Add a CHECK (col IS NOT NULL) NOT VALID, validate it, then set NOT NULL."
        : null,
  ],
  [
    "index-not-concurrent",
    "warn",
    ["postgres"],
    (s) =>
      /\bcreate\s+(?:unique\s+)?index\b/i.test(s) && !/\bconcurrently\b/i.test(s)
        ? "CREATE INDEX blocks writes while it builds. Use CREATE INDEX CONCURRENTLY (outside a transaction)."
        : null,
  ],
  [
    "fk-not-valid",
    "warn",
    ["postgres"],
    (s) =>
      /\badd\b[^;]*\bforeign\s+key\b/i.test(s) && !/\bnot\s+valid\b/i.test(s)
        ? "Adding a foreign key validates every row under a lock. Add it NOT VALID, then VALIDATE CONSTRAINT."
        : null,
  ],
  [
    "alter-type",
    "warn",
    null,
    (s) =>
      /\balter\s+column\b[^;]*\b(?:set\s+data\s+)?type\b|\bmodify\s+column\b/i.test(s)
        ? "Changing a column type can rewrite the whole table. Add a new column, backfill, switch, drop the old one."
        : null,
  ],
  [
    "rename",
    "warn",
    null,
    (s) =>
      /\brename\s+(?:column|to)\b|\brename\s+table\b/i.test(s)
        ? "A rename breaks code that is still running during the deploy. Add the new name, copy, switch, then drop the old name."
        : null,
  ],
  [
    "mysql-algorithm",
    "info",
    ["mysql"],
    (s) =>
      /\balter\s+table\b/i.test(s) && !/\balgorithm\s*=/i.test(s)
        ? "Add ALGORITHM=INPLACE, LOCK=NONE so MySQL errors instead of silently locking if it cannot do that."
        : null,
  ],
  [
    "sqlite-alter-column",
    "warn",
    ["sqlite"],
    (s) =>
      /\balter\s+column\b/i.test(s)
        ? "SQLite has no ALTER COLUMN. Create a new table, copy the rows, drop the old one, rename the new one."
        : null,
  ],
  [
    "mongo-unbounded-write",
    "warn",
    ["mongodb"],
    (s) =>
      /\b(?:deleteMany|updateMany)\s*\(\s*\{\s*\}/.test(s)
        ? "deleteMany or updateMany with an empty filter touches every document. Add a filter and batch it."
        : null,
  ],
  [
    "mongo-drop",
    "warn",
    ["mongodb"],
    (s) =>
      /\.drop\s*\(|\bdropDatabase\b/.test(s)
        ? "Dropping a collection or database destroys data. Rename it first and drop later."
        : null,
  ],
];

/** Statements with the line each starts on. SQL splits on `;`; Mongo scripts split on lines. */
function statements(text, engine) {
  const out = [];
  if (engine === "mongodb") {
    text.split("\n").forEach((line, i) => line.trim() && out.push({ line: i + 1, text: line }));
    return out;
  }
  let line = 1;
  let cur = "";
  let startLine = 1;
  for (const ch of text) {
    if (!cur.trim()) startLine = line;
    if (ch === "\n") line++;
    if (ch === ";") {
      if (cur.trim()) out.push({ line: startLine, text: cur });
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push({ line: startLine, text: cur });
  return out;
}

/**
 * Lint a migration. Options: engine (default: detected), requireDown (flag a file with no down step).
 * Returns { engine, findings: [{ line, rule, level, message }] }.
 */
export function lintMigration(sql, { engine, requireDown = false } = {}) {
  const eng = engine ?? detectEngine(sql);
  const text = blank(sql);
  const findings = [];
  const hasTransaction = /^\s*begin\b/im.test(text);
  for (const stmt of statements(text, eng)) {
    for (const [rule, level, engines, test] of RULES) {
      if (engines && !engines.includes(eng)) continue;
      const message = test(stmt.text.replace(/\s+/g, " "));
      if (message) findings.push({ line: stmt.line, rule, level, message });
    }
    if (hasTransaction && /\bconcurrently\b/i.test(stmt.text))
      findings.push({
        line: stmt.line,
        rule: "concurrent-in-transaction",
        level: "warn",
        message:
          "CONCURRENTLY cannot run inside a transaction block. Remove BEGIN or split the file.",
      });
  }
  if (
    requireDown &&
    !/(^|\n)\s*(--|\/\/)?\s*(\+migrate\s+down|down\b|rollback\b|migrate:down)/i.test(sql)
  )
    findings.push({
      line: 1,
      rule: "no-down",
      level: "warn",
      message: "no down or rollback step found. Add one, or say why this migration is one-way.",
    });
  return { engine: eng, findings };
}

export function format({ engine, findings }, file = "migration") {
  if (findings.length === 0) return `migration-lint: ${file} (${engine}): no risks found.`;
  const rows = findings.map((f) => `  line ${f.line}  ${f.level}  ${f.rule}: ${f.message}`);
  const head = `migration-lint: ${file} (${engine}): ${findings.length} finding${findings.length === 1 ? "" : "s"}`;
  const all = [head, ...rows];
  return all.length <= MAX_LINES
    ? all.join("\n")
    : [...all.slice(0, MAX_LINES - 1), `  ... ${all.length - MAX_LINES + 1} more`].join("\n");
}

function main(argv) {
  const get = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const file = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--engine");
  if (!file) {
    console.log(
      "migration-lint: pass a migration file. Options: --engine postgres|mysql|sqlite|mongodb, --require-down",
    );
    process.exit(1);
  }
  const result = lintMigration(readFileSync(path.resolve(file), "utf8"), {
    engine: get("--engine"),
    requireDown: argv.includes("--require-down"),
  });
  console.log(format(result, path.basename(file)));
  process.exit(result.findings.some((f) => f.level !== "info") ? 1 : 0);
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
