#!/usr/bin/env node
// Checks each Next.js App Router route's first-load JavaScript (gzip) against a budget.
// Reads the build output in .next/ as data. It never runs the build or evaluates any file from it.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

export const DEFAULT_BUDGET_KB = 180;

/** The JSON object inside `globalThis.__RSC_MANIFEST["/page"] = {...};`, or null. Parsed, never evaluated. */
export function parseClientReferenceManifest(text) {
  const match = /=\s*(\{[\s\S]*\})\s*;?\s*$/.exec(text);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/** Chunk files a route's own layouts and page add. Framework built-ins (like the global error page) are skipped. */
export function routeEntryFiles(manifest) {
  const entries =
    manifest && typeof manifest.entryJSFiles === "object" && manifest.entryJSFiles
      ? manifest.entryJSFiles
      : {};
  return Object.entries(entries)
    .filter(([key]) => !key.includes("/next/dist/client/components/builtin/"))
    .flatMap(([, files]) => (Array.isArray(files) ? files : []));
}

/** Unique JS files loaded on the first visit: the shared runtime plus the route's own chunks. */
export function firstLoadFiles(buildManifest, entryFiles) {
  const shared = Array.isArray(buildManifest?.rootMainFiles) ? buildManifest.rootMainFiles : [];
  return [...new Set([...shared, ...entryFiles])].filter((f) => f.endsWith(".js"));
}

export function gzipBytes(buffer) {
  return gzipSync(buffer, { level: 9 }).length;
}

/** "/skills/[name]/page" is a page route; "/robots.txt/route" and others are not. Returns the URL path or null. */
export function pageRouteOf(manifestKey) {
  return manifestKey.endsWith("/page") ? manifestKey.slice(0, -"/page".length) || "/" : null;
}

/**
 * First-load size for every App Router page route found in `nextDir`.
 * `io` is injectable so tests can use an in-memory build output.
 */
export function measureRoutes(nextDir, io = { exists: existsSync, read: (p) => readFileSync(p) }) {
  const readJson = (rel) => JSON.parse(io.read(path.join(nextDir, rel)).toString("utf8"));
  if (
    !io.exists(path.join(nextDir, "build-manifest.json")) ||
    !io.exists(path.join(nextDir, "app-path-routes-manifest.json"))
  ) {
    return {
      error: `No App Router build output in ${nextDir}. Run the production build first (next build).`,
    };
  }
  const buildManifest = readJson("build-manifest.json");
  const routeKeys = Object.keys(readJson("app-path-routes-manifest.json"));
  const sizeCache = new Map();
  const sizeOf = (file) => {
    if (!sizeCache.has(file)) {
      const full = path.join(nextDir, file);
      sizeCache.set(file, io.exists(full) ? gzipBytes(io.read(full)) : 0);
    }
    return sizeCache.get(file);
  };

  const routes = [];
  for (const key of routeKeys) {
    const route = pageRouteOf(key);
    if (!route) continue;
    const manifestFile = path.join(
      "server",
      "app",
      key.replace(/^\//, "") + "_client-reference-manifest.js",
    );
    if (!io.exists(path.join(nextDir, manifestFile))) continue;
    const manifest = parseClientReferenceManifest(
      io.read(path.join(nextDir, manifestFile)).toString("utf8"),
    );
    if (!manifest) continue;
    const files = firstLoadFiles(buildManifest, routeEntryFiles(manifest));
    routes.push({
      route,
      files: files.length,
      bytes: files.reduce((sum, f) => sum + sizeOf(f), 0),
    });
  }
  return { routes: routes.sort((a, b) => b.bytes - a.bytes) };
}

/** Compare measured routes with the budget. `config` is the parsed perf.config.json (all fields optional). */
export function evaluate(routes, config = {}) {
  const budgetKb = typeof config.budgetKb === "number" ? config.budgetKb : DEFAULT_BUDGET_KB;
  const overrides = config.routes && typeof config.routes === "object" ? config.routes : {};
  const ignored = new Set(Array.isArray(config.ignore) ? config.ignore : []);
  const rows = routes
    .filter((r) => !ignored.has(r.route))
    .map((r) => {
      const limitKb = typeof overrides[r.route] === "number" ? overrides[r.route] : budgetKb;
      const kb = r.bytes / 1024;
      return { route: r.route, kb, limitKb, over: kb > limitKb };
    });
  return { rows, failing: rows.filter((r) => r.over), budgetKb };
}

const fmt = (kb) => `${kb.toFixed(1)} kB`;

/** The text to print: failures only unless `all`, never more than `maxLines` lines. */
export function report({ rows, failing, budgetKb }, { all = false, maxLines = 40 } = {}) {
  const lines = [];
  if (failing.length === 0) {
    const biggest = rows[0];
    lines.push(
      `perf-budget: ${rows.length} routes within budget (${budgetKb} kB gzip)${biggest ? `; largest ${biggest.route} ${fmt(biggest.kb)}` : ""}`,
    );
  } else {
    lines.push(`perf-budget: ${failing.length} of ${rows.length} routes over budget`);
    for (const r of failing)
      lines.push(`  ${r.route}  ${fmt(r.kb)} > ${fmt(r.limitKb)}  (+${fmt(r.kb - r.limitKb)})`);
  }
  if (all)
    for (const r of rows)
      lines.push(`  ${r.over ? "over" : "ok  "} ${r.route}  ${fmt(r.kb)} / ${fmt(r.limitKb)}`);
  if (lines.length > maxLines)
    return [...lines.slice(0, maxLines - 1), `  ... ${lines.length - maxLines + 1} more`].join(
      "\n",
    );
  return lines.join("\n");
}

export function loadConfig(cwd, io = { exists: existsSync, read: (p) => readFileSync(p, "utf8") }) {
  const file = path.join(cwd, "perf.config.json");
  if (!io.exists(file)) return {};
  try {
    return JSON.parse(io.read(file));
  } catch {
    return { _invalid: true };
  }
}

function main(argv) {
  const opt = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const cwd = path.resolve(opt("--cwd") ?? process.cwd());
  const config = loadConfig(cwd);
  if (config._invalid) {
    console.log("perf-budget: perf.config.json is not valid JSON.");
    process.exit(1);
  }
  const measured = measureRoutes(path.resolve(cwd, opt("--next-dir") ?? ".next"));
  if (measured.error) {
    console.log(`perf-budget: ${measured.error}`);
    process.exit(1);
  }
  const result = evaluate(measured.routes, config);
  console.log(report(result, { all: argv.includes("--all") }));
  process.exit(result.failing.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main(process.argv.slice(2));
