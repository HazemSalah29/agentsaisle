// Shared helpers for the arabic-rtl scripts: file walking, a string-literal lexer, argument parsing and
// output capping. Read-only; nothing here touches the network or runs project code.
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_LINES = 40;
export const SOURCE_EXTS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".vercel",
  ".agent-aisle",
  ".claude",
  ".agents",
]);

/** True when `file` sits in another skill's kit folder (src/components/kit). */
const inKit = (rel) => /(^|\/)components\/kit(\/|$)/.test(rel.split(path.sep).join("/"));

/**
 * Design-kit folders (src/components/kit) under `root` that a default run skips. They are another
 * skill's component kit, but once installed they are the project's own copy and usually hold most of
 * its layout classes, so the scripts say when they stepped over one.
 */
export function findKitDirs(root) {
  if (statSync(root).isFile()) return [];
  const found = [];
  const visit = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.isSymbolicLink() || SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (inKit(path.relative(root, full))) found.push(path.relative(root, full) || e.name);
      else visit(full);
    }
  };
  visit(root);
  return found;
}

/** The one-line note printed when a kit folder was skipped. `what` is "classes", "strings" ... */
export const kitNote = (dirs, extra = "") =>
  `NOTE: skipped ${dirs.join(", ")} (a design kit folder${dirs.length > 1 ? "s" : ""})${extra}. It is your project's copy now: run again with --include-kit to include it.`;

/** Walk `root` and return files (absolute) with one of `exts`. Skips build output and kit folders. */
export function walk(root, { exts = SOURCE_EXTS, includeKit = false } = {}) {
  const out = [];
  const visit = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        if (!includeKit && inKit(path.relative(root, full))) continue;
        visit(full);
      } else if (exts.includes(path.extname(e.name))) out.push(full);
    }
  };
  if (statSync(root).isFile()) return [root];
  visit(root);
  return out.sort();
}

/**
 * Find string literals in JS/TS source. Returns segments of static text:
 * { start, end, text, glueStart, glueEnd }. Template literals yield one segment per static part, and
 * glue flags say that an interpolation touches that edge, so a token there is incomplete.
 * Comments are skipped. Regex literals are not understood; a stray quote there is a known limit.
 */
export function stringSegments(src) {
  const segs = [];
  let i = 0;
  const n = src.length;
  const readString = (q) => {
    const start = ++i;
    while (i < n && src[i] !== q && src[i] !== "\n") i += src[i] === "\\" ? 2 : 1;
    segs.push({ start, end: i, text: src.slice(start, i), glueStart: false, glueEnd: false });
    i++;
  };
  const readTemplate = () => {
    i++; // past the opening backtick
    let start = i;
    let glueStart = false;
    while (i < n) {
      const c = src[i];
      if (c === "\\") i += 2;
      else if (c === "`") {
        segs.push({ start, end: i, text: src.slice(start, i), glueStart, glueEnd: false });
        i++;
        return;
      } else if (c === "$" && src[i + 1] === "{") {
        segs.push({ start, end: i, text: src.slice(start, i), glueStart, glueEnd: true });
        i += 2;
        scanCode("}");
        start = i;
        glueStart = true;
      } else i++;
    }
  };
  // Scan code until the closing brace of an interpolation (when `stop` is "}") or end of file.
  const scanCode = (stop) => {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      const d = src[i + 1];
      if (c === "/" && d === "/") while (i < n && src[i] !== "\n") i++;
      else if (c === "/" && d === "*") {
        const e = src.indexOf("*/", i + 2);
        i = e < 0 ? n : e + 2;
      } else if (c === '"' || c === "'") readString(c);
      else if (c === "`") readTemplate();
      else if (c === "{") {
        depth++;
        i++;
      } else if (c === "}") {
        if (stop === "}" && depth === 0) {
          i++;
          return;
        }
        depth--;
        i++;
      } else i++;
    }
  };
  scanCode(null);
  return segs;
}

/** 1-based line number of an offset. `lineStarts` comes from lineIndex(). */
export function lineIndex(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** Tokens (with offsets) of a segment that are complete, i.e. not cut off by an interpolation. */
export function segmentTokens(seg) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(seg.text))) {
    const at = m.index;
    if (at === 0 && seg.glueStart) continue;
    if (at + m[0].length === seg.text.length && seg.glueEnd) continue;
    out.push({ token: m[0], offset: seg.start + at });
  }
  return out;
}

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

/** Cap printed lines at MAX_LINES (summary line included) and say how many were left out. */
export function capLines(lines, summary, max = MAX_LINES) {
  // The summary may be several lines (a count plus a note); they all count towards the cap.
  const room = max - summary.split("\n").length;
  if (lines.length <= room) return [...lines, summary].join("\n");
  const shown = lines.slice(0, room - 1);
  return [...shown, `... ${lines.length - shown.length} more (use --json for all)`, summary].join(
    "\n",
  );
}

/** True when this module is the process entry point, even through a symlinked folder. */
export const isEntry = (metaUrl) =>
  Boolean(process.argv[1]) && metaUrl === pathToFileURL(realpathSync(process.argv[1])).href;

export const readText = (file) => readFileSync(file, "utf8");

/** Read the project's Tailwind version range from package.json; null when unknown. */
export function tailwindVersion(root) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const range = { ...pkg.devDependencies, ...pkg.dependencies }.tailwindcss;
    const m = range && /(\d+)\.(\d+)/.exec(range);
    return m ? [Number(m[1]), Number(m[2])] : null;
  } catch {
    return null;
  }
}
