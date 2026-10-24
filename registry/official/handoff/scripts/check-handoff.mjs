#!/usr/bin/env node
// Checks that .agent-aisle/handoff.md is short and has the four sections a fresh session needs.
// Reads one file. Never writes, runs or fetches anything.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_LINES = 40;
export const SECTIONS = ["Goal", "Done", "Next", "Open questions"];

/** @returns {{ok: boolean, lines: number, problems: string[]}} */
export function validateHandoff(text) {
  const lines = text.replace(/\n$/, "").split("\n");
  const problems = [];
  if (text.trim() === "") return { ok: false, lines: 0, problems: ["the file is empty"] };
  if (lines.length > MAX_LINES)
    problems.push(
      `${lines.length} lines (max ${MAX_LINES}). Cut it down: a handoff is a pointer, not a diary.`,
    );

  const headings = lines.flatMap((l, i) =>
    /^##\s+/.test(l) ? [{ title: l.replace(/^##\s+/, "").trim(), at: i }] : [],
  );
  for (const s of SECTIONS)
    if (!headings.some((h) => h.title.toLowerCase() === s.toLowerCase()))
      problems.push(`missing section "## ${s}"`);
  const order = SECTIONS.map((s) =>
    headings.findIndex((h) => h.title.toLowerCase() === s.toLowerCase()),
  );
  if (order.every((n) => n >= 0) && order.some((n, i) => i > 0 && n < order[i - 1]))
    problems.push(`sections are out of order. Expected: ${SECTIONS.join(", ")}`);

  for (const [i, h] of headings.entries()) {
    if (!SECTIONS.some((s) => s.toLowerCase() === h.title.toLowerCase())) continue;
    const end = headings[i + 1]?.at ?? lines.length;
    if (lines.slice(h.at + 1, end).every((l) => l.trim() === ""))
      problems.push(`section "## ${h.title}" is empty (write "None." if there is nothing)`);
  }
  return { ok: problems.length === 0, lines: lines.length, problems };
}

export function report(result, file) {
  if (result.ok) return `handoff: ok (${result.lines} lines, max ${MAX_LINES}) ${file}`;
  return [
    `handoff: ${result.problems.length} problem${result.problems.length === 1 ? "" : "s"} in ${file}`,
    ...result.problems.map((p) => `  ${p}`),
  ].join("\n");
}

function main(argv) {
  const file = path.resolve(argv.find((a) => !a.startsWith("--")) ?? ".agent-aisle/handoff.md");
  if (!existsSync(file)) {
    console.log(`handoff: ${file} does not exist yet. Write it first.`);
    process.exit(1);
  }
  const result = validateHandoff(readFileSync(file, "utf8"));
  console.log(report(result, path.relative(process.cwd(), file) || file));
  process.exit(result.ok ? 0 : 1);
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
