#!/usr/bin/env node
// Cuts test runner output down to the failures. Reads stdin; supports vitest, jest, pytest and go test.
import { readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const MAX_LINES = 40;
// eslint-disable-next-line no-control-regex -- matching the escape character is the point
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

export function detectRunner(text) {
  if (
    /^={3,} .*(?:FAILURES|test session starts)|^FAILED .*::/m.test(text) ||
    /\bpytest\b/.test(text)
  )
    return "pytest";
  if (/^--- (?:FAIL|PASS):|^(?:ok|FAIL)\s+\S+\s+[\d.]+s/m.test(text)) return "go";
  if (/^\s*(?:FAIL|PASS)\s+\S+|Test Files|Test Suites:|^\s*●\s/m.test(text)) return "js";
  return "unknown";
}

function jsFailures(lines) {
  const blocks = [];
  let cur = null;
  const start = /^\s*(?:FAIL\s|●\s)/;
  const stop =
    /^\s*(?:PASS\s|✓|√|Test Files|Test Suites:|Tests:?\s|Snapshots:|Time:|Duration|Start at)/;
  for (const line of lines) {
    if (start.test(line)) {
      if (cur) blocks.push(cur);
      cur = [line];
    } else if (stop.test(line)) {
      if (cur) blocks.push(cur);
      cur = null;
    } else if (cur && line.trim() !== "") cur.push(line);
  }
  if (cur) blocks.push(cur);
  // A bare "FAIL path" header with nothing under it is just a pointer to the detailed blocks.
  return blocks
    .filter((b) => !(b.length === 1 && /^\s*FAIL\s+\S+\s*$/.test(b[0])))
    .map((b) => b.slice(0, 7));
}

function pytestFailures(lines) {
  const out = [];
  let name = null;
  let body = [];
  const flush = () => {
    if (name) out.push([`FAILED ${name}`, ...body.slice(0, 6)]);
    name = null;
    body = [];
  };
  for (const line of lines) {
    const head = /^_{3,} (.+?) _{3,}$/.exec(line);
    if (head) {
      flush();
      name = head[1];
    } else if (/^={3,} /.test(line)) flush();
    else if (name && (/^E\s/.test(line) || /^\S+\.py:\d+:/.test(line))) body.push(line);
  }
  flush();
  return out;
}

function goFailures(lines) {
  const out = [];
  let cur = null;
  let run = { name: "", lines: [] };
  for (const line of lines) {
    const started = /^=== RUN\s+(\S+)/.exec(line);
    if (started) {
      if (cur) out.push(cur);
      cur = null;
      run = { name: started[1], lines: [] };
      continue;
    }
    const failed = /^\s*--- FAIL:\s+(\S+)/.exec(line);
    if (failed) {
      if (cur) out.push(cur);
      // With -v, the test's log lines come before its "--- FAIL" line.
      cur = [line, ...(run.name === failed[1] ? run.lines : [])];
      continue;
    }
    if (cur && /^\s+\S/.test(line) && !/^\s*--- /.test(line)) cur.push(line);
    else if (/^\s+\S/.test(line)) run.lines.push(line);
    else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out.map((b) => b.slice(0, 7));
}

const SUMMARY = {
  js: /^\s*(?:Tests:?|Test Files|Test Suites:)\s.*$/,
  pytest: /^=+ .*(?:passed|failed|error).* =+$/,
  go: /^(?:FAIL|ok)\s+\S+.*$/,
};

export function trim(text) {
  const lines = text.replace(ANSI, "").split(/\r?\n/);
  const runner = detectRunner(lines.join("\n"));
  const blocks =
    runner === "js"
      ? jsFailures(lines)
      : runner === "pytest"
        ? pytestFailures(lines)
        : runner === "go"
          ? goFailures(lines)
          : [];
  const summary = SUMMARY[runner] ? lines.filter((l) => SUMMARY[runner].test(l)).slice(-2) : [];
  return { runner, blocks, summary, read: lines.length };
}

export function format({ runner, blocks, summary, read }) {
  if (runner === "unknown")
    return `trim-test-output: could not recognize the test runner (${read} lines read). Supported: vitest, jest, pytest, go test.`;
  if (blocks.length === 0)
    return `trim-test-output: ${runner}: no failures found (${read} lines read).${summary.length ? "\n" + summary.join("\n") : ""}`;
  const lines = [
    `trim-test-output: ${runner}: ${blocks.length} failure${blocks.length === 1 ? "" : "s"}`,
  ];
  for (const b of blocks) lines.push(...b.map((l) => l.replace(/\s+$/, "")));
  lines.push(...summary);
  return (
    lines.length <= MAX_LINES
      ? lines
      : [...lines.slice(0, MAX_LINES - 1), `... ${lines.length - MAX_LINES + 1} more lines`]
  ).join("\n");
}

function main() {
  const result = trim(readFileSync(0, "utf8"));
  console.log(format(result));
  process.exit(result.blocks.length ? 1 : 0);
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main();
