#!/usr/bin/env node
// Puts a screenshot of an app or website on a styled background as two layers (a card with a shadow over a gradient
// with a soft glow) for a parallax edit: bg.jpg, subject.png and photo.jpg. Uses OpenCV through the video venv, so it
// works on Windows, Linux and macOS. The screenshot is only read; outputs go to --out.
// Usage: node compose.mjs <screenshot> --out <folder> [--format reel-9x16] [--accent #e8542a]
import { mkdirSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";
import { imageProblems } from "./cutout.mjs";
import { run } from "./run.mjs";

export const SIZES = {
  "reel-9x16": "1080x1920",
  "short-9x16": "1080x1920",
  "youtube-16x9": "1920x1080",
  "square-1x1": "1080x1080",
};

function main() {
  try {
    const { flags, positional } = parseArgs(process.argv.slice(2), {
      strings: ["out", "format", "accent"],
    });
    const [shot] = positional;
    if (!shot || !flags.out)
      throw new Error(
        "Usage: node compose.mjs <screenshot> --out <folder> [--format reel-9x16] [--accent #e8542a]",
      );
    const bad = imageProblems(shot, "screenshot");
    if (bad.length) throw new Error(bad[0]);
    const size = SIZES[flags.format ?? "reel-9x16"];
    if (!size) throw new Error(`--format is one of ${Object.keys(SIZES).join(", ")}.`);
    if (flags.accent !== undefined && !/^#[0-9a-fA-F]{6}$/.test(flags.accent))
      throw new Error("--accent: a #rrggbb colour");
    mkdirSync(flags.out, { recursive: true });
    const args = [
      path.join(skillDir(), "scripts", "compose.py"),
      path.resolve(shot),
      path.resolve(flags.out),
      "--size",
      size,
    ];
    if (flags.accent) args.push("--accent", flags.accent);
    const r = run("python", args, { timeoutMs: 120_000 });
    if (r.status !== 0)
      throw new Error(String(r.stderr).trim().slice(0, 300) || "The composition failed.");
    console.log(
      capLines([r.stdout.trim()], `Files in ${flags.out}: bg.jpg, subject.png, photo.jpg.`),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
