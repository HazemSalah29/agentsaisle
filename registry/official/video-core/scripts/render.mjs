#!/usr/bin/env node
// Renders a project: check -> HyperFrames project in out/hf -> render -> mix voice and music -> out/<name>.mp4.
// Every program is started through run.mjs (allow-list, argument arrays, no shell). HyperFrames itself is never
// installed or downloaded here; if it is missing the script prints the install line and stops.
// Usage: node render.mjs <project-dir> [--engine hyperframes|remotion] [--draft] [--ignore-approval] [--hyperframes <package-dir>] [--remotion <cli-package-dir>]
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
import { buildRemotionProject } from "../assets/engine/remotion/build.mjs";
import { buildProject } from "./project.mjs";
import { loadRigs, loadVisemes } from "./puppet-data.mjs";
import { loadWords, sceneWords } from "./words-data.mjs";
import {
  REMOTION_LICENCE_NOTE,
  findRemotion,
  remotionArgs,
  remotionProblems,
} from "./render-remotion.mjs";
import { approvalState, writeValidation } from "./review.mjs";
import { run } from "./run.mjs";
import { buildTiming } from "./timing.mjs";
import { capLines, isEntry, isInside, parseArgs } from "./_lib.mjs";

export const PINNED_HYPERFRAMES = "0.8.226";
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
 * Sound effects from `video.sfx` ({ file, at, gainDb }) that exist inside the project folder, in time order:
 * [{ file, ms, gainDb }]. A path that escapes the folder or a missing file is skipped. Pure apart from the file check.
 */
export function sfxPlacements(video, dir) {
  const out = [];
  for (const s of video.sfx ?? []) {
    if (typeof s?.file !== "string" || !isInside(s.file) || !Number.isFinite(s.at) || s.at < 0)
      continue;
    const file = path.join(dir, s.file);
    if (!existsSync(file)) continue;
    out.push({
      file,
      ms: Math.round(s.at * 1000),
      gainDb: Number.isFinite(s.gainDb) ? s.gainDb : -6,
    });
  }
  return out.sort((a, b) => a.ms - b.ms);
}

/**
 * ffmpeg arguments that mux silent video with the mixed audio. `voice` is from voicePlacements, `music` the
 * absolute music path or null. Without any audio the video is only remuxed. `draft` scales down to 540 px high.
 */
/**
 * True when a 16-bit PCM WAV holds nothing but zeros. loudnorm cannot work on digital silence (it writes NaN),
 * so a mix that is only silence skips it. Anything this cannot read counts as sound.
 */
export function wavIsSilent(buf) {
  if (buf.length < 44 || buf.toString("latin1", 0, 4) !== "RIFF") return false;
  let bits = 0;
  for (let at = 12; at + 8 <= buf.length;) {
    const id = buf.toString("latin1", at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === "fmt ") bits = buf.readUInt16LE(at + 22);
    if (id === "data") {
      if (bits !== 16) return false;
      const end = size === 0 || at + 8 + size > buf.length ? buf.length : at + 8 + size;
      for (let i = at + 8; i < end; i++) if (buf[i] !== 0) return false;
      return true;
    }
    at += 8 + size + (size % 2);
  }
  return false;
}

/** Loudness the mix is brought to: integrated LUFS and true-peak ceiling. A working default shared with video-qa. */
export const LOUDNESS = Object.freeze({ lufs: -14, truePeak: -1.5 }); // TODO(verify) per platform

export function muxArgs({
  silent,
  out,
  voice,
  music,
  sfx = [],
  duckDb = -14,
  seconds,
  draft,
  normalize = true,
}) {
  const args = ["-y", "-v", "error", "-i", silent];
  voice.forEach((v) => args.push("-i", v.file));
  if (music) args.push("-i", music);
  sfx.forEach((x) => args.push("-i", x.file));
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
  if (sfx.length) {
    // Short effects sit on top of the voice and music mix and are not ducked.
    const first = voice.length + (music ? 1 : 0) + 1;
    sfx.forEach((x, i) =>
      filters.push(
        `[${first + i}:a]adelay=${x.ms}|${x.ms},aresample=48000,volume=${x.gainDb}dB[x${i}]`,
      ),
    );
    filters.push(
      `${sfx.map((_, i) => `[x${i}]`).join("")}amix=inputs=${sfx.length}:normalize=0:dropout_transition=0[sfx]`,
    );
    if (map) {
      filters.push(`${map}[sfx]amix=inputs=2:normalize=0:dropout_transition=0[withsfx]`);
      map = "[withsfx]";
    } else map = "[sfx]";
  }
  if (map && normalize) {
    // One last stage so the voice and music land at the target level whatever they were recorded at.
    filters.push(
      `${map}loudnorm=I=${LOUDNESS.lufs}:TP=${LOUDNESS.truePeak}:LRA=11,aresample=48000[final]`,
    );
    map = "[final]";
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
      booleans: ["draft", "ignore-approval"],
      strings: ["engine", "hyperframes", "remotion"],
    });
  } catch (e) {
    fail(e.message, 2);
  }
  const { flags, positional } = parsed;
  const engine = flags.engine ?? "hyperframes";
  if (engine !== "hyperframes" && engine !== "remotion")
    fail(`Engine "${String(engine).slice(0, 30)}" is not known (have: hyperframes, remotion).`, 2);
  if (!positional[0])
    fail(
      "Usage: node render.mjs <project-dir> [--engine hyperframes|remotion] [--draft] [--hyperframes <package-dir>] [--remotion <package-dir>]",
      2,
    );
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

  const notes = [];
  let captions = null;
  if (video.captions?.burn === true) {
    const cfile = path.join(dir, "captions.json");
    if (!existsSync(cfile))
      fail("video.json asks for burned captions but captions.json is missing: run captions.mjs.");
    captions = readJson(cfile);
    if (captions.approximate)
      notes.push("caption times are estimated, not measured, so they may drift from the voice");
  }

  const hf =
    engine === "hyperframes" ? findHyperframes({ explicit: flags.hyperframes, dir }) : null;
  const rm = engine === "remotion" ? findRemotion({ explicit: flags.remotion, dir }) : null;
  if (engine === "hyperframes") {
    if (!hf)
      fail(
        `HyperFrames is not installed. Install the npm package "hyperframes" at version ${PINNED_HYPERFRAMES} (the command is in references/runner.md), then run again.`,
      );
    if (hf.version !== PINNED_HYPERFRAMES)
      notes.push(
        `HyperFrames ${hf.version} found; this skill was tested with ${PINNED_HYPERFRAMES}`,
      );
  } else {
    if (!rm)
      fail(
        `Remotion is not installed. Install "remotion" and "@remotion/cli" at one 4.x version next to the project (the command is in references/runner.md), then run again. ${REMOTION_LICENCE_NOTE}`,
      );
    const bad = remotionProblems(rm);
    if (bad.length) fail(bad.join("\n"));
    notes.push(REMOTION_LICENCE_NOTE);
    notes.push(
      `Remotion ${rm.version}: this adapter has not been tested against a real Remotion install yet`,
    );
  }

  // A final render never runs on a draft that was approved for an older version of the project.
  if (!flags.draft) {
    const ap = approvalState(dir);
    if (ap.state === "stale" && !flags["ignore-approval"])
      fail(
        `The approved draft is out of date (${ap.reason}). Render a new draft (--draft), look at it, run review.mjs approve, then render the final. To render anyway, add --ignore-approval.`,
      );
    if (ap.state === "current")
      notes.push(`the approved draft matches this project (${ap.approval.draft})`);
  }

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
  let built;
  try {
    built = (engine === "remotion" ? buildRemotionProject : buildProject)({
      video,
      timing,
      brand,
      fontFiles,
      assetPaths,
      captions,
      rigs: loadRigs(video, dir).rigs,
      rigs3d: loadRigs(video, dir).rigs3d,
      visemes: loadVisemes(dir),
      words: sceneWords(timing, loadWords(dir)),
    });
  } catch (e) {
    fail(e.message);
  }
  notes.push(...built.notes);

  const work = path.join(dir, "out", engine === "remotion" ? "rm" : "hf");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  for (const [rel, text] of Object.entries(built.files)) {
    mkdirSync(path.dirname(path.join(work, rel)), { recursive: true });
    writeFileSync(path.join(work, rel), text);
  }
  for (const m of [...built.media, ...built.fonts]) {
    mkdirSync(path.dirname(path.join(work, m.to)), { recursive: true });
    copyFileSync(m.from, path.join(work, m.to));
  }

  const silent = path.join(work, "silent.mp4");
  if (engine === "hyperframes") {
    const check = run("node", [hf.bin, "check", work]);
    if (check.status !== 0)
      fail(
        capLines(
          (check.stdout + check.stderr).split("\n").filter(Boolean).slice(-30),
          "HyperFrames check failed.",
        ),
      );
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
  } else {
    const r = run("node", remotionArgs({ bin: rm.bin, out: silent, draft: flags.draft }), {
      cwd: work,
    });
    if (r.status !== 0 || !existsSync(silent))
      fail(
        capLines(
          (r.stdout + r.stderr).split("\n").filter(Boolean).slice(-30),
          "Remotion render failed.",
        ),
      );
  }

  const name = path.basename(dir).replace(/[^A-Za-z0-9._-]/g, "-") || "video";
  const out = path.join(dir, "out", `${name}${flags.draft ? "-draft" : ""}.mp4`);
  const voice = voicePlacements(video, timing, dir);
  const musicAsset = video.music?.asset;
  const music = musicAsset && isInside(musicAsset) ? path.join(dir, musicAsset) : null;
  const sfx = sfxPlacements(video, dir);
  const audible =
    Boolean(music) || sfx.length > 0 || voice.some((v) => !wavIsSilent(readFileSync(v.file)));
  const m = run(
    "ffmpeg",
    muxArgs({
      normalize: audible,
      video,
      silent,
      out,
      voice,
      music,
      sfx,
      duckDb: video.music?.duckUnderVoiceDb ?? -14,
      seconds: timing.totalSeconds,
      draft: flags.draft,
    }),
  );
  if (m.status !== 0)
    fail(
      capLines((m.stdout + m.stderr).split("\n").filter(Boolean).slice(-20), "ffmpeg mux failed."),
    );

  let report;
  try {
    report = writeValidation({
      dir,
      file: out,
      video,
      timing,
      draft: flags.draft,
      size: built.size,
    });
  } catch (e) {
    notes.push(`could not write validation.json: ${String(e.message).slice(0, 80)}`);
  }
  if (report && !report.ok)
    for (const c of report.checks.filter((x) => x.level === "fail"))
      notes.push(`validation: ${c.id}: ${c.text}`);
  console.log(
    capLines(
      notes.map((n) => `note: ${n}`),
      `Rendered ${path.relative(dir, out)}: ${timing.totalSeconds}s, ${flags.draft ? "540p draft" : built.size.join("x")}, ${voice.length} voice line(s)${music ? ", music" : ""}${sfx.length ? `, ${sfx.length} sound effect(s)` : ""}, ${(statSync(out).size / 1024).toFixed(0)} KB.`,
    ),
  );
  if (report && !report.ok) process.exit(1);
}

if (isEntry(import.meta.url)) main();
