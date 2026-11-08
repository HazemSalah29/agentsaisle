// Optional stage: look inside one component. Parses the JS/TS/JSX files of one folder as TEXT and writes the
// functions, React components, Next.js routes and hooks it finds, with what each one calls, renders and fetches,
// whether a call sits inside a loop or a branch, and where every imported name comes from. It never runs or
// imports project code and never touches the network. Same input, same output.
import { mkdirSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, listFiles, parseArgs, parseYaml, readText } from "./_lib.mjs";

import { analyzeSources, deriveVia } from "./_code-analyze.mjs";

export { analyzeSources, deriveVia };

const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const NOT_SOURCE =
  /(^|\/)(__tests__|__mocks__|tests?|specs?|e2e|\.storybook|stories)(\/|$)|\.(test|spec|stories)\.[cm]?[jt]sx?$|\.d\.ts$/;

const posix = (p) => p.split(path.sep).join("/");

/** Remove // and /* *\/ comments from JSON text without touching strings. */
function stripJsonComments(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
    } else out += c;
  }
  return out;
}

/** One tsconfig.json (comments and trailing commas allowed), following a relative "extends". */
function loadTsconfig(file, depth = 0) {
  let text;
  try {
    text = readText(file);
  } catch {
    return null;
  }
  if (text === null) return null;
  let json;
  try {
    json = JSON.parse(stripJsonComments(text).replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return null;
  }
  const dir = path.dirname(file);
  let parent = null;
  if (typeof json.extends === "string" && json.extends.startsWith(".") && depth < 5) {
    const ref = path.resolve(dir, json.extends);
    parent = loadTsconfig(ref.endsWith(".json") ? ref : `${ref}.json`, depth + 1);
  }
  const co = json.compilerOptions ?? {};
  const baseUrl = co.baseUrl ? path.resolve(dir, co.baseUrl) : (parent?.baseUrl ?? null);
  const paths = new Map(parent?.paths ?? []);
  // targets are relative to baseUrl when it is set, otherwise to the file that declares the paths
  for (const [pat, targets] of Object.entries(co.paths ?? {}))
    paths.set(
      pat,
      targets.filter((t) => typeof t === "string").map((t) => path.resolve(baseUrl ?? dir, t)),
    );
  return { baseUrl, paths };
}

/** Alias rules from the tsconfig.json closest to `dir` (walking up to `root`), as { prefix, dirs } relative to root. */
export function readAliases(root, dir) {
  const top = path.resolve(root);
  let cur = path.resolve(root, dir);
  for (;;) {
    const cfg = loadTsconfig(path.join(cur, "tsconfig.json"));
    if (cfg) {
      const out = [];
      for (const [pat, targets] of cfg.paths) {
        if (!pat.endsWith("*")) continue;
        const dirs = targets
          .filter((t) => t.endsWith("*") || t.endsWith(`${path.sep}*`))
          .map((t) => posix(path.relative(top, t.slice(0, -1))) || ".");
        if (dirs.length) out.push({ prefix: pat.slice(0, -1), dirs });
      }
      return out;
    }
    if (cur === top || path.dirname(cur) === cur) return [];
    cur = path.dirname(cur);
  }
}

/** Workspace packages (name -> folder) from package.json "workspaces" or pnpm-workspace.yaml, as alias rules. */
export function readWorkspaceAliases(root) {
  const top = path.resolve(root);
  const patterns = [];
  try {
    const pkg = JSON.parse(readText(path.join(top, "package.json")) ?? "{}");
    const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : (pkg.workspaces?.packages ?? []);
    patterns.push(...ws);
  } catch {
    // no package.json
  }
  try {
    const y = parseYaml(readText(path.join(top, "pnpm-workspace.yaml")) ?? "");
    if (Array.isArray(y?.packages)) patterns.push(...y.packages);
  } catch {
    // no pnpm-workspace.yaml
  }
  const dirs = new Set();
  for (const raw of patterns) {
    const pat = String(raw)
      .replace(/^\.\//, "")
      .replace(/\/\*\*$/, "/*");
    if (pat.startsWith("!")) continue;
    if (pat.endsWith("/*")) {
      const base = path.join(top, pat.slice(0, -2));
      try {
        for (const e of readdirSync(base, { withFileTypes: true }))
          if (e.isDirectory() && !e.isSymbolicLink() && e.name !== "node_modules")
            dirs.add(posix(path.relative(top, path.join(base, e.name))));
      } catch {
        // pattern points at nothing
      }
    } else if (!pat.includes("*")) dirs.add(pat);
  }
  const out = [];
  for (const d of [...dirs].sort()) {
    try {
      const name = JSON.parse(readText(path.join(top, d, "package.json")) ?? "{}").name;
      if (typeof name === "string" && name) out.push({ prefix: `${name}/`, dirs: [d] });
    } catch {
      // a folder without a readable package.json is not a package
    }
  }
  return out;
}

const MAX_VISITED = 20000;
const MAX_SOURCES = 10000;

function main() {
  const { flags } = parseArgs(process.argv.slice(2), {
    strings: ["root", "dir", "out", "max-symbols", "focus", "depth", "attach", "model"],
  });
  const root = path.resolve(flags.root ?? ".");
  const out = flags.out ?? (flags.attach ? null : "docs/architecture.detail.json");
  const focusEntries = flags.focus
    ? String(flags.focus)
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
    : [];
  const depth = Math.min(8, Math.max(1, Number(flags.depth ?? 4) || 4));
  if (flags.attach && !flags.model) {
    console.error("--attach needs --model <file>.");
    process.exit(2);
  }
  // --attach web=apps/web,api=packages/trpc: one node per folder; --attach web: every symbol on one node
  const mapping = flags.attach
    ? String(flags.attach)
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => (p.includes("=") ? p.split(/=(.*)/s).slice(0, 2) : [p, null]))
        .map(([node, dir]) => ({
          node,
          dir: dir ? posix(path.normalize(dir)).replace(/\/$/, "") : null,
        }))
    : [];
  if (mapping.length > 1 && mapping.some((m) => !m.dir)) {
    console.error("--attach with several nodes needs node=folder for each.");
    process.exit(2);
  }
  if (mapping.some((m) => m.dir)) {
    const extra = mapping.map((m) => m.dir).filter(Boolean);
    flags.dir = [...new Set([...(flags.dir ? String(flags.dir).split(",") : []), ...extra])].join(
      ",",
    );
  }
  const dirs = String(flags.dir ?? ".")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  const maxSymbols = Math.min(200, Math.max(1, Number(flags["max-symbols"] ?? 40) || 40));
  const realRoot = realpathSync(root);
  const sources = {};
  const scopes = [];
  const notes = [];
  let visitedTruncated = false;
  let skippedBig = 0;
  for (const dir of dirs) {
    const scopeAbs = path.resolve(root, dir);
    const realScope = realpathSync(scopeAbs);
    if (realScope !== realRoot && !realScope.startsWith(realRoot + path.sep)) {
      console.error("--dir must be inside --root.");
      process.exit(2);
    }
    const scopeRel = posix(path.relative(root, scopeAbs)) || ".";
    scopes.push(scopeRel);
    const { files, stats } = listFiles(
      scopeAbs,
      (name, rel) => SOURCE.test(name) && !NOT_SOURCE.test(rel),
      MAX_VISITED,
    );
    if (stats.truncated) visitedTruncated = true;
    for (const rel of files) {
      const key = posix(path.join(scopeRel === "." ? "" : scopeRel, rel));
      if (key in sources) continue;
      if (Object.keys(sources).length >= MAX_SOURCES) {
        visitedTruncated = true;
        break;
      }
      const text = readText(path.join(scopeAbs, rel));
      if (text === null) skippedBig++;
      else sources[key] = text;
    }
  }
  const aliases = [];
  for (const dir of dirs) aliases.push(...readAliases(root, dir));
  aliases.push(...readWorkspaceAliases(root));
  // the longest prefix wins; duplicates dropped
  const seen = new Set();
  const rules = aliases
    .filter((a) => {
      const k = `${a.prefix}|${a.dirs.join(",")}`;
      return seen.has(k) ? false : (seen.add(k), true);
    })
    .sort((a, b) => b.prefix.length - a.prefix.length || (a.prefix < b.prefix ? -1 : 1));
  const result = analyzeSources(sources, {
    aliases: rules,
    maxSymbols,
    scope: scopes.join(", "),
    focus: focusEntries.length ? { entries: focusEntries, depth } : null,
    only: mapping.some((m) => m.dir) ? mapping.map((m) => m.dir) : null,
    perFile: mapping.some((m) => m.dir),
  });
  if (focusEntries.length && result.symbolsKept === 0) {
    console.error(`Nothing to focus on: no symbol or file matches ${focusEntries.join(", ")}.`);
    console.error("Use a file path relative to --root, or <file>#<name>.");
    process.exit(1);
  }
  if (out) {
    mkdirSync(path.dirname(path.resolve(root, out)), { recursive: true });
    writeFileSync(path.resolve(root, out), `${JSON.stringify(result, null, 2)}\n`);
  }
  let attachedTo = "";
  if (mapping.length) {
    const modelFile = path.resolve(flags.model);
    const model = JSON.parse(readText(modelFile) ?? "null");
    const attached = [];
    for (const m of mapping) {
      const node = model?.nodes?.find((n) => n.id === m.node);
      if (!node) {
        console.error(`--attach: "${m.node}" is not a node of ${flags.model}.`);
        process.exit(2);
      }
      const inDir = (file) =>
        !m.dir || m.dir === "." || file === m.dir || file.startsWith(`${m.dir}/`);
      const symbols = result.symbols.filter((x) => inDir(x.file));
      // a reference to a symbol that belongs to no node (or was not kept) is dropped, so the model never dangles
      const known = new Set(
        mapping.flatMap((mm) =>
          result.symbols
            .filter(
              (x) =>
                !mm.dir || mm.dir === "." || x.file === mm.dir || x.file.startsWith(`${mm.dir}/`),
            )
            .map((x) => x.id),
        ),
      );
      const clean = (list) =>
        list.map((e) => {
          if (!e.to || known.has(e.to)) return e;
          const rest = { ...e };
          delete rest.to;
          return rest;
        });
      const found = m.dir
        ? Object.entries(result.foundPerFile ?? {})
            .filter(([f]) => inDir(f))
            .reduce((n, [, c]) => n + c, 0)
        : result.symbolsFound;
      node.detail = {
        scope: m.dir ?? result.scope,
        files: Object.keys(sources).filter(inDir).length,
        symbolsFound: found,
        symbolsKept: symbols.length,
        truncated: found > symbols.length,
        ...(result.focus ? { focus: result.focus } : {}),
        symbols: symbols.map((x) => ({
          ...x,
          calls: x.calls.filter((e) => known.has(e.to)),
          renders: clean(x.renders),
          fetches: clean(x.fetches),
          rpc: clean(x.rpc),
          calledBy: x.calledBy.filter((id) => known.has(id)),
        })),
      };
      attached.push(`${node.id} ${symbols.length}`);
    }
    model.version = 3;
    for (const e of model.edges) delete e.via;
    for (const [id, via] of deriveVia(model)) model.edges.find((e) => e.id === id).via = via;
    writeFileSync(modelFile, `${JSON.stringify(model, null, 2)}\n`);
    const linked = model.edges.filter((e) => e.via?.length).length;
    attachedTo = `Attached symbols to ${attached.join(", ")} in ${flags.model}; ${linked} connection(s) now list the calls that implement them.`;
  }
  const kinds = {};
  for (const s of result.symbols) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
  const lines = [
    `Scope ${result.scope}: parsed ${result.parsed} of ${result.files} files; found ${result.symbolsFound} symbols, kept ${result.symbolsKept}${result.truncated ? " (capped; raise --max-symbols to see more)" : ""}.`,
    `Kinds: ${Object.entries(kinds)
      .sort()
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}.`,
    ...result.symbols
      .slice()
      .sort((a, b) => b.calledBy.length - a.calledBy.length || (a.id < b.id ? -1 : 1))
      .slice(0, 12)
      .map(
        (s) =>
          `${s.kind.padEnd(9)} ${s.name} (${s.file}:${s.line}) called by ${s.calledBy.length}, calls ${s.calls.length}` +
          (s.loops ? `, ${s.loops} loop(s)` : ""),
      ),
  ];
  if (visitedTruncated)
    notes.push(
      `stopped at ${MAX_VISITED.toLocaleString("en-US")} files or ${MAX_SOURCES.toLocaleString("en-US")} sources`,
    );
  if (skippedBig) notes.push(`${skippedBig} file(s) over 2 MB skipped`);
  if (result.failed.length) notes.push(`${result.failed.length} file(s) could not be parsed`);
  console.log(
    capLines(
      lines,
      [attachedTo, notes.join("; ") || (out ? `Detail written to ${out}` : "")]
        .filter(Boolean)
        .join("\n"),
    ),
  );
}

if (isEntry(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
}
