#!/usr/bin/env node
// /video init: creates the studio folder layout. Idempotent: it never overwrites or deletes anything, and it
// adds lines to .gitignore only when they are missing. Writes only inside the folder it is given.
// Usage: node init.mjs [folder]   (default: the current folder)
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";

export const DIRS = ["brand/fonts", "library/music", "library/sfx", "inbox", "projects", "exports"];
export const GITIGNORE = ["projects/*/cache/", "projects/*/out/", "exports/"];

/** Files under assets/studio as relative paths, sorted. */
export function templateFiles(root = path.join(skillDir(), "assets", "studio")) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      if (e.isSymbolicLink()) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(root, p).split(path.sep).join("/"));
    }
  };
  walk(root);
  return out;
}

/** Create the studio in `target`. Returns { created, kept, ignored } lists of relative paths. */
export function initStudio(target, root = path.join(skillDir(), "assets", "studio")) {
  const created = [];
  const kept = [];
  mkdirSync(target, { recursive: true });
  for (const d of DIRS) {
    const p = path.join(target, d);
    if (existsSync(p)) kept.push(`${d}/`);
    else {
      mkdirSync(p, { recursive: true });
      created.push(`${d}/`);
    }
  }
  for (const rel of templateFiles(root)) {
    const dest = path.join(target, rel);
    if (existsSync(dest)) {
      kept.push(rel);
      continue;
    }
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(path.join(root, rel)), { flag: "wx" });
    created.push(rel);
  }
  const gi = path.join(target, ".gitignore");
  const have = existsSync(gi)
    ? readFileSync(gi, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
    : [];
  const missing = GITIGNORE.filter((l) => !have.includes(l));
  if (missing.length) {
    const lead =
      existsSync(gi) && readFileSync(gi, "utf8").length && !readFileSync(gi, "utf8").endsWith("\n")
        ? "\n"
        : "";
    appendFileSync(gi, `${lead}${missing.join("\n")}\n`);
  }
  return { created, kept, ignored: missing };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const target = path.resolve(parsed.positional[0] ?? ".");
  if (existsSync(target) && !statSync(target).isDirectory()) {
    console.error(`${target} is not a folder.`);
    process.exit(2);
  }
  const { created, kept, ignored } = initStudio(target);
  console.log(
    capLines(
      [...created.map((c) => `+ ${c}`), ...kept.map((k) => `= ${k} (kept)`)],
      `Studio ready in ${target}: ${created.length} created, ${kept.length} kept${ignored.length ? `, .gitignore +${ignored.length}` : ""}.\nNext: /video doctor`,
    ),
  );
}

if (isEntry(import.meta.url)) main();
