#!/usr/bin/env node
// Runs the project's lint, type check and tests, plus the route JS budget when the web-performance
// skill is installed next to this one and a production build exists. Prints failures only.
// Self-contained on purpose: an installed skill can't depend on another skill being present.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MAX_LINES = 40;
const PLACEHOLDER_TEST = /no test specified/i;
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

export function detectPackageManager(files, pkg = {}) {
  if (files.includes("pnpm-lock.yaml")) return "pnpm";
  if (files.includes("yarn.lock")) return "yarn";
  if (files.includes("bun.lockb") || files.includes("bun.lock")) return "bun";
  if (files.includes("package-lock.json")) return "npm";
  const declared = typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : "";
  return ["pnpm", "yarn", "bun", "npm"].includes(declared) ? declared : "npm";
}

/** Lint, type check and test scripts that exist, in that order. */
export function pickScripts(pkg) {
  const scripts = pkg && typeof pkg.scripts === "object" && pkg.scripts ? pkg.scripts : {};
  const picked = [];
  if (scripts.lint) picked.push("lint");
  const typecheck = ["typecheck", "type-check", "tsc"].find((n) => scripts[n]);
  if (typecheck) picked.push(typecheck);
  if (scripts.test && !PLACEHOLDER_TEST.test(scripts.test)) picked.push("test");
  return picked;
}

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

/** Where a sibling skill's script would be, if installed next to this skill. */
export function siblingScript(skillDir, skill, file, exists = existsSync) {
  const p = path.join(skillDir, "..", skill, "scripts", file);
  return exists(p) ? p : null;
}

/**
 * Plan the steps. `skip` explains what was left out, so a missing skill is never silently a pass.
 * @returns {{steps: Array<{name: string, kind: "script"|"perf", script?: string, file?: string}>, skip: string[]}}
 */
export function planSteps({ pkg, hasBuild, perfScript }) {
  const steps = pickScripts(pkg).map((name) => ({ name, kind: "script" }));
  const skip = [];
  if (perfScript && hasBuild) steps.push({ name: "perf-budget", kind: "perf", file: perfScript });
  else if (!perfScript) skip.push("perf-budget skipped: web-performance is not installed");
  else
    skip.push(
      "perf-budget skipped: no production build in .next (run the build to check the budget)",
    );
  return { steps, skip };
}

/** Failures only, at most `maxLines` lines. Skipped steps are always mentioned. */
export function summarize(results, skip = [], maxLines = MAX_LINES) {
  const failed = results.filter((r) => r.code !== 0);
  const notes = skip.map((s) => `note: ${s}`);
  if (results.length === 0)
    return {
      ok: true,
      empty: true,
      text: [
        "verify: nothing to run. No lint, typecheck or test script found. Say so; do not report this as passing.",
        ...notes,
      ].join("\n"),
    };
  if (failed.length === 0)
    return {
      ok: true,
      text: [`verify: passed (${results.map((r) => r.name).join(", ")})`, ...notes].join("\n"),
    };
  const per = Math.max(
    3,
    Math.floor((maxLines - failed.length * 2 - notes.length - 1) / failed.length),
  );
  const out = [];
  for (const r of failed) {
    out.push(`verify: ${r.name} ${r.timedOut ? "timed out" : `failed (exit ${r.code})`}`);
    out.push(...trimOutput(r.output, per));
  }
  const passed = results.filter((r) => r.code === 0).map((r) => r.name);
  if (passed.length) out.push(`passed: ${passed.join(", ")}`);
  out.push(...notes);
  return { ok: false, text: out.slice(0, maxLines).join("\n") };
}

function spawnStep(cmd, args, { cwd, timeoutMs }) {
  const res = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === "win32",
  });
  const timedOut = res.error?.code === "ETIMEDOUT";
  return {
    code: res.status ?? 1,
    timedOut,
    output: `${res.stdout ?? ""}\n${res.stderr ?? ""}${res.error && !timedOut ? `\n${res.error.message}` : ""}`,
  };
}

function runStep(step, pm, ctx) {
  if (step.kind === "perf")
    return { name: step.name, ...spawnStep(process.execPath, [step.file, "--cwd", ctx.cwd], ctx) };
  return {
    name: step.name,
    ...spawnStep(pm, pm === "npm" ? ["run", step.name, "--silent"] : ["run", step.name], ctx),
  };
}

export function verify({ cwd, skillDir, timeoutMs = 300_000, run = runStep } = {}) {
  const pkgFile = path.join(cwd, "package.json");
  if (!existsSync(pkgFile))
    return {
      ok: true,
      empty: true,
      text: "verify: no package.json here, so there is nothing to run.",
    };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
  } catch {
    return { ok: false, text: "verify: package.json is not valid JSON." };
  }
  const { steps, skip } = planSteps({
    pkg,
    hasBuild: existsSync(path.join(cwd, ".next", "build-manifest.json")),
    perfScript: siblingScript(skillDir, "web-performance", "perf-budget.mjs"),
  });
  const lockfiles = [
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "bun.lock",
    "package-lock.json",
  ].filter((f) => existsSync(path.join(cwd, f)));
  const pm = detectPackageManager(lockfiles, pkg);
  return summarize(
    steps.map((s) => run(s, pm, { cwd, timeoutMs })),
    skip,
  );
}

function main(argv) {
  const opt = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const result = verify({
    cwd: path.resolve(opt("--cwd") ?? process.cwd()),
    skillDir: path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    timeoutMs: Number(opt("--timeout") ?? 300) * 1000,
  });
  console.log(result.text);
  process.exit(result.ok ? 0 : 1);
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
