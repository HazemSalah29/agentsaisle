#!/usr/bin/env node
// Renders a project: check -> HyperFrames project in out/hf -> render -> mix voice and music -> out/<name>.mp4.
// Every program is started through run.mjs (allow-list, argument arrays, no shell). HyperFrames itself is never
// installed or downloaded here; if it is missing the script prints the install line and stops.
// Usage: node render.mjs <project-dir> [--engine hyperframes] [--draft] [--hyperframes <path-to-package>]
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
import os from "node:os";
import path from "node:path";
import { checkProject } from "./check.mjs";
import { buildProject } from "./project.mjs";
import { run } from "./run.mjs";
import { buildTiming } from "./timing.mjs";
import { capLines, isEntry, isInside, parseArgs } from "./_lib.mjs";

export const PINNED_HYPERFRAMES = "0.8.226";
export const INSTALL_LINE = `npm install --global hyperframes@${PINNED_HYPERFRAMES}`;
const AUDIO_EXT = [".wav", ".mp3", ".m4a", ".flac"];
const FONT_EXT = /\.(woff2?|ttf|otf)$/i;

const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));

/** The absolute path of the HyperFrames CLI script inside a package folder, or null. */
export function binOf(pkgDir, fs = { exists: existsSync, readJson }) {
  const pj = path.join(pkgDir, "package.json");
  if (!fs.exists(pj)) return null;
  try {
    const p = fs.readJson(pj);
    if (p.name !== "hyperframes") return null;
    const bin =
      typeof p.bin === "string" ? p.bin : (p.bin?.hyperframes ?? Object.values(p.bin ?? {})[0]);
    return bin ? { bin: path.resolve(pkgDir, bin), version: p.version } : null;
  } catch {
    return null;
  }
}

/**
 * Where an installed HyperFrames might be, best first: --hyperframes, node_modules next to the project (and
 * up to three folders above), the global install next to this Node, then the npx cache.
 */
export function candidateDirs({
  explicit,
  dir,
  execPath = process.execPath,
  home = os.homedir(),
  list = readdirSafe,
}) {
  const out = [];
  if (explicit) out.push(path.resolve(explicit));
  let d = path.resolve(dir);
  for (let i = 0; i < 4; i++) {
    out.push(path.join(d, "node_modules", "hyperframes"));
    d = path.dirname(d);
  }
  const prefix = path.resolve(path.dirname(execPath), "..");
  out.push(
    path.join(prefix, "lib", "node_modules", "hyperframes"),
    path.join(path.dirname(execPath), "node_modules", "hyperframes"),
  );
  const npx = path.join(home, ".npm", "_npx");
  for (const e of list(npx)) out.push(path.join(npx, e, "node_modules", "hyperframes"));
  return out;
}
const readdirSafe = (d) => {
  try {
    return readdirSync(d).sort();
  } catch {
    return [];
  }
};

export function findHyperframes(opts, fs) {
  for (const c of candidateDirs(opts)) {
    const found = binOf(c, fs);
    if (found) return found;
  }
  return null;
}

/** Voice lines placed at their start in the film: [{ file, ms }]. */
export function voicePlacements(video, timing, dir) {
  const out = [];
  video.scenes.forEach((s, i) => {
    if ((s.durationFrom ?? "voice") === "fixed" && !(s.narration ?? []).length) return;
    for (const line of timing.scenes[i].lines) {
      const ext = AUDIO_EXT.find((e) => existsSync(path.join(dir, "voice", `${line.id}${e}`)));
      if (ext)
        out.push({
          file: path.join(dir, "voice", `${line.id}${ext}`),
          ms: Math.round((timing.scenes[i].start + line.start) * 1000),
        });
    }
  });
  return out;
}

/**
 * ffmpeg arguments that mux silent video with the mixed audio. `voice` is from voicePlacements, `music` the
 * absolute music path or null. Without any audio the video is only remuxed. `draft` scales down to 540 px high.
 */
export function muxArgs({ video, silent, out, voice, music, duckDb = -14, seconds, draft }) {
  const args = ["-y", "-v", "error", "-i", silent];
  const inputs = [];
  voice.forEach((v) => (args.push("-i", v.file), inputs.push(v)));
  if (music) args.push("-i", music);
  const filters = [];
  voice.forEach((v, i) =>
    filters.push(`[${i + 1}:a]adelay=${v.ms}|${v.ms},aresample=48000[v${i}]`),
  );
  let map = null;
  if (voice.length) {
    const labels = voice.map((_, i) => `[v${i}]`).join("");
    filters.push(`${labels}amix=inputs=${voice.length}:normalize=0:dropout_transition=0[voice]`);
    map = "[voice]";
  }
  if (music) {
    const mi = voice.length + 1;
    const base = `[${mi}:a]aloop=loop=-1:size=2147483647,atrim=0:${seconds},aresample=48000,volume=${duckDb}dB`;
    if (voice.length) {
      filters.push(
        "[voice]asplit=2[vo][sc]",
        `${base}[m]`,
        "[m][sc]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[duck]",
        "[duck][vo]amix=inputs=2:normalize=0:dropout_transition=0[mix]",
      );
      map = "[mix]";
    } else {
      filters.push(`${base}[mix]`);
      map = "[mix]";
    }
  }
  if (filters.length) args.push("-filter_complex", filters.join(";"));
  args.push("-map", "0:v");
  if (map) args.push("-map", map);
  args.push(
    ...(draft
      ? [
          "-vf",
          "scale=-2:540",
          "-c:v",
          "libx264",
          "-crf",
          "23",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
        ]
      : ["-c:v", "copy"]),
  );
  if (map) args.push("-c:a", "aac", "-b:a", "192k", "-ar", "48000");
  args.push(
    "-t",
    String(seconds),
    "-fflags",
    "+bitexact",
    "-flags:v",
    "+bitexact",
    "-flags:a",
    "+bitexact",
    "-movflags",
    "+faststart",
    out,
  );
  return args;
}

const fail = (msg, code = 1) => {
  console.error(msg);
  process.exit(code);
};

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      booleans: ["draft"],
      strings: ["engine", "hyperframes"],
    });
  } catch (e) {
    fail(e.message, 2);
  }
  const { flags, positional } = parsed;
  if ((flags.engine ?? "hyperframes") !== "hyperframes")
    fail(`Engine "${flags.engine}" is not built yet (have: hyperframes).`, 2);
  if (!positional[0])
    fail("Usage: node render.mjs <project-dir> [--draft] [--hyperframes <package-dir>]", 2);
  const dir = path.resolve(positional[0]);
  const vfile = path.join(dir, "video.json");
  if (!existsSync(vfile)) fail(`No video.json in ${dir}.`, 2);
  const video = readJson(vfile);

  const problems = checkProject(video, dir);
  if (problems.length)
    fail(
      capLines(
        problems,
        `${problems.length} problem(s); fix them (node check.mjs) before rendering.`,
      ),
    );

  // timing: use timing.json, or build it when every scene has a fixed length
  const tfile = path.join(dir, "timing.json");
  let timing;
  if (existsSync(tfile)) {
    timing = readJson(tfile);
    const same =
      timing.scenes?.length === video.scenes.length &&
      timing.scenes.every((s, i) => s.id === video.scenes[i].id);
    if (!same || timing.fps !== video.meta.fps)
      fail("timing.json is out of date; run timing.mjs again.");
  } else if (video.scenes.every((s) => (s.durationFrom ?? "voice") === "fixed")) {
    timing = buildTiming(video, () => 0, 0);
    writeFileSync(tfile, `${JSON.stringify(timing, null, 2)}\n`);
  } else fail("No timing.json: run timing.mjs after the voice step.");

  const hf = findHyperframes({ explicit: flags.hyperframes, dir });
  if (!hf)
    fail(
      `HyperFrames is not installed. Install the tested version, then run again:\n  ${INSTALL_LINE}`,
    );
  const notes = [];
  if (hf.version !== PINNED_HYPERFRAMES)
    notes.push(`HyperFrames ${hf.version} found; this skill was tested with ${PINNED_HYPERFRAMES}`);

  const brandRel = video.meta.brand;
  let brand = {};
  let fontFiles = [];
  if (brandRel && isInside(brandRel) && existsSync(path.join(dir, brandRel))) {
    brand = readJson(path.join(dir, brandRel));
    const fdir = path.join(path.dirname(path.join(dir, brandRel)), "fonts");
    fontFiles = readdirSafe(fdir)
      .filter((f) => FONT_EXT.test(f))
      .map((f) => path.join(fdir, f));
  }
  const assetPaths = new Map((video.assets ?? []).map((a) => [a.id, path.join(dir, a.path)]));
  const built = buildProject({ video, timing, brand, fontFiles, assetPaths });
  notes.push(...built.notes);

  const work = path.join(dir, "out", "hf");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  for (const [rel, text] of Object.entries(built.files)) writeFileSync(path.join(work, rel), text);
  for (const m of [...built.media, ...built.fonts]) {
    mkdirSync(path.dirname(path.join(work, m.to)), { recursive: true });
    copyFileSync(m.from, path.join(work, m.to));
  }

  const check = run("node", [hf.bin, "check", work]);
  if (check.status !== 0)
    fail(
      capLines(
        (check.stdout + check.stderr).split("\n").filter(Boolean).slice(-30),
        "HyperFrames check failed.",
      ),
    );

  const silent = path.join(work, "silent.mp4");
  const r = run(
    "node",
    [hf.bin, "render", work, "-o", silent, "-q", flags.draft ? "draft" : "looks"],
    { cwd: work },
  );
  if (r.status !== 0 || !existsSync(silent))
    fail(
      capLines(
        (r.stdout + r.stderr).split("\n").filter(Boolean).slice(-30),
        "HyperFrames render failed.",
      ),
    );

  const name = path.basename(dir).replace(/[^A-Za-z0-9._-]/g, "-") || "video";
  const out = path.join(dir, "out", `${name}${flags.draft ? "-draft" : ""}.mp4`);
  const voice = voicePlacements(video, timing, dir);
  const musicAsset = video.music?.asset;
  const music = musicAsset && isInside(musicAsset) ? path.join(dir, musicAsset) : null;
  const m = run(
    "ffmpeg",
    muxArgs({
      video,
      silent,
      out,
      voice,
      music,
      duckDb: video.music?.duckUnderVoiceDb ?? -14,
      seconds: timing.totalSeconds,
      draft: flags.draft,
    }),
  );
  if (m.status !== 0)
    fail(
      capLines((m.stdout + m.stderr).split("\n").filter(Boolean).slice(-20), "ffmpeg mux failed."),
    );

  console.log(
    capLines(
      notes.map((n) => `note: ${n}`),
      `Rendered ${path.relative(dir, out)}: ${timing.totalSeconds}s, ${flags.draft ? "540p draft" : built.size.join("x")}, ${voice.length} voice line(s)${music ? ", music" : ""}, ${(statSync(out).size / 1024).toFixed(0)} KB.`,
    ),
  );
}

if (isEntry(import.meta.url)) main();
