// Shared helpers for the arch-visualize scripts: file walking, a small YAML reader, argument parsing and
// output capping. Read-only; nothing here touches the network or runs project code.
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MAX_LINES = 40;
export const MAX_FILES = 2000;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".vercel",
  ".claude",
  ".agents",
  ".agent-aisle",
  "__pycache__",
  ".venv",
  "venv",
  "vendor",
]);

/** The skill's own folder, resolved through symlinks. */
export const skillDir = () =>
  path.resolve(path.dirname(realpathSync(fileURLToPath(import.meta.url))), "..");

/** Env files that hold only placeholders and are meant to be read (key names only). */
export const isExampleEnv = (name) => /^\.env(\.[\w-]+)?\.(example|sample|template)$/.test(name);

/** Files that may hold secret values. They are never opened, only counted by name. */
export const isSecretFile = (name) =>
  (/^\.env(\.|$)/.test(name) && !isExampleEnv(name)) ||
  /\.(pem|key|p12|pfx)$/.test(name) ||
  /^id_(rsa|dsa|ecdsa|ed25519)$/.test(name);

/**
 * List files under `root` whose base name `want(name)` accepts. Sorted, symlinks skipped, at most
 * MAX_FILES entries visited. Secret-named files are counted in `skippedSecret` and never returned.
 */
export function listFiles(root, want) {
  const found = [];
  const stats = { visited: 0, skippedSecret: 0, truncated: false };
  const visit = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      if (stats.visited >= MAX_FILES) {
        stats.truncated = true;
        return;
      }
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) visit(path.join(dir, e.name));
        continue;
      }
      stats.visited++;
      if (isSecretFile(e.name)) stats.skippedSecret++;
      else if (want(e.name))
        found.push(path.relative(root, path.join(dir, e.name)).split(path.sep).join("/"));
    }
  };
  visit(root);
  return { files: found, stats };
}

/** Read a text file; null when it is larger than MAX_FILE_BYTES. */
export function readText(file) {
  if (statSync(file).size > MAX_FILE_BYTES) return null;
  return readFileSync(file, "utf8");
}

/** 1-based number of the first line matching `re`, or 1. */
export function findLine(text, re) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  return 1;
}

/** Names (never values) of the variables an env example file declares, with their line numbers. */
export function envKeyNames(text) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (m) out.push({ key: m[1], line: i + 1 });
  });
  return out;
}

const unquote = (s) => {
  const t = s.trim();
  return /^(["']).*\1$/.test(t) && t.length >= 2 ? t.slice(1, -1) : t;
};

const stripComment = (s) => {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === "#" && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).trimEnd();
  }
  return s;
};

const scalar = (v) => {
  const t = v.trim();
  if (t.startsWith("[") && t.endsWith("]"))
    return t
      .slice(1, -1)
      .split(",")
      .map((x) => unquote(x))
      .filter(Boolean);
  return unquote(t);
};

/**
 * A small YAML reader for docker-compose-style files: nested maps, lists, inline lists, quoted
 * scalars and comments. No anchors, tags or multi-document files; block scalars are skipped.
 * Returns { data, lineOf(path) } where a path looks like "services.api.image".
 */
export function parseYaml(text) {
  const rows = text.split(/\r?\n/);
  const root = {};
  const lines = new Map();
  const frames = [{ indent: -1, node: root, path: "" }];
  let pending = null;
  const setKey = (frame, key, val, n, indent) => {
    const p = frame.path ? `${frame.path}.${key}` : key;
    lines.set(p, n + 1);
    if (val === "" || val === undefined) {
      frame.node[key] = null;
      pending = { parent: frame.node, key, indent, path: p };
    } else if (val === "|" || val === ">" || /^[|>][+-]?$/.test(val)) {
      frame.node[key] = "";
      return "block";
    } else frame.node[key] = scalar(val);
    return null;
  };
  for (let n = 0; n < rows.length; n++) {
    const raw = rows[n];
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const body = stripComment(raw.trim());
    if (!body) continue;
    const isDash = body === "-" || body.startsWith("- ");
    if (pending) {
      if (indent > pending.indent || (isDash && indent >= pending.indent)) {
        const container = isDash ? [] : {};
        pending.parent[pending.key] = container;
        frames.push({ indent, node: container, path: pending.path });
      }
      pending = null;
    }
    while (frames.length > 1 && frames[frames.length - 1].indent > indent) frames.pop();
    let frame = frames[frames.length - 1];
    if (isDash) {
      if (!Array.isArray(frame.node)) continue;
      let item = body.slice(1).trim();
      const idx = frame.node.length;
      const ipath = `${frame.path}[${idx}]`;
      const km = /^([^:\s][^:]*?):(?:\s+(.*))?$/.exec(item);
      if (km && !/^["']/.test(item)) {
        const obj = {};
        frame.node.push(obj);
        lines.set(ipath, n + 1);
        frame = { indent: indent + 2, node: obj, path: ipath };
        frames.push(frame);
        const r = setKey(frame, unquote(km[1]), km[2] ?? "", n, indent + 2);
        if (r === "block") n = skipBlock(rows, n, indent + 2);
      } else {
        frame.node.push(scalar(item));
        lines.set(ipath, n + 1);
      }
      continue;
    }
    const m = /^([^:\s][^:]*?):(?:\s+(.*))?$/.exec(body);
    if (!m || Array.isArray(frame.node)) continue;
    const r = setKey(frame, unquote(m[1]), m[2] ?? "", n, indent);
    if (r === "block") n = skipBlock(rows, n, indent);
  }
  return { data: root, lineOf: (p) => lines.get(p) ?? 1 };
}

function skipBlock(rows, n, indent) {
  let k = n;
  while (k + 1 < rows.length) {
    const next = rows[k + 1];
    if (next.trim() && next.length - next.trimStart().length <= indent) break;
    k++;
  }
  return k;
}

/**
 * Replace comments with spaces (newlines kept, so line numbers stay right) and leave strings alone.
 * Regex literals are not understood; a stray quote inside one is a known limit.
 */
export function maskComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
    } else if (c === "/" && d === "*") {
      const e = src.indexOf("*/", i + 2);
      const end = e < 0 ? n : e + 2;
      for (; i < end; i++) out += src[i] === "\n" ? "\n" : " ";
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && src[j] !== c && !(c !== "`" && src[j] === "\n")) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * The text between the bracket at `open` and its partner, with the index just after the partner.
 * Strings are skipped. Returns null when the brackets never balance.
 */
export function balanced(src, open) {
  const pairs = { "(": ")", "{": "}", "[": "]" };
  const close = pairs[src[open]];
  if (!close) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i++;
      while (i < src.length && src[i] !== c && !(c !== "`" && src[i] === "\n"))
        i += src[i] === "\\" ? 2 : 1;
    } else if (c === src[open]) depth++;
    else if (c === close && --depth === 0) return { text: src.slice(open + 1, i), end: i + 1 };
  }
  return null;
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
