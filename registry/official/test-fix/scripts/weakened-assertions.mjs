#!/usr/bin/env node
// Reads a unified git diff and reports changes to test files that make tests weaker: removed assertions,
// loosened matchers, new skips and deleted tests. It reads text only.
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_LINES = 40;
const TEST_FILE =
  /(?:\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)test_[^/]+\.py$|_test\.(?:py|go)$|(?:^|\/)__tests__\/|(?:^|\/)tests?\/|Test\.(?:java|kt|cs)$|_spec\.rb$)/;
const ASSERT =
  /\b(?:expect\s*\(|assert\w*[.(\s]|\.should\b|self\.assert\w+|require\.\w+\(|t\.(?:Error|Errorf|Fatal|Fatalf)\()/;
const STRICT =
  /\.(?:toBe|toEqual|toStrictEqual|toHaveLength|toMatchObject|toMatchSnapshot|toThrow\w*|toHaveBeenCalledWith|toHaveBeenCalledTimes)\(|\bassertEqual|\bassert\s+\S+\s*==|assert_equal|\.Equal\(/;
const LOOSE =
  /\.(?:toBeTruthy|toBeDefined|toBeFalsy|toBeNull)\(|expect\.anything\(|\.not\.toThrow\(|toBeGreaterThan\(0\)|\bassertTrue\(|\bassert\s+\S+\s*$|\bassertIsNotNone/;
const SKIP =
  /\b(?:it|test|describe)\.(?:skip|todo|fixme)\b|\bx(?:it|describe|test)\s*\(|@pytest\.mark\.(?:skip|xfail)|@unittest\.skip|\bt\.Skip\w*\(|\bpending\b\s*[("']|\.only\s*\(/;
const TEST_DECL = /^\s*(?:(?:it|test)(?:\.\w+)?\s*\(|def test_|func Test|@Test\b|it\s+['"])/;

/** Parse a unified diff into files with their removed and added lines (and new-file line numbers). */
export function parseDiff(diff) {
  const files = [];
  let file = null;
  let newLine = 0;
  for (const line of diff.split(/\r?\n/)) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (header) {
      file = { path: header[2], deleted: false, removed: [], added: [] };
      files.push(file);
      continue;
    }
    if (!file) continue;
    if (/^deleted file mode/.test(line)) file.deleted = true;
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(line);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("-")) file.removed.push({ text: line.slice(1), line: newLine });
    else if (line.startsWith("+")) file.added.push({ text: line.slice(1), line: newLine++ });
    else if (line.startsWith(" ")) newLine++;
  }
  return files;
}

/** Findings for the test files in `diff`: { file, line, rule, message }. */
export function analyze(diff) {
  const findings = [];
  for (const f of parseDiff(diff)) {
    if (!TEST_FILE.test(f.path)) continue;
    if (f.deleted) {
      findings.push({
        file: f.path,
        line: 0,
        rule: "deleted-file",
        message: "the whole test file was deleted.",
      });
      continue;
    }
    const addedText = f.added.map((a) => a.text.trim());
    for (const r of f.removed) {
      if (TEST_DECL.test(r.text) && !addedText.some((a) => a === r.text.trim()))
        findings.push({
          file: f.path,
          line: r.line,
          rule: "deleted-test",
          message: `a test was removed: ${r.text.trim().slice(0, 60)}`,
        });
      else if (ASSERT.test(r.text) && !addedText.some((a) => a === r.text.trim())) {
        const looser = f.added.find(
          (a) =>
            ASSERT.test(a.text) && LOOSE.test(a.text) && !LOOSE.test(r.text) && STRICT.test(r.text),
        );
        if (looser)
          findings.push({
            file: f.path,
            line: looser.line,
            rule: "loosened-matcher",
            message: `a strict check became a weak one: ${r.text.trim().slice(0, 50)} -> ${looser.text.trim().slice(0, 50)}`,
          });
        else if (!f.added.some((a) => ASSERT.test(a.text)))
          findings.push({
            file: f.path,
            line: r.line,
            rule: "removed-assertion",
            message: `an assertion was removed: ${r.text.trim().slice(0, 60)}`,
          });
      }
    }
    for (const a of f.added)
      if (SKIP.test(a.text))
        findings.push({
          file: f.path,
          line: a.line,
          rule: "new-skip",
          message: `a test is skipped or focused: ${a.text.trim().slice(0, 60)}`,
        });
  }
  return findings;
}

export function format(findings) {
  if (findings.length === 0) return "weakened-assertions: no weakened tests in this diff.";
  const rows = findings.map(
    (f) => `  ${f.file}${f.line ? ":" + f.line : ""}  ${f.rule}  ${f.message}`,
  );
  const all = [
    `weakened-assertions: ${findings.length} finding${findings.length === 1 ? "" : "s"}. Ask the user before keeping any of these.`,
    ...rows,
  ];
  return (
    all.length <= MAX_LINES
      ? all
      : [...all.slice(0, MAX_LINES - 1), `  ... ${all.length - MAX_LINES + 1} more`]
  ).join("\n");
}

function main(argv) {
  let diff;
  if (argv.includes("--git")) {
    const base = argv[argv.indexOf("--git") + 1];
    const r = spawnSync(
      "git",
      ["diff", base && !base.startsWith("--") ? base : "HEAD", "--unified=0"],
      { encoding: "utf8" },
    );
    if (r.status !== 0) {
      console.log(
        "weakened-assertions: git diff failed. Run inside a git repository, or pipe a diff on stdin.",
      );
      process.exit(1);
    }
    diff = r.stdout;
  } else {
    const file = argv.find((a) => !a.startsWith("--"));
    diff = file ? readFileSync(path.resolve(file), "utf8") : readFileSync(0, "utf8");
  }
  const findings = analyze(diff);
  console.log(format(findings));
  process.exit(findings.length ? 1 : 0);
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
