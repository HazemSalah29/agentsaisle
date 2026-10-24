#!/usr/bin/env node
// Checks that a Next.js project sets the standard security headers.
// It reads next.config and middleware/proxy files as TEXT. It never imports or runs them.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CONFIG_FILES = [
  "next.config.ts",
  "next.config.mjs",
  "next.config.js",
  "next.config.cjs",
  "next.config.mts",
];
export const EXTRA_FILES = [
  "middleware.ts",
  "middleware.js",
  "proxy.ts",
  "proxy.js",
  "src/middleware.ts",
  "src/middleware.js",
  "src/proxy.ts",
  "src/proxy.js",
];

/** Each header a site should set, with the text that counts as setting it. */
export const REQUIRED = [
  { name: "Content-Security-Policy", re: /content-security-policy/i },
  { name: "X-Content-Type-Options", re: /x-content-type-options/i },
  { name: "Referrer-Policy", re: /referrer-policy/i },
  { name: "Permissions-Policy", re: /permissions-policy/i },
  { name: "Strict-Transport-Security", re: /strict-transport-security/i },
  // Clickjacking protection: the old header, or the CSP directive that replaces it.
  { name: "X-Frame-Options or frame-ancestors", re: /x-frame-options|frame-ancestors/i },
];

export function findFiles(cwd, exists = existsSync) {
  const config = CONFIG_FILES.find((f) => exists(path.join(cwd, f)));
  return { config, extra: EXTRA_FILES.filter((f) => exists(path.join(cwd, f))) };
}

/** Which required headers appear in the given source texts, plus advice about weak settings. */
export function analyze(sources, { ignore = [] } = {}) {
  const text = sources.join("\n");
  const skip = ignore.map((i) => i.toLowerCase());
  const missing = REQUIRED.filter(
    (h) => !skip.some((s) => h.name.toLowerCase().includes(s)) && !h.re.test(text),
  ).map((h) => h.name);
  const warnings = [];
  if (/unsafe-eval/.test(text))
    warnings.push("CSP allows 'unsafe-eval'. Remove it unless a dependency truly needs it.");
  if (/script-src[^;"`]*'unsafe-inline'/.test(text))
    warnings.push("CSP script-src allows 'unsafe-inline'. Prefer nonces or hashes.");
  if (!/poweredByHeader\s*:\s*false/.test(text))
    warnings.push("Set poweredByHeader: false to stop advertising the framework.");
  return { missing, warnings };
}

export function report({ file, missing, warnings, noConfig }) {
  if (noConfig)
    return "headers-check: no next.config file found here, so there is nothing to check.";
  const lines = [];
  if (missing.length === 0) lines.push(`headers-check: all security headers are set in ${file}`);
  else {
    lines.push(`headers-check: ${missing.length} missing in ${file}`);
    for (const m of missing) lines.push(`  missing ${m}`);
    lines.push(
      '  Add them in headers() in next.config, or in middleware/proxy, for source "/(.*)".',
    );
  }
  for (const w of warnings) lines.push(`  note: ${w}`);
  return lines.slice(0, 40).join("\n");
}

function main(argv) {
  const cwd = path.resolve(
    argv.includes("--cwd") ? argv[argv.indexOf("--cwd") + 1] : process.cwd(),
  );
  const ignore = argv.includes("--ignore") ? argv[argv.indexOf("--ignore") + 1].split(",") : [];
  const { config, extra } = findFiles(cwd);
  if (!config) {
    console.log(report({ noConfig: true }));
    process.exit(1);
  }
  const sources = [config, ...extra].map((f) => readFileSync(path.join(cwd, f), "utf8"));
  const result = analyze(sources, { ignore });
  console.log(report({ file: config, ...result }));
  process.exit(result.missing.length ? 1 : 0);
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
