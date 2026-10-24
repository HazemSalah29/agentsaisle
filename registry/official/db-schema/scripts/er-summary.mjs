#!/usr/bin/env node
// Summarizes a SQL schema (CREATE TABLE and CREATE INDEX statements) as a short ER outline and
// flags common design problems. It reads text only: it never connects to a database.
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_LINES = 40;

const stripComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
const ident = (s) =>
  s
    .trim()
    .replace(/["`[\]]/g, "")
    .split(".")
    .pop();

/** Split on `sep` at nesting depth 0, outside quotes. */
export function splitTop(text, sep) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = "";
  for (const ch of text) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      cur += ch;
    } else if (ch === "(") {
      depth++;
      cur += ch;
    } else if (ch === ")") {
      depth--;
      cur += ch;
    } else if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

const cols = (s) => splitTop(s, ",").map((c) => ident(c.trim().split(/\s+/)[0]));

/** Parse CREATE TABLE / CREATE INDEX / ALTER TABLE ... ADD FOREIGN KEY into a plain model. */
export function parseDdl(sql) {
  const tables = new Map();
  const extraIndexes = [];
  for (const raw of splitTop(stripComments(sql), ";")) {
    const stmt = raw.trim();
    const create =
      /^create\s+(?:temp(?:orary)?\s+|unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)\s*\(([\s\S]*)\)[^)]*$/i.exec(
        stmt,
      );
    if (create) {
      const table = {
        name: ident(create[1]),
        columns: [],
        primaryKey: [],
        foreignKeys: [],
        indexes: [],
      };
      for (const item of splitTop(create[2], ",")
        .map((x) => x.trim())
        .filter(Boolean)) {
        const body = item.replace(/^constraint\s+\S+\s+/i, "");
        const pk = /^primary\s+key\s*(?:\S+\s*)?\(([^)]*)\)/i.exec(body);
        const fk =
          /^foreign\s+key\s*(?:\S+\s*)?\(([^)]*)\)\s*references\s+([^\s(]+)\s*(?:\(([^)]*)\))?/i.exec(
            body,
          );
        const uq = /^unique(?:\s+(?:key|index))?\s*(?:\S+\s*)?\(([^)]*)\)/i.exec(body);
        const key = /^(?:key|index)\s+(?:\S+\s*)?\(([^)]*)\)/i.exec(body);
        if (pk) table.primaryKey = cols(pk[1]);
        else if (fk)
          table.foreignKeys.push({
            columns: cols(fk[1]),
            refTable: ident(fk[2]),
            refColumns: fk[3] ? cols(fk[3]) : [],
          });
        else if (uq) table.indexes.push({ name: null, columns: cols(uq[1]), unique: true });
        else if (key) table.indexes.push({ name: null, columns: cols(key[1]), unique: false });
        if (pk || fk || uq || key || /^check\b/i.test(body)) continue;
        const m = /^("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+([\s\S]*)$/.exec(item);
        if (!m) continue;
        const rest = m[2];
        const type =
          /^([a-z_][\w ]*?(?:\([^)]*\))?(?:\[\])?)(?=\s+(?:not|null|default|primary|references|unique|check|generated|constraint|collate|auto_increment|autoincrement)\b|$)/i
            .exec(rest)?.[1]
            .trim() ?? rest.split(/\s+/)[0];
        const col = {
          name: ident(m[1]),
          type,
          notNull: /\bnot\s+null\b/i.test(rest) || /\bprimary\s+key\b/i.test(rest),
          unique: /\bunique\b/i.test(rest),
          hasDefault: /\bdefault\b|\bgenerated\b|\bauto_?increment\b|\bserial\b/i.test(rest),
        };
        table.columns.push(col);
        if (/\bprimary\s+key\b/i.test(rest)) table.primaryKey = [col.name];
        const ref = /\breferences\s+([^\s(]+)\s*(?:\(([^)]*)\))?/i.exec(rest);
        if (ref)
          table.foreignKeys.push({
            columns: [col.name],
            refTable: ident(ref[1]),
            refColumns: ref[2] ? cols(ref[2]) : [],
          });
        if (col.unique) table.indexes.push({ name: null, columns: [col.name], unique: true });
      }
      tables.set(table.name, table);
      continue;
    }
    const index =
      /^create\s+(unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(\S+)\s+on\s+(?:only\s+)?([^\s(]+)\s*(?:using\s+\w+\s*)?\(([^)]*)\)/i.exec(
        stmt,
      );
    if (index) {
      extraIndexes.push({
        table: ident(index[3]),
        index: { name: ident(index[2]), columns: cols(index[4]), unique: !!index[1] },
      });
      continue;
    }
    const fk =
      /^alter\s+table\s+(?:only\s+)?([^\s]+)\s+add\s+(?:constraint\s+\S+\s+)?foreign\s+key\s*\(([^)]*)\)\s*references\s+([^\s(]+)\s*(?:\(([^)]*)\))?/i.exec(
        stmt,
      );
    if (fk)
      extraIndexes.push({
        table: ident(fk[1]),
        fk: { columns: cols(fk[2]), refTable: ident(fk[3]), refColumns: fk[4] ? cols(fk[4]) : [] },
      });
  }
  for (const e of extraIndexes) {
    const t = tables.get(e.table);
    if (!t) continue;
    if (e.index) t.indexes.push(e.index);
    if (e.fk) t.foreignKeys.push(e.fk);
  }
  return [...tables.values()];
}

/** Design problems, as { table, rule, message }. */
export function analyze(tables) {
  const findings = [];
  const names = new Set(tables.map((t) => t.name));
  for (const t of tables) {
    if (t.primaryKey.length === 0)
      findings.push({
        table: t.name,
        rule: "no-primary-key",
        message: "no primary key. Every table needs one.",
      });
    const covered = (fkCols) =>
      [{ columns: t.primaryKey }, ...t.indexes].some((i) =>
        fkCols.every((c, n) => i.columns[n] === c),
      );
    for (const fk of t.foreignKeys) {
      if (!covered(fk.columns))
        findings.push({
          table: t.name,
          rule: "fk-without-index",
          message: `foreign key (${fk.columns.join(", ")}) has no index. Joins and deletes on ${fk.refTable} will scan.`,
        });
      if (!names.has(fk.refTable))
        findings.push({
          table: t.name,
          rule: "unknown-reference",
          message: `references ${fk.refTable}, which is not in this schema.`,
        });
    }
    const others = t.columns.filter((c) => !t.primaryKey.includes(c.name));
    if (others.length >= 3 && others.every((c) => !c.notNull))
      findings.push({
        table: t.name,
        rule: "all-nullable",
        message: "every column except the key allows NULL. Mark required columns NOT NULL.",
      });
  }
  return findings;
}

export function summarize(tables, findings = analyze(tables)) {
  const lines = [`er-summary: ${tables.length} table${tables.length === 1 ? "" : "s"}`];
  for (const t of tables) {
    const parts = t.columns.map((c) => {
      const tags = [
        t.primaryKey.includes(c.name) ? "PK" : "",
        c.notNull && !t.primaryKey.includes(c.name) ? "NN" : "",
        c.unique ? "UQ" : "",
      ].filter(Boolean);
      const fk = t.foreignKeys.find((f) => f.columns.length === 1 && f.columns[0] === c.name);
      return `${c.name} ${c.type}${tags.length ? " " + tags.join(" ") : ""}${fk ? ` -> ${fk.refTable}` : ""}`;
    });
    lines.push(`  ${t.name}: ${parts.join(", ")}`);
  }
  const rels = tables.flatMap((t) =>
    t.foreignKeys.map((f) => `${t.name}(${f.columns.join(",")}) -> ${f.refTable}`),
  );
  if (rels.length) lines.push(`  relations: ${rels.join("; ")}`);
  if (findings.length === 0) lines.push("  no problems found");
  else for (const f of findings) lines.push(`  ${f.rule} ${f.table}: ${f.message}`);
  if (lines.length <= MAX_LINES) return lines.join("\n");
  return [
    ...lines.slice(0, MAX_LINES - 1),
    `  ... ${lines.length - MAX_LINES + 1} more lines`,
  ].join("\n");
}

function main(argv) {
  const file = argv.find((a) => !a.startsWith("--"));
  const sql = file ? readFileSync(path.resolve(file), "utf8") : readFileSync(0, "utf8");
  const tables = parseDdl(sql);
  if (tables.length === 0) {
    console.log(
      "er-summary: no CREATE TABLE statements found. Pass a .sql file or pipe DDL on stdin.",
    );
    process.exit(1);
  }
  const findings = analyze(tables);
  console.log(summarize(tables, findings));
  process.exit(findings.length ? 1 : 0);
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
