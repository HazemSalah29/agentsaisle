#!/usr/bin/env node
// Prints where a showcase video stands and the next command, from the files in the project folder. Read-only.
// Usage: node status.mjs <project-dir>
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry } from "./_lib.mjs";

const readJson = (f) => {
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};
const newer = (a, b) => existsSync(a) && existsSync(b) && statSync(a).mtimeMs > statSync(b).mtimeMs;

/** Steps of a showcase: [{ id, status: "done" | "todo" | "stale", next }]. */
export function showcaseState(dir) {
  const f = (...p) => path.join(dir, ...p);
  const video = readJson(f("video.json"));
  const screen = (video?.scenes ?? []).find((s) => s.kind === "screen");
  const steps = [];
  const add = (id, done, next, stale = false) =>
    steps.push({ id, status: done ? (stale ? "stale" : "done") : "todo", next });
  add("demo script", existsSync(f("demo.md")), "write demo.md (references/demo-script.md)");
  add(
    "capture",
    existsSync(f("capture", "capture.webm")) && existsSync(f("capture", "interaction-log.json")),
    "node <skill>/scripts/capture.mjs --url http://localhost:3000 --script demo.md --out capture",
    newer(f("demo.md"), f("capture", "interaction-log.json")),
  );
  add(
    "plan",
    Boolean(screen?.props?.zoom),
    "node <skill>/scripts/plan.mjs --log capture/interaction-log.json --video capture/capture.webm --out assets/demo.mp4 --into video.json --scene demo",
    newer(f("capture", "interaction-log.json"), f("video.json")),
  );
  add(
    "beats (optional)",
    existsSync(f("beats.json")),
    "node <skill>/scripts/beats.mjs --audio <track> --out beats.json --into video.json --snap",
  );
  add(
    "render",
    existsSync(f("out")) && newer(f("out"), f("video.json")),
    "node <video-core>/scripts/check.mjs . then render.mjs . --draft",
  );
  return steps;
}

function main() {
  const dir = path.resolve(process.argv[2] ?? ".");
  const steps = showcaseState(dir);
  const lines = steps.map((s) => `  ${s.status.padEnd(5)} ${s.id}`);
  const next = steps.find((s) => s.status !== "done" && !s.id.includes("optional"));
  lines.push(next ? `Next: ${next.next}` : "Next: QA (video-qa), then publish (video-publish).");
  console.log(capLines(lines, "Read-only: nothing was run."));
}

if (isEntry(import.meta.url)) main();
