#!/usr/bin/env node
// Checks continuity.json against shots.json and prints which images to feed the next shot.
// continuity.json: { "shots": { "<shot id>": { "location", "timeOfDay", "anchor": "<relative image path>",
//   "characters": { "<name>": { "outfit", "props": [], "change": "why it differs from the previous shot" } } } } }
// Read-only. Usage: node continuity.mjs <project-dir> [--next <shot-id>]
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, isInside, parseArgs } from "./_lib.mjs";

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Problems: missing entries, and a changed outfit, props, place or time of day with no stated reason. */
export function continuityProblems(shots, log, exists = () => true) {
  const out = [];
  let prev = null;
  shots.forEach((s, i) => {
    const e = log?.shots?.[s.id];
    if (!e) return out.push(`${s.id}: no entry in continuity.json`);
    for (const k of ["location", "timeOfDay"]) if (!e[k]) out.push(`${s.id}: ${k} is empty`);
    if (e.anchor !== undefined && (!isInside(e.anchor) || !exists(e.anchor)))
      out.push(`${s.id}: anchor "${e.anchor}" is not an existing file in the project`);
    if (i > 0 && !e.anchor)
      out.push(`${s.id}: needs an anchor image (the best earlier frame or a reference-pack view)`);
    for (const name of s.characters ?? []) {
      const c = e.characters?.[name];
      if (!c?.outfit) {
        out.push(`${s.id}: ${name} has no outfit written down`);
        continue;
      }
      const before = prev?.characters?.[name];
      if (before && (!same(before.outfit, c.outfit) || !same(before.props, c.props)) && !c.change)
        out.push(`${s.id}: ${name}'s outfit or props changed with no "change" reason`);
    }
    if (prev && (prev.timeOfDay !== e.timeOfDay || prev.location !== e.location) && !e.change)
      out.push(`${s.id}: the place or time of day changed with no "change" reason`);
    prev = e;
  });
  return out;
}

/** Image paths to pass as --ref for a shot: its anchor plus each character's front view, when they exist. */
export function refsFor(shot, entry, exists) {
  const refs = [];
  if (entry?.anchor) refs.push(entry.anchor);
  for (const name of shot.characters ?? []) {
    const f = `refpack/${name}/front.png`;
    if (exists(f)) refs.push(f);
  }
  return refs.slice(0, 4);
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2), { strings: ["next"] });
  const dir = positional[0];
  if (!dir) {
    console.error("Usage: node continuity.mjs <project-dir> [--next <shot-id>]");
    process.exit(2);
  }
  const readJson = (f) =>
    existsSync(path.join(dir, f)) ? JSON.parse(readFileSync(path.join(dir, f), "utf8")) : null;
  const shots = readJson("shots.json")?.shots;
  const log = readJson("continuity.json");
  if (!shots || !log) {
    console.error("Needs shots.json and continuity.json in the project.");
    process.exit(2);
  }
  const exists = (f) => isInside(f) && existsSync(path.join(dir, f));
  if (flags.next) {
    const s = shots.find((x) => x.id === flags.next);
    if (!s) {
      console.error(`No shot "${flags.next}".`);
      process.exit(2);
    }
    console.log(refsFor(s, log.shots?.[s.id], exists).join(",") || "(no reference images yet)");
    return;
  }
  const problems = continuityProblems(shots, log, exists);
  if (problems.length) {
    console.log(
      capLines(
        problems.map((p) => `  ${p}`),
        `${problems.length} problem(s)`,
      ),
    );
    process.exit(1);
  }
  console.log(`ok: ${shots.length} shot(s) continuous`);
}
if (isEntry(import.meta.url)) main();
