#!/usr/bin/env node
// Prints where each character of a kids' video stands and the next command, from the files in the project. Read-only.
// Usage: node status.mjs <project-dir>
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { bibleProblems, loadBible } from "./bible-check.mjs";
import { capLines, isEntry } from "./_lib.mjs";
import { rigProblems } from "./_rig.mjs";

/** Per character: [{ name, bible, rig, sheet, next }], where bible and rig are "ok", "missing" or "N problem(s)". */
export function characterState(dir) {
  const root = path.join(dir, "characters");
  const names = existsSync(root)
    ? readdirSync(root).filter((n) => existsSync(path.join(root, n)) && !n.startsWith("."))
    : [];
  return names.map((name) => {
    const found = loadBible(dir, name);
    const bad = found ? bibleProblems(found.bible, name, found.text).length : -1;
    const bible = bad < 0 ? "missing" : bad ? `${bad} problem(s)` : "ok";
    const rigFile = path.join(root, name, "puppet.json");
    let rig = "missing";
    if (existsSync(rigFile)) {
      try {
        const n = rigProblems(JSON.parse(readFileSync(rigFile, "utf8"))).length;
        rig = n ? `${n} problem(s)` : "ok";
      } catch {
        rig = "not valid JSON";
      }
    }
    const sheet = existsSync(path.join(root, name, "sheet.svg"));
    const flags = `--character ${name}`;
    const next =
      bible !== "ok"
        ? `fix characters/${name}/bible.md (node <skill>/scripts/bible-check.mjs . ${flags})`
        : rig === "missing"
          ? `node <skill>/scripts/puppet.mjs scaffold . ${flags}`
          : rig !== "ok"
            ? `node <skill>/scripts/puppet.mjs check . ${flags}`
            : !sheet
              ? `node <skill>/scripts/puppet.mjs sheet . ${flags}`
              : null;
    return { name, bible, rig, sheet, next };
  });
}

function main() {
  const dir = path.resolve(process.argv[2] ?? ".");
  const rows = characterState(dir);
  const lines = rows.map(
    (r) =>
      `  ${r.name.padEnd(16)} bible ${r.bible.padEnd(12)} puppet ${r.rig.padEnd(12)} sheet ${r.sheet ? "yes" : "no"}`,
  );
  const todo = rows.find((r) => r.next);
  const next = !rows.length
    ? "Next: /video-kids new-character (write characters/<name>/bible.md first)"
    : todo
      ? `Next: ${todo.next}`
      : "Next: write the episode with /video-write kids, then voice and mouth shapes.";
  console.log(capLines(lines, `${next}\nRead-only: nothing was run.`));
}

if (isEntry(import.meta.url)) main();
