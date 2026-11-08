#!/usr/bin/env node
// /video reel: sets up the reel studio folder and checks the tools a reel needs. It installs nothing.
//   node studio.mjs init [folder]    copy assets/studio into the folder; never overwrites a file (default: current folder)
//   node studio.mjs doctor           one line per missing tool, or "all ready"; prints what to install, never installs
// Writes only inside the folder it is given. Runs only fixed `--version` style probes of known programs.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, copyFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE = path.join(here, "..", "assets", "studio");

/** Files under the template as relative paths, sorted; symlinks are skipped. */
export function templateFiles(root = TEMPLATE) {
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

/** Copy the template into `target`. Returns { created, kept } as relative paths. */
export function initStudio(target, root = TEMPLATE) {
  const created = [];
  const kept = [];
  mkdirSync(target, { recursive: true });
  for (const rel of templateFiles(root)) {
    const to = path.join(target, ...rel.split("/"));
    if (existsSync(to)) {
      kept.push(rel);
      continue;
    }
    mkdirSync(path.dirname(to), { recursive: true });
    copyFileSync(path.join(root, ...rel.split("/")), to);
    created.push(rel);
  }
  return { created, kept };
}

const ok = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "ignore", timeout: 15000 });
  return !r.error && r.status === 0;
};

/** Each check is [name, what to do when missing, probe]. */
export const CHECKS = [
  [
    "node",
    "install Node 18 or newer from nodejs.org",
    () => Number(process.versions.node.split(".")[0]) >= 18,
  ],
  [
    "ffmpeg",
    "install ffmpeg (macOS: brew install ffmpeg; Windows: winget install ffmpeg)",
    () => ok("ffmpeg", ["-version"]) && ok("ffprobe", ["-version"]),
  ],
  ["python", "install Python 3 from python.org", () => ok("python3", ["-I", "-c", "pass"])],
  [
    "python-packages",
    "pip install numpy scipy pillow",
    () => ok("python3", ["-I", "-c", "import numpy, scipy, PIL"]),
  ],
  [
    "playwright",
    "npm i -g playwright (the reel uses your installed Chrome, not a download)",
    () => {
      const root = spawnSync("npm", ["root", "-g"], { encoding: "utf8", timeout: 15000 });
      return (
        !root.error && root.status === 0 && existsSync(path.join(root.stdout.trim(), "playwright"))
      );
    },
  ],
  [
    "chrome",
    "install Google Chrome",
    () =>
      [
        "/Applications/Google Chrome.app",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ].some((p) => existsSync(p)),
  ],
];

export function doctor(checks = CHECKS) {
  return checks.filter(([, , probe]) => !probe()).map(([name, fix]) => ({ name, fix }));
}

function main(argv) {
  const [cmd, arg] = argv;
  if (cmd === "init") {
    const target = path.resolve(arg || ".");
    const { created, kept } = initStudio(target);
    console.log(`studio: ${created.length} created, ${kept.length} kept in ${target}`);
    return 0;
  }
  if (cmd === "doctor") {
    const missing = doctor();
    if (!missing.length) console.log("all ready");
    for (const m of missing) console.log(`missing: ${m.name}: ${m.fix}`);
    return missing.length ? 1 : 0;
  }
  console.error("usage: node studio.mjs init [folder] | doctor");
  return 2;
}

const isEntry = (() => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isEntry) process.exitCode = main(process.argv.slice(2));
