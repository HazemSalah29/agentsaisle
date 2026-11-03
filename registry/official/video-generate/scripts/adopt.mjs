#!/usr/bin/env node
// Lists a clip or still that was made outside this skill (for example through the Higgsfield connector in
// Claude Desktop) in a project: checks it is a real image or video, copies it to generated/, appends a row to
// generation-log.jsonl and adds it to video.json as aiGenerated. It never touches the network and never charges
// anything; the credits the connector spent are recorded as the user reported them (--credits), not guessed.
// Usage: node adopt.mjs <project-dir> <file> --id <asset-id> --tool <name> [--model m] [--prompt "..."] [--credits n] [--realistic]
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { appendLedger } from "./cost.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const MAX_BYTES = 200 * 1024 * 1024;
const KINDS = {
  ".png": ["image", (b) => b.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71]))],
  ".jpg": ["image", (b) => b[0] === 0xff && b[1] === 0xd8],
  ".mp4": ["video", (b) => b.length > 12 && b.toString("latin1", 4, 8) === "ftyp"],
};

/** Adopts one file; returns { id, path, kind, sha256 }. Throws a plain message on any problem. */
export function adopt({
  dir,
  file,
  id,
  tool,
  model,
  prompt,
  credits,
  realistic,
  now = new Date(),
}) {
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(id ?? ""))
    throw new Error("--id must be lowercase letters, digits and dashes.");
  if (!tool) throw new Error("--tool is required (the connector tool that made the file).");
  if (/^[a-z]+:\/\//i.test(file)) throw new Error("Give a file on disk, not a link.");
  if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`No such file: ${file}`);
  if (statSync(file).size > MAX_BYTES)
    throw new Error("The file is over 200 MB; nothing was saved.");
  const ext = path.extname(file).toLowerCase();
  const entry = KINDS[ext];
  if (!entry) throw new Error("Only .png, .jpg and .mp4 files can be adopted.");
  const bytes = readFileSync(file);
  if (!entry[1](bytes)) throw new Error(`The file is not a real ${ext} file; nothing was saved.`);
  if (credits !== undefined && !(Number(credits) >= 0))
    throw new Error("--credits must be a number of credits (0 or more).");
  const kind = entry[0];
  const rel = `generated/${id}${ext}`;
  mkdirSync(path.join(dir, "generated"), { recursive: true });
  if (path.resolve(file) !== path.resolve(dir, rel)) copyFileSync(file, path.join(dir, rel));
  const hash = createHash("sha256").update(bytes).digest("hex");
  appendLedger(path.join(dir, "generation-log.jsonl"), {
    at: now.toISOString(),
    id,
    kind,
    provider: "connector",
    model: model ?? tool,
    prompt: prompt ?? "",
    cached: false,
    costUsd: 0,
    ...(credits !== undefined ? { credits: Number(credits) } : {}),
    sha256: hash,
    path: rel,
  });
  const vf = path.join(dir, "video.json");
  if (existsSync(vf)) {
    const video = JSON.parse(readFileSync(vf, "utf8"));
    video.assets = (video.assets ?? []).filter((a) => a.id !== id);
    video.assets.push({
      id,
      path: rel,
      kind,
      source: "generated",
      licence: `Generated through the ${tool} connector (${model ?? tool}); the provider's terms apply`,
      aiGenerated: true,
      ...(realistic ? { realistic: true } : {}),
    });
    writeFileSync(vf, JSON.stringify(video, null, 2) + "\n");
  }
  return { id, path: rel, kind, sha256: hash };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      booleans: ["realistic"],
      strings: ["id", "tool", "model", "prompt", "credits"],
    });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const { flags, positional } = parsed;
  const [dir, file] = positional;
  if (!dir || !file) {
    console.error(
      "Usage: node adopt.mjs <project-dir> <file> --id <asset-id> --tool <name> [--credits n]",
    );
    process.exit(2);
  }
  try {
    const r = adopt({ dir, file, ...flags });
    console.log(
      capLines(
        [`adopted ${r.path} (${r.kind}) as ${r.id}`, `sha256 ${r.sha256.slice(0, 16)}...`],
        "ok",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}
if (isEntry(import.meta.url)) main();
