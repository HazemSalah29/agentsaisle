#!/usr/bin/env node
// Lists the scenes of a project (with their start times) and checks its interactive.json against them, so
// branch points are written against real scene ids. `--init` writes an example file for a project whose scenes
// follow the pattern the branch rules need; it never overwrites. Text and JSON only.
// Usage: node branches.mjs <project-dir> [--init]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { branchProblems } from "./_branches.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));

/** A starter interactive.json for scenes s1..sN: question after the first scene, the next two as options. */
export function example(sceneIds) {
  if (sceneIds.length < 5)
    throw new Error(
      "A branch needs at least 5 scenes: the question, two answers (one scene each) and one to continue with.",
    );
  const [after, a, b, then] = [sceneIds[1], sceneIds[2], sceneIds[3], sceneIds[4]];
  return {
    version: 1,
    branches: [
      {
        id: "pick",
        after,
        question: "Which one do you want to see?",
        options: [
          { label: "Option A", from: a, to: a },
          { label: "Option B", from: b, to: b },
        ],
        then,
      },
    ],
  };
}

function main() {
  try {
    const { flags, positional } = parseArgs(process.argv.slice(2), { booleans: ["init"] });
    if (!positional[0]) throw new Error("Usage: node branches.mjs <project-dir> [--init]");
    const dir = path.resolve(positional[0]);
    const video = readJson(path.join(dir, "video.json"));
    const ids = video.scenes.map((s) => s.id);
    const file = path.join(dir, "interactive.json");
    const timing = existsSync(path.join(dir, "timing.json"))
      ? readJson(path.join(dir, "timing.json"))
      : null;
    const rows = video.scenes.map(
      (s, i) =>
        `${i + 1}. ${s.id} (${s.kind})${timing?.scenes?.[i] ? ` ${timing.scenes[i].start.toFixed(1)} s` : ""}`,
    );
    if (flags.init) {
      if (existsSync(file)) throw new Error("interactive.json exists; edit it instead.");
      writeFileSync(file, `${JSON.stringify(example(ids), null, 2)}\n`);
      console.log(
        capLines(
          [
            ...rows,
            "Wrote interactive.json (an example: rename the labels, then reorder the scenes to fit).",
          ],
          "Check it with this script, then export with video-core export-html.mjs.",
        ),
      );
      return;
    }
    if (!existsSync(file)) {
      console.log(capLines(rows, "No interactive.json yet; run with --init for an example."));
      return;
    }
    const bad = branchProblems(readJson(file), ids);
    if (bad.length) {
      console.error(capLines([...bad, ...rows], `${bad.length} problem(s) in interactive.json.`));
      process.exit(2);
    }
    console.log(capLines(rows, "interactive.json is valid."));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
