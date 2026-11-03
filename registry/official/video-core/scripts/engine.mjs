#!/usr/bin/env node
// The Remotion engine install: where it lives, whether it is ready, and how to set it up. The engine is a small npm
// project (assets/remotion/package.json, versions pinned) that the user installs once; render.mjs refreshes its src/
// from this skill before every render, so updating the skill updates the look. Nothing is installed or downloaded
// by this script: `setup` writes package.json and prints the one command the user runs.
// Usage: node engine.mjs status | setup [--dir <engine-dir>]
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";

export const LICENCE_NOTE =
  "Remotion is free for individuals and companies of up to 3 people; larger companies need a Remotion company licence (remotion.dev/license).";

const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));
const toolsFile = (home) => path.join(home, ".aisle-video", "tools.json");

/** The tools.json settings, or {}. */
export function tools(home = os.homedir()) {
  try {
    return readJson(toolsFile(home));
  } catch {
    return {};
  }
}

/** The engine folder: --dir, then tools.json "remotion", then ~/.aisle-video/remotion. */
export function engineDir({ explicit, home = os.homedir() } = {}) {
  if (explicit) return path.resolve(explicit);
  const t = tools(home).remotion;
  if (typeof t === "string" && path.isAbsolute(t)) return t;
  return path.join(home, ".aisle-video", "remotion");
}

/** The pinned package.json the engine is installed from. */
export const pinned = () => readJson(path.join(skillDir(), "assets", "remotion", "package.json"));

/**
 * { ok, cli, problems, version } for an engine folder: @remotion/cli and remotion installed at the pinned version.
 * Pure apart from reading package.json files.
 */
export function engineStatus(dir) {
  const want = pinned().dependencies.remotion;
  const problems = [];
  const pj = (name) => {
    const f = path.join(dir, "node_modules", ...name.split("/"), "package.json");
    return existsSync(f) ? readJson(f) : null;
  };
  const cli = pj("@remotion/cli");
  const core = pj("remotion");
  if (!cli || !core) problems.push(`Remotion is not installed in ${dir}.`);
  else {
    if (core.version !== want || cli.version !== want)
      problems.push(
        `Remotion ${core.version} is installed; this skill is built for ${want}. Run setup again.`,
      );
    for (const dep of Object.keys(pinned().dependencies))
      if (!pj(dep)) problems.push(`${dep} is missing from ${dir}; run setup again.`);
  }
  const bin = cli
    ? path.join(
        dir,
        "node_modules",
        "@remotion",
        "cli",
        typeof cli.bin === "string" ? cli.bin : (cli.bin?.remotion ?? "remotion-cli.js"),
      )
    : null;
  return { ok: problems.length === 0, cli: bin, problems, version: core?.version ?? null };
}

/** Copies this skill's engine source into the engine folder, replacing the old src/. */
export function syncSource(dir) {
  const src = path.join(dir, "src");
  rmSync(src, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(path.join(skillDir(), "assets", "remotion", "src"), src, { recursive: true });
}

/** The lines that set the engine up, for the user to run (never run here). */
export function setupLines(dir) {
  return [
    `cd "${dir}"`,
    "npm install --no-audit --no-fund",
    `npx remotion@${pinned().dependencies.remotion} browser ensure`,
  ];
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { strings: ["dir"] });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const cmd = parsed.positional[0] ?? "status";
  const dir = engineDir({ explicit: parsed.flags.dir });
  if (cmd === "setup") {
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "package.json");
    writeFileSync(file, `${JSON.stringify(pinned(), null, 2)}\n`);
    syncSource(dir);
    console.log(
      capLines(
        [
          `Wrote ${file} (Remotion ${pinned().dependencies.remotion}, pinned).`,
          "Ask the user to run these once (about 250 MB, plus a headless browser of about 100 MB):",
          ...setupLines(dir).map((l) => `  ${l}`),
          LICENCE_NOTE,
        ],
        "Then run: node engine.mjs status",
      ),
    );
    return;
  }
  if (cmd !== "status") {
    console.error("Usage: node engine.mjs status | setup [--dir <engine-dir>]");
    process.exit(2);
  }
  const s = engineStatus(dir);
  if (s.ok) console.log(`Remotion engine ready: ${s.version} in ${dir}. ${LICENCE_NOTE}`);
  else {
    console.log(
      capLines([...s.problems, "Set it up with: node engine.mjs setup"], "Engine not ready."),
    );
    process.exit(1);
  }
}

if (isEntry(import.meta.url)) main();
