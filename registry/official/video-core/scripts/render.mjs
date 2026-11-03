#!/usr/bin/env node
// Renders a project: check -> film (resolve.mjs) -> Remotion renders the silent picture -> ffmpeg mixes the voice,
// music bed and sound effects -> out/<name>.mp4, plus SRT/VTT captions. Every program starts through run.mjs
// (allow-list, argument arrays, no shell). Remotion is never installed here: if the engine is missing the script says
// how to set it up (engine.mjs) and stops.
// Usage: node render.mjs <project-dir> [--draft] [--ignore-approval] [--preset volt|ember|ice|grape] [--engine-dir <dir>]
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
import { checkProject } from "./check.mjs";
import { LICENCE_NOTE, engineDir, engineStatus, syncSource, tools } from "./engine.mjs";
import { loadWords, sceneWords } from "./words-data.mjs";
import { approvalState, writeValidation } from "./review.mjs";
import { run } from "./run.mjs";
import { buildTiming } from "./timing.mjs";
import { capLines, isEntry, isInside, parseArgs } from "./_lib.mjs";
import { PRESETS, buildFilm } from "../assets/film/resolve.mjs";
import { bed, synth, wav } from "../assets/film/sound.mjs";

const AUDIO_EXT = [".wav", ".mp3", ".m4a", ".flac"];
const FONT_EXT = /\.(woff2?|ttf|otf)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;

const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));
const readdirSafe = (d) => {
  try {
    return readdirSync(d).sort();
  } catch {
    return [];
  }
};

/** SRT and WebVTT text from caption pages ({ start, end, words }). Pure. */
export function subtitles(pages) {
  const ts = (s, sep) => {
    const ms = Math.max(0, Math.round(s * 1000));
    const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
    const m = String(Math.floor(ms / 60000) % 60).padStart(2, "0");
    const sec = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
    return `${h}:${m}:${sec}${sep}${String(ms % 1000).padStart(3, "0")}`;
  };
  const text = (p) => p.words.map((w) => w.text).join(" ");
  const srt = pages
    .map((p, i) => `${i + 1}\n${ts(p.start, ",")} --> ${ts(p.end, ",")}\n${text(p)}\n`)
    .join("\n");
  const vtt = `WEBVTT\n\n${pages.map((p) => `${ts(p.start, ".")} --> ${ts(p.end, ".")}\n${text(p)}\n`).join("\n")}`;
  return { srt, vtt };
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
  // Remotion writes full-range (yuvj420p) H.264; platforms expect limited-range yuv420p, so the picture is
  // converted once here (the final is rendered at a low CRF, so this pass loses little).
  args.push(
    "-vf",
    "scale=in_range=pc:out_range=tv,format=yuv420p",
    "-c:v",
    "libx264",
    "-crf",
    draft ? "23" : "18",
    "-preset",
    "veryfast",
    "-color_range",
    "tv",
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
      strings: ["preset", "engine-dir"],
    });
  } catch (e) {
    fail(e.message, 2);
  }
  const { flags, positional } = parsed;
  if (!positional[0])
    fail(
      "Usage: node render.mjs <project-dir> [--draft] [--ignore-approval] [--preset volt|ember|ice|grape] [--engine-dir <dir>]",
      2,
    );
  if (flags.preset && !PRESETS[flags.preset])
    fail(
      `Preset "${String(flags.preset).slice(0, 20)}" is not known (have: ${Object.keys(PRESETS).join(", ")}).`,
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

  const edir = engineDir({ explicit: flags["engine-dir"] });
  const engine = engineStatus(edir);
  if (!engine.ok)
    fail(
      capLines(
        engine.problems,
        "The Remotion engine is not ready. Run: node <video-core>/scripts/engine.mjs setup",
      ),
    );

  const notes = [];
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
  const assetFiles = new Map();
  for (const a of video.assets ?? []) {
    const file = path.join(dir, a.path);
    const type = VIDEO_EXT.test(a.path) ? "video" : IMAGE_EXT.test(a.path) ? "image" : null;
    if (type) assetFiles.set(a.id, { file, type });
  }
  const words = loadWords(dir);
  if (words?.lines?.some((l) => l.approximate))
    notes.push("word times are estimated (no whisper.cpp), so captions may drift a little");
  let built;
  try {
    built = buildFilm({
      video,
      timing,
      brand,
      words: sceneWords(timing, words),
      assetFiles,
      preset: flags.preset,
    });
  } catch (e) {
    fail(e.message);
  }
  notes.push(...built.notes);

  // The work folder: public/ holds the media and fonts the film names; props.json is the film.
  const work = path.join(dir, "out", "rm");
  rmSync(work, { recursive: true, force: true });
  const pub = path.join(work, "public");
  mkdirSync(pub, { recursive: true });
  for (const m of built.media) {
    mkdirSync(path.dirname(path.join(pub, m.to)), { recursive: true });
    copyFileSync(m.from, path.join(pub, m.to));
  }
  built.film.fonts = fontFiles.map((f) => {
    const name = path.basename(f);
    mkdirSync(path.join(pub, "fonts"), { recursive: true });
    copyFileSync(f, path.join(pub, "fonts", name));
    return { family: name.replace(FONT_EXT, ""), src: `/fonts/${name}` };
  });
  const props = path.join(work, "props.json");
  writeFileSync(props, JSON.stringify({ film: built.film }));
  syncSource(edir);

  const silent = path.join(work, "silent.mp4");
  const browser = tools().browser;
  const args = [
    engine.cli,
    "render",
    path.join(edir, "src", "index.ts"),
    "main",
    silent,
    `--props=${props}`,
    `--public-dir=${pub}`,
    "--codec=h264",
    "--muted",
    "--log=error",
    ...(typeof browser === "string" && path.isAbsolute(browser)
      ? [`--browser-executable=${browser}`]
      : []),
    ...(flags.draft ? ["--scale=0.5", "--crf=28"] : ["--crf=14"]),
  ];
  const r = run("node", args, { cwd: edir, timeoutMs: 3_600_000 });
  if (r.status !== 0 || !existsSync(silent))
    fail(
      capLines(
        (r.stdout + r.stderr).split("\n").filter(Boolean).slice(-30),
        "Remotion render failed.",
      ),
    );

  // Sound: the voice, a music bed (the user's licensed track, or an original generated one) and effects on cuts.
  const sfxDir = path.join(work, "sfx");
  mkdirSync(sfxDir, { recursive: true });
  const effect = (name) => {
    const f = path.join(sfxDir, `${name}.wav`);
    if (!existsSync(f)) writeFileSync(f, wav(synth(name)));
    return f;
  };
  const style = video.style ?? {};
  const auto =
    style.sfx === false
      ? []
      : built.cues.map((c) => ({
          file: effect(c.name),
          ms: Math.round(c.at * 1000),
          gainDb: c.gainDb,
        }));
  const sfx = [...auto, ...sfxPlacements(video, dir)].sort((a, b) => a.ms - b.ms);
  const musicAsset = video.music?.asset;
  let music = musicAsset && isInside(musicAsset) ? path.join(dir, musicAsset) : null;
  let duckDb = video.music?.duckUnderVoiceDb ?? -14;
  if (!music && style.music !== "none") {
    music = path.join(work, "bed.wav");
    writeFileSync(music, wav(bed({ seconds: timing.totalSeconds + 0.5, bpm: style.bpm ?? 104 })));
    duckDb = video.music?.duckUnderVoiceDb ?? -21;
    notes.push(
      'music: an original generated bed (no licence needed); set style.music to "none" to turn it off',
    );
  }

  const name = path.basename(dir).replace(/[^A-Za-z0-9._-]/g, "-") || "video";
  const out = path.join(dir, "out", `${name}${flags.draft ? "-draft" : ""}.mp4`);
  const voice = voicePlacements(video, timing, dir);
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
      duckDb,
      seconds: timing.totalSeconds,
      draft: flags.draft,
    }),
  );
  if (m.status !== 0)
    fail(
      capLines((m.stdout + m.stderr).split("\n").filter(Boolean).slice(-20), "ffmpeg mux failed."),
    );

  if (built.film.captions.length) {
    const subs = subtitles(built.film.captions);
    writeFileSync(path.join(dir, "out", `${name}.srt`), subs.srt);
    writeFileSync(path.join(dir, "out", `${name}.vtt`), subs.vtt);
  }

  let report;
  try {
    report = writeValidation({
      dir,
      file: out,
      video,
      timing,
      draft: flags.draft,
      size: [built.film.width, built.film.height],
    });
  } catch (e) {
    notes.push(`could not write validation.json: ${String(e.message).slice(0, 80)}`);
  }
  if (report && !report.ok)
    for (const c of report.checks.filter((x) => x.level === "fail"))
      notes.push(`validation: ${c.id}: ${c.text}`);
  notes.push(LICENCE_NOTE);
  console.log(
    capLines(
      notes.map((n) => `note: ${n}`),
      `Rendered ${path.relative(dir, out)}: ${timing.totalSeconds}s, ${flags.draft ? "540p draft" : `${built.film.width}x${built.film.height}`}, ${voice.length} voice line(s)${music ? ", music" : ""}${sfx.length ? `, ${sfx.length} sound effect(s)` : ""}, ${(statSync(out).size / 1024).toFixed(0)} KB.`,
    ),
  );
  if (report && !report.ok) process.exit(1);
}

if (isEntry(import.meta.url)) main();
