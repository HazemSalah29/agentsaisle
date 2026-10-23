#!/usr/bin/env node
// Lists the source files changed in git, which of them have tests, and how to run the project's tests.
// It runs `git` only to list file names. It never runs the project's tests or code.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_LINES = 40;
const SOURCE = /\.(?:[cm]?[jt]sx?|py|go|rs|rb|java|kt|php|cs)$/;
const TEST =
  /(?:\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)test_[^/]+\.py$|_test\.(?:py|go)$|(?:^|\/)__tests__\/|(?:^|\/)tests?\/|Test\.(?:java|kt|cs)$|_spec\.rb$)/;

export const isTestFile = (f) => TEST.test(f.split(path.sep).join("/"));
export const isSourceFile = (f) =>
  SOURCE.test(f) &&
  !isTestFile(f) &&
  !/\.d\.ts$/.test(f) &&
  !/(^|\/)(node_modules|dist|build|\.next|vendor)\//.test(f);

/** Paths where a test for `file` would normally live. */
export function testCandidates(file) {
  const dir = path.posix.dirname(file);
  const ext = path.posix.extname(file);
  const base = path.posix.basename(file, ext);
  const join = (...p) => path.posix.join(...p);
  if (/^\.[cm]?[jt]sx?$/.test(ext)) {
    const exts = [ext, ".ts", ".tsx", ".js", ".mjs"].filter((e, i, a) => a.indexOf(e) === i);
    return exts.flatMap((e) => [
      join(dir, `${base}.test${e}`),
      join(dir, `${base}.spec${e}`),
      join(dir, "__tests__", `${base}.test${e}`),
    ]);
  }
  if (ext === ".py")
    return [
      join(dir, `test_${base}.py`),
      join(dir, `${base}_test.py`),
      join("tests", `test_${base}.py`),
      join(dir, "tests", `test_${base}.py`),
    ];
  if (ext === ".go") return [join(dir, `${base}_test.go`)];
  if (ext === ".rb") return [join(dir, `${base}_spec.rb`), join("spec", dir, `${base}_spec.rb`)];
  if (ext === ".java" || ext === ".kt")
    return [join(dir.replace("src/main", "src/test"), `${base}Test${ext}`)];
  return [];
}

/** The project's test runner and the command that runs it. `has(file)` tells whether a file exists; `pkg` is package.json. */
export function detectFramework(pkg, has) {
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const scripts = pkg?.scripts ?? {};
  const runner = has("pnpm-lock.yaml")
    ? "pnpm"
    : has("yarn.lock")
      ? "yarn"
      : has("bun.lockb") || has("bun.lock")
        ? "bun"
        : "npm";
  const exec =
    runner === "npm"
      ? "npx"
      : runner === "pnpm"
        ? "pnpm exec"
        : runner === "yarn"
          ? "yarn"
          : "bunx";
  if (deps?.vitest)
    return {
      name: "vitest",
      command: `${exec} vitest run`,
      perFile: (f) => `${exec} vitest run ${f.join(" ")}`,
    };
  if (deps?.jest)
    return { name: "jest", command: `${exec} jest`, perFile: (f) => `${exec} jest ${f.join(" ")}` };
  if (deps?.mocha)
    return {
      name: "mocha",
      command: `${exec} mocha`,
      perFile: (f) => `${exec} mocha ${f.join(" ")}`,
    };
  if (scripts.test)
    return {
      name: "package.json test script",
      command: runner === "npm" ? "npm test" : `${runner} test`,
      perFile: null,
    };
  if (has("pytest.ini") || has("conftest.py") || has("pyproject.toml") || has("requirements.txt"))
    return {
      name: "pytest",
      command: "python -m pytest",
      perFile: (f) => `python -m pytest ${f.join(" ")}`,
    };
  if (has("go.mod")) return { name: "go test", command: "go test ./...", perFile: null };
  if (has("Cargo.toml")) return { name: "cargo test", command: "cargo test", perFile: null };
  return null;
}

/** Sort changed files into source (with the tests found) and test files. */
export function classify(changed, exists) {
  const source = [];
  const tests = [];
  for (const f of changed) {
    if (isTestFile(f)) tests.push(f);
    else if (isSourceFile(f)) source.push({ file: f, tests: testCandidates(f).filter(exists) });
  }
  return { source, tests };
}

export function report({ framework, source, tests }) {
  const lines = [
    `changed-files: ${source.length} source file${source.length === 1 ? "" : "s"}, ${tests.length} test file${tests.length === 1 ? "" : "s"} changed`,
  ];
  lines.push(
    framework
      ? `  framework: ${framework.name}`
      : "  framework: none detected. Ask which test runner to use.",
  );
  const missing = source.filter((s) => s.tests.length === 0);
  for (const s of source.filter((x) => x.tests.length > 0))
    lines.push(`  has tests: ${s.file} -> ${s.tests[0]}`);
  for (const s of missing) lines.push(`  needs tests: ${s.file}`);
  const toRun = [...new Set([...tests, ...source.flatMap((s) => s.tests)])];
  if (framework)
    lines.push(
      `  run: ${toRun.length && framework.perFile ? framework.perFile(toRun) : framework.command}`,
    );
  return (
    lines.length <= MAX_LINES
      ? lines
      : [...lines.slice(0, MAX_LINES - 1), `  ... ${lines.length - MAX_LINES + 1} more`]
  ).join("\n");
}

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.split("\n").filter(Boolean) : null;
}

function main(argv) {
  const cwd = path.resolve(
    argv.includes("--cwd") ? argv[argv.indexOf("--cwd") + 1] : process.cwd(),
  );
  const base = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "HEAD";
  const tracked = git(["diff", "--name-only", base], cwd);
  if (tracked === null) {
    console.log("changed-files: not a git repository, or the base ref does not exist.");
    process.exit(1);
  }
  const fresh = git(["ls-files", "--others", "--exclude-standard"], cwd) ?? [];
  const changed = [...new Set([...tracked, ...fresh])].filter((f) => existsSync(path.join(cwd, f)));
  const has = (f) => existsSync(path.join(cwd, f));
  const pkg = has("package.json")
    ? JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"))
    : null;
  const { source, tests } = classify(changed, has);
  console.log(report({ framework: detectFramework(pkg, has), source, tests }));
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
