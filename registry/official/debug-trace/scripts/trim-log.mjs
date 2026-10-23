#!/usr/bin/env node
// Shrinks a log or stack trace to what matters: error lines, the first project frames, repeats counted.
// Reads stdin or a file. It never runs anything.
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_MAX = 40;
// eslint-disable-next-line no-control-regex -- matching the escape character is the point
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const FRAMEWORK =
  /node_modules|node:internal|site-packages|\/usr\/lib\/|java\.(?:base|lang)|dist-packages|\/runtime\/|<anonymous>|webpack-internal/;
const ERROR_LINE =
  /\b(?:Error|Exception|FATAL|panic|Traceback|ERR!|Uncaught|Unhandled|Caused by|ECONN\w+|ENOENT|EADDRINUSE|SIGSEGV|failed)\b|^\s*E\s{2,}/;

const isFrame = (l) =>
  /^\s+at\s/.test(l) || /^\s*File "/.test(l) || /^\s+\S+\.\w+:\d+/.test(l) || /^\tat\s/.test(l);

/**
 * Trim `text` to at most `max` lines. Duplicate lines collapse to "(x N)". In a stack trace, frames
 * inside libraries are counted and hidden; at most `frames` project frames are kept per trace.
 */
export function trimLog(text, { max = DEFAULT_MAX, frames = 4 } = {}) {
  const raw = text
    .replace(ANSI, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""));
  const out = [];
  let hidden = 0;
  let kept = 0;
  const flushHidden = () => {
    if (hidden > 0) out.push(`    ... ${hidden} library frame${hidden === 1 ? "" : "s"} hidden`);
    hidden = 0;
  };
  for (const line of raw) {
    if (line === "") continue;
    if (isFrame(line)) {
      if (FRAMEWORK.test(line)) hidden++;
      else if (kept < frames) {
        flushHidden();
        out.push(line);
        kept++;
      } else hidden++;
      continue;
    }
    flushHidden();
    kept = 0;
    const prev = out.at(-1);
    const dup = /^(.*) \(x(\d+)\)$/.exec(prev ?? "");
    if (prev === line) out[out.length - 1] = `${line} (x2)`;
    else if (dup && dup[1] === line) out[out.length - 1] = `${line} (x${Number(dup[2]) + 1})`;
    else out.push(line);
  }
  flushHidden();
  if (out.length <= max) return out;
  // Too long: keep the first error and its context, then the tail.
  const firstError = Math.max(
    0,
    out.findIndex((l) => ERROR_LINE.test(l)),
  );
  const tail = Math.min(10, Math.floor(max / 4));
  const head = out.slice(
    Math.max(0, firstError - 2),
    Math.max(0, firstError - 2) + (max - tail - 1),
  );
  const rest = out.length - head.length - tail - Math.max(0, firstError - 2);
  return [...head, `... ${Math.max(rest, 0)} lines omitted ...`, ...out.slice(-tail)];
}

function main(argv) {
  const get = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const file = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--lines");
  const max = Number(get("--lines") ?? DEFAULT_MAX);
  const text = file ? readFileSync(path.resolve(file), "utf8") : readFileSync(0, "utf8");
  const lines = trimLog(text, { max });
  console.log(lines.length ? lines.join("\n") : "trim-log: the input was empty.");
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
