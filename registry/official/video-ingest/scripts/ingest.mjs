#!/usr/bin/env node
// Brings footage into a video project with a recorded rights basis. This is the only video script (besides
// video-generate) that uses the network, and only through yt-dlp, started by the allow-listed runner.
// Usage:
//   node ingest.mjs <project> <https-url> --rights own|permission|cc|public-domain [--source-note "..."] [--id x] [--analysis-only]
//   node ingest.mjs <project> --file <path> --rights ... [--source-note "..."] [--id x] [--analysis-only]
//   node ingest.mjs <project> --verify
// Never opens, plays or runs the downloaded file.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";
import {
  MAX_BYTES,
  MEDIA_EXT,
  assetFor,
  ledgerEntry,
  nextId,
  rightsProblems,
  sha256,
  urlProblems,
  validId,
  verifyLedger,
  ytdlpArgs,
} from "./rights.mjs";
import { run as realRun } from "./run.mjs";

const LEDGER = "rights-ledger.json";

const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};
const writeJson = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

export function blockedHosts() {
  return readJson(path.join(skillDir(), "assets", "blocked-hosts.json"), { hosts: [] }).hosts;
}

export function readLedger(dir) {
  return readJson(path.join(dir, LEDGER), { entries: [] }).entries ?? [];
}

/**
 * Record one piece of footage. Returns { ok, problems, entry }. `run` and `now` are injectable for tests.
 * Writes the ledger and, when the project has a video.json, lists the asset there.
 */
export function ingest({
  dir,
  url,
  file,
  rights,
  note,
  id,
  analysisOnly,
  run = realRun,
  now = new Date(),
}) {
  const problems = rightsProblems({ rights, note });
  if (url && file) problems.push("Give either a URL or --file, not both.");
  if (!url && !file) problems.push("Give a https URL or --file <path>.");
  if (url) problems.push(...urlProblems(url, blockedHosts()));
  const ledger = readLedger(dir);
  const vfile = path.join(dir, "video.json");
  const video = existsSync(vfile) ? readJson(vfile, null) : null;
  const used = new Set([...ledger.map((e) => e.id), ...(video?.assets ?? []).map((a) => a.id)]);
  const assetId = id ?? nextId(used);
  if (!validId(assetId))
    problems.push(`--id "${String(assetId).slice(0, 40)}" must look like my-clip.`);
  else if (used.has(assetId)) problems.push(`The id "${assetId}" is already used.`);
  if (file) {
    if (!existsSync(file) || !statSync(file).isFile()) problems.push(`No such file: ${file}`);
    else if (!MEDIA_EXT.test(file))
      problems.push("Only mp4, webm, mov, mkv, mp3, wav, m4a, png, jpg and webp files.");
    else if (statSync(file).size > MAX_BYTES) problems.push("That file is larger than 500 MB.");
  }
  if (problems.length) return { ok: false, problems };

  const outDir = path.join(dir, "ingest");
  mkdirSync(outDir, { recursive: true });
  let tool = "local copy";
  let landed;
  if (url) {
    const v = run("yt-dlp", ["--version"]);
    if (v.status !== 0)
      return {
        ok: false,
        problems: [
          "yt-dlp is not installed. Install it (see references/rights.md), then run again.",
        ],
      };
    tool = `yt-dlp ${v.stdout.trim()}`;
    const r = run(
      "yt-dlp",
      ytdlpArgs({ url, outTemplate: path.join(outDir, `${assetId}.%(ext)s`) }),
      {
        cwd: outDir,
        timeoutMs: 30 * 60_000,
      },
    );
    const made = readdirSync(outDir).filter(
      (f) => f.startsWith(`${assetId}.`) && MEDIA_EXT.test(f),
    );
    // Leave nothing half-written behind on a failure.
    const clean = () =>
      readdirSync(outDir)
        .filter((f) => f.startsWith(`${assetId}.`))
        .forEach((f) => rmSync(path.join(outDir, f), { force: true }));
    if (r.status !== 0 || made.length !== 1) {
      clean();
      const tail = (r.stderr || r.stdout || "").split("\n").filter(Boolean).slice(-5);
      return { ok: false, problems: ["yt-dlp did not produce one file.", ...tail] };
    }
    landed = made[0];
  } else {
    landed = `${assetId}${path.extname(file).toLowerCase()}`;
    copyFileSync(file, path.join(outDir, landed));
  }
  const abs = path.join(outDir, landed);
  if (statSync(abs).size > MAX_BYTES) {
    rmSync(abs, { force: true });
    return { ok: false, problems: ["The downloaded file is larger than 500 MB; it was deleted."] };
  }
  const entry = ledgerEntry({
    id: assetId,
    rights,
    note,
    source: url ?? "local file",
    file: `ingest/${landed}`,
    bytes: statSync(abs).size,
    hash: sha256(readFileSync(abs)),
    tool,
    date: now.toISOString(),
    analysisOnly,
  });
  writeJson(path.join(dir, LEDGER), { entries: [...ledger, entry] });
  if (video) {
    video.assets = [...(video.assets ?? []), assetFor(entry, { fromUrl: Boolean(url) })];
    writeJson(vfile, video);
  }
  return { ok: true, problems: [], entry, listed: Boolean(video) };
}

export function verify(dir) {
  const rows = readLedger(dir);
  const problems = verifyLedger(rows, (f) => {
    const p = path.join(dir, f);
    return existsSync(p) ? sha256(readFileSync(p)) : null;
  });
  return { rows: rows.length, problems };
}

function main() {
  const fail = (m, code = 1) => {
    console.error(m);
    process.exit(code);
  };
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      booleans: ["verify", "analysis-only"],
      strings: ["rights", "source-note", "id", "file"],
    });
  } catch (e) {
    fail(e.message, 2);
  }
  const { flags, positional } = parsed;
  if (!positional[0])
    fail("Usage: node ingest.mjs <project> <https-url> --rights <basis> (see SKILL.md)", 2);
  const dir = path.resolve(positional[0]);
  if (!existsSync(dir)) fail(`No such project folder: ${dir}`, 2);
  if (flags.verify) {
    const v = verify(dir);
    if (v.problems.length)
      fail(capLines(v.problems, `${v.problems.length} ledger problem(s) in ${v.rows} entries.`));
    console.log(`Ledger ok: ${v.rows} entries match their files.`);
    return;
  }
  const r = ingest({
    dir,
    url: positional[1],
    file: flags.file ? path.resolve(flags.file) : undefined,
    rights: flags.rights,
    note: flags["source-note"],
    id: flags.id,
    analysisOnly: flags["analysis-only"] === true,
  });
  if (!r.ok) fail(capLines(r.problems, "Nothing was recorded."), 2);
  const e = r.entry;
  console.log(
    capLines(
      [
        `${e.id}: ${e.file} (${(e.bytes / 1024 / 1024).toFixed(1)} MB), rights ${e.rights}${e.analysisOnly ? ", analysis only" : ""}`,
        r.listed
          ? "Listed in video.json and rights-ledger.json."
          : "Recorded in rights-ledger.json (no video.json here to update).",
      ],
      "Run check.mjs; the footage is not opened or played by this step.",
    ),
  );
}

if (isEntry(import.meta.url)) main();
