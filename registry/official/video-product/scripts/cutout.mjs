#!/usr/bin/env node
// Cuts a product out of its photo for 2.5D parallax: subject.png (transparent around the product), bg.jpg (the photo
// with the product area filled in), a preview and cutout.json saying how sure the cut is. Uses OpenCV GrabCut
// through the video venv, so it works on Windows, Linux and macOS with nothing new installed. A cutout PNG of your
// own (with transparency) can be given with --alpha. The photo is only read; outputs go to --out.
// Usage: node cutout.mjs <photo> --out <folder> [--alpha cutout.png]
import { existsSync, lstatSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";
import { run } from "./run.mjs";

const MAX_BYTES = 25 * 1024 * 1024;
const IMAGE = /\.(png|jpe?g|webp)$/i;

/** Problems with an input image path, as readable strings. Pure apart from the file checks. */
export function imageProblems(file, label = "photo") {
  if (
    typeof file !== "string" ||
    !file ||
    file.startsWith("-") ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(file)
  )
    return [`${label}: a PNG, JPEG or WebP file on this computer`];
  if (!IMAGE.test(file)) return [`${label}: only .png, .jpg, .jpeg and .webp are read`];
  if (!existsSync(file)) return [`${label}: ${file} does not exist`];
  const st = lstatSync(file);
  if (st.isSymbolicLink() || !st.isFile()) return [`${label}: a plain file, not a link`];
  if (st.size > MAX_BYTES) return [`${label}: larger than 25 MB; save a smaller copy`];
  return [];
}

function main() {
  try {
    const { flags, positional } = parseArgs(process.argv.slice(2), { strings: ["out", "alpha"] });
    const [photo] = positional;
    if (!photo || !flags.out)
      throw new Error("Usage: node cutout.mjs <photo> --out <folder> [--alpha cutout.png]");
    const bad = [
      ...imageProblems(photo),
      ...(flags.alpha ? imageProblems(flags.alpha, "--alpha") : []),
    ];
    if (bad.length) throw new Error(bad[0]);
    mkdirSync(flags.out, { recursive: true });
    const args = [
      path.join(skillDir(), "scripts", "cutout.py"),
      path.resolve(photo),
      path.resolve(flags.out),
    ];
    if (flags.alpha) args.push("--alpha", path.resolve(flags.alpha));
    const r = run("python", args, { timeoutMs: 180_000 });
    if (r.status !== 0)
      throw new Error(String(r.stderr).trim().slice(0, 300) || "The cutout failed.");
    const report = JSON.parse(readFileSync(path.join(flags.out, "cutout.json"), "utf8"));
    const lines = [r.stdout.trim()];
    if (!report.ok)
      lines.push(
        "Ask the user for a photo with the product on a plain background, or a cutout PNG with transparency (--alpha).",
      );
    console.log(
      capLines(
        lines,
        `Files in ${flags.out}: subject.png, bg.jpg, preview.png (look at it), cutout.json.`,
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
