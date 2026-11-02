#!/usr/bin/env node
// Reference packs: one set of stills per character (front, three-quarter, side, expressions, poses) made BEFORE any
// shot, so every shot starts from the same identity. refpack.json lists each character's look; this script turns it
// into prompts for video-generate (one character per image, never several together) and checks the files exist.
// Usage: node refpack.mjs <project-dir> [--check]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ipRefusal } from "./ip-guard.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

export const VIEWS = {
  front: "front view, standing, neutral face, plain background",
  "three-quarter": "three-quarter view, standing, neutral face, plain background",
  side: "side view, standing, neutral face, plain background",
  expressions:
    "expression sheet: happy, sad, surprised, angry, in a grid, same character, plain background",
  poses:
    "pose sheet: walking, running, sitting, waving, in a grid, same character, plain background",
};
const NAME = /^[a-z][a-z0-9-]{0,31}$/;

/** Prompts and problems for a parsed refpack.json ({ style, characters: { name: { look } } }). */
export function packPlan(doc) {
  const problems = [];
  const items = [];
  const names = Object.keys(doc?.characters ?? {});
  if (!names.length) problems.push("refpack.json: needs at least one character");
  const style = String(doc?.style ?? "").trim();
  if (!style)
    problems.push('refpack.json: "style" is empty (copy the style words from style-bible.md)');
  for (const name of names) {
    const look = String(doc.characters[name]?.look ?? "").trim();
    if (!NAME.test(name)) problems.push(`${name}: use lowercase letters, digits and dashes`);
    if (!look) problems.push(`${name}: "look" is empty`);
    const refusal = ipRefusal(`${name} ${look} ${style}`);
    if (refusal) problems.push(`${name}: ${refusal}`);
    for (const [view, words] of Object.entries(VIEWS))
      items.push({
        character: name,
        view,
        id: `${name}-${view}`.slice(0, 32),
        path: `refpack/${name}/${view}.png`,
        prompt: `${look}. ${words}. Style: ${style}. One character only.`,
      });
  }
  return { problems, items };
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2), { booleans: ["check"] });
  const dir = positional[0];
  const file = dir && path.join(dir, "refpack.json");
  if (!dir || !existsSync(file)) {
    console.error("Usage: node refpack.mjs <project-dir> [--check]  (needs refpack.json)");
    process.exit(2);
  }
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    console.error("refpack.json: not valid JSON");
    process.exit(1);
  }
  const { problems, items } = packPlan(doc);
  if (flags.check)
    for (const i of items)
      if (!existsSync(path.join(dir, i.path))) problems.push(`missing ${i.path}`);
  if (problems.length) {
    console.log(
      capLines(
        problems.map((p) => `  ${p}`),
        `${problems.length} problem(s)`,
      ),
    );
    process.exit(1);
  }
  if (!flags.check) {
    writeFileSync(path.join(dir, "refpack-plan.json"), JSON.stringify(items, null, 2) + "\n");
    console.log(
      `ok: ${items.length} image(s) planned in refpack-plan.json. Make each with video-generate (--id, then copy to its path), the front view first.`,
    );
  } else console.log(`ok: ${items.length} reference image(s) present`);
}
if (isEntry(import.meta.url)) main();
