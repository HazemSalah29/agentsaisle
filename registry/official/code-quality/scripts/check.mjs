#!/usr/bin/env node
// Runs the project's own lint, type check and tests, and prints only what failed.
// Reads package.json and runs `<package manager> run <script>`; it never installs or fetches anything.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_LINES = 40;

/** Which package manager the project uses, from its lockfile or the packageManager field. */
export function detectPackageManager(files, pkg = {}) {
  const has = (name) => files.includes(name);
  if (has("pnpm-lock.yaml")) return "pnpm";
  if (has("yarn.lock")) return "yarn";
  if (has("bun.lockb") || has("bun.lock")) return "bun";
  if (has("package-lock.json")) return "npm";
  const declared = typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : "";
  return ["pnpm", "yarn", "bun", "npm"].includes(declared) ? declared : "npm";
}

const PLACEHOLDER_TEST = /no test specified/i;

/** The scripts worth running, in the order they should run: lint, type check, tests. */
export function pickScripts(pkg) {
  const scripts = pkg && typeof pkg.scripts === "object" && pkg.scripts ? pkg.scripts : {};
  const picked = [];
  if (scripts.lint) picked.push("lint");
  const typecheck = ["typecheck", "type-check", "tsc"].find((name) => scripts[name]);
  if (typecheck) picked.push(typecheck);
  if (scripts.test && !PLACEHOLDER_TEST.test(scripts.test)) picked.push("test");
  return picked;
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

/** Strip colors and blank-line runs, then keep at most `maxLines`: the start and the end (where summaries live). */
export function trimOutput(text, maxLines) {
  const lines = text
    .replace(ANSI, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l, i, all) => l !== "" || (i > 0 && all[i - 1] !== ""));
  while (lines.length && lines[0] === "") lines.shift();
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  if (lines.length <= maxLines) return lines;
  const head = Math.max(1, Math.ceil(maxLines * 0.6));
  const tail = Math.max(1, maxLines - head - 1);
  return [
    ...lines.slice(0, head),
    `... ${lines.length - head - tail} lines omitted ...`,
    ...lines.slice(-tail),
  ];
}

/** Turn results into the text to print. Failures only; the whole report fits in `maxLines`. */
export function summarize(results, maxLines = MAX_LINES) {
  const failed = results.filter((r) => r.code !== 0);
  if (failed.length === 0) {
    return { ok: true, text: `check: passed (${results.map((r) => r.name).join(", ")})` };
  }
  const perFailure = Math.max(3, Math.floor((maxLines - failed.length * 2) / failed.length));
  const out = [];
  for (const r of failed) {
    out.push(`check: ${r.name} ${r.timedOut ? "timed out" : `failed (exit ${r.code})`}`);
    out.push(...trimOutput(r.output, perFailure));
  }
  const passed = results.filter((r) => r.code === 0).map((r) => r.name);
  if (passed.length) out.push(`passed: ${passed.join(", ")}`);
  return { ok: false, text: out.slice(0, maxLines).join("\n") };
}

function runScript(pm, name, { cwd, timeoutMs }) {
  const args = pm === "npm" ? ["run", name, "--silent"] : ["run", name];
  const res = spawnSync(pm, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === "win32",
  });
  const timedOut = res.error?.code === "ETIMEDOUT";
  return {
    name,
    code: res.status ?? 1,
    timedOut,
    output: `${res.stdout ?? ""}\n${res.stderr ?? ""}${res.error && !timedOut ? `\n${res.error.message}` : ""}`,
  };
}

/** Run the checks. `run` is injectable so tests never start a real process. */
export function runChecks({ cwd, only, timeoutMs = 300_000, run = runScript } = {}) {
  const pkgFile = path.join(cwd, "package.json");
  if (!existsSync(pkgFile))
    return {
      ok: true,
      empty: true,
      text: "check: no package.json here, so there is nothing to run.",
    };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
  } catch {
    return { ok: false, text: "check: package.json is not valid JSON." };
  }
  let names = pickScripts(pkg);
  if (only?.length) names = names.filter((n) => only.includes(n));
  if (names.length === 0) {
    return {
      ok: true,
      empty: true,
      text: "check: no lint, typecheck or test script found. Say so; do not report this as passing.",
    };
  }
  const pm = detectPackageManager(existsSync(cwd) ? listRoot(cwd) : [], pkg);
  return summarize(names.map((name) => run(pm, name, { cwd, timeoutMs })));
}

function listRoot(cwd) {
  return ["pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock", "package-lock.json"].filter((f) =>
    existsSync(path.join(cwd, f)),
  );
}

function main(argv) {
  const opt = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const result = runChecks({
    cwd: path.resolve(opt("--cwd") ?? process.cwd()),
    only: opt("--only")?.split(",").filter(Boolean),
    timeoutMs: Number(opt("--timeout") ?? 300) * 1000,
  });
  console.log(result.text);
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main(process.argv.slice(2));
