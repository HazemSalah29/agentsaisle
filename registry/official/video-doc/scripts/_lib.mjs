// Shared helpers for the video-core scripts: argument parsing, output capping and the entry-point guard.
// Nothing here touches the network or runs project code.
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MAX_LINES = 40;

/** The skill's own folder, resolved through symlinks. */
export const skillDir = () =>
  path.resolve(path.dirname(realpathSync(fileURLToPath(import.meta.url))), "..");

/** Minimal flag parser: --flag, --key value, --key=value; everything else is positional. */
export function parseArgs(argv, { booleans = [], strings = [] } = {}) {
  const flags = {};
  const positional = [];
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const [name, inline] = a.slice(2).split(/=(.*)/s);
    if (booleans.includes(name)) flags[name] = true;
    else if (strings.includes(name)) flags[name] = inline ?? argv[++k];
    else throw new Error(`Unknown option --${name}`);
  }
  return { flags, positional };
}

/** Cap printed lines at MAX_LINES (summary included) and say how many were left out. */
export function capLines(lines, summary, max = MAX_LINES) {
  const room = max - summary.split("\n").length;
  if (lines.length <= room) return [...lines, summary].join("\n");
  const shown = lines.slice(0, room - 1);
  return [...shown, `... ${lines.length - shown.length} more`, summary].join("\n");
}

/** True when this module is the process entry point, even through a symlinked folder. */
export const isEntry = (metaUrl) =>
  Boolean(process.argv[1]) && metaUrl === pathToFileURL(realpathSync(process.argv[1])).href;

/** A relative path that stays inside `root`: no absolute paths, no "..", no drive letters. */
export function isInside(rel) {
  if (typeof rel !== "string" || !rel || path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel))
    return false;
  return !rel.split(/[\\/]/).includes("..");
}
