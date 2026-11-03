#!/usr/bin/env node
// One command for the steps that always run in the same order: check -> timing -> render (-> credits for a final).
// It stops at the first one that fails and prints that step's own message, so one call replaces four. Every step is
// the script you would run by hand; nothing here decides anything they do not.
// Usage: node build.mjs <project-dir> [--draft] [--ignore-approval] [--preset volt|ember|ice|grape]
// Exit: 0 built, 1 a step failed (its output is shown), 2 could not start.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./run.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The steps for a build, as { id, script, args }. Pure. */
export function buildSteps(dir, { draft = false, ignoreApproval = false, preset } = {}) {
  const render = [dir];
  if (draft) render.push("--draft");
  if (ignoreApproval) render.push("--ignore-approval");
  if (preset) render.push("--preset", preset);
  return [
    { id: "check", script: "check.mjs", args: [dir] },
    { id: "timing", script: "timing.mjs", args: [dir] },
    { id: "render", script: "render.mjs", args: render },
    ...(draft ? [] : [{ id: "credits", script: "credits.mjs", args: [dir] }]),
  ];
}

const lastLines = (r, n = 12) =>
  (r.stdout + r.stderr)
    .split("\n")
    .filter((l) => l.trim())
    .slice(-n);

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      booleans: ["draft", "ignore-approval"],
      strings: ["preset"],
    });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const target = parsed.positional[0];
  if (!target) {
    console.error(
      "Usage: node build.mjs <project-dir> [--draft] [--ignore-approval] [--preset volt|ember|ice|grape]",
    );
    process.exit(2);
  }
  const dir = path.resolve(target);
  if (!existsSync(path.join(dir, "video.json"))) {
    console.error(`No video.json in ${dir}.`);
    process.exit(2);
  }
  const steps = buildSteps(dir, {
    draft: parsed.flags.draft,
    ignoreApproval: parsed.flags["ignore-approval"],
    preset: parsed.flags.preset,
  });
  const lines = [];
  for (const s of steps) {
    const r = run("node", [path.join(here, s.script), ...s.args], { timeoutMs: 1_800_000 });
    if (r.error || r.status !== 0) {
      lines.push(`FAILED at ${s.id}:`, ...lastLines(r, 20));
      console.error(
        capLines(lines, `Fix this, then run build.mjs again (${s.id} is where it stopped).`),
      );
      process.exit(1);
    }
    const tail = lastLines(r, s.id === "render" ? 3 : 1);
    lines.push(`${s.id}: ok${tail.length ? ` - ${tail.join(" | ")}` : ""}`);
  }
  console.log(capLines(lines, ""));
}

if (isEntry(import.meta.url)) main();
