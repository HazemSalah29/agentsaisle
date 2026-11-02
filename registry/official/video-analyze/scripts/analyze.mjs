#!/usr/bin/env node
// Measures how a reference video is made (pace, shares of motion and speech, palette, tempo) and writes a recipe of
// numbers and labels. The reference is only read; nothing of it is copied, and the recipe never holds its words.
// Usage: node analyze.mjs <file> --name <recipe-name> --rights own|permission|cc|public-domain
//          [--dir recipes] [--no-transcript] [--lang en] [--force]
// Exit: 0 recipe written, 1 refused, 2 could not run.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkOutput, checkPath, ffmpeg, input, probe } from "./ffwrap.mjs";
import {
  buildRecipe,
  envelope,
  movingShare,
  palette,
  speechStats,
  tempo,
  trimToSound,
} from "./measure.mjs";
import { configuredModel, parseWhisperJson, whisperArgs } from "./_whisper.mjs";
import { run } from "./run.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const RIGHTS = ["own", "permission", "cc", "public-domain"];
const NAME = /^[a-z][a-z0-9-]{0,39}$/;
const MAX_ANALYSED = 600; // seconds: only the first ten minutes are measured

const sec = (n) => Math.round(n * 10) / 10;

/** Cut times, shot lengths and cuts a minute, from ffmpeg's scene detector (same method as video-edit scenes). */
function scenesOf(file, seconds) {
  const r = ffmpeg([
    ...input(file),
    "-t",
    String(MAX_ANALYSED),
    "-an",
    "-vf",
    "scdet=threshold=10:sc_pass=1,metadata=mode=print:file=-",
    "-f",
    "null",
    "-",
  ]);
  const span = Math.min(seconds, MAX_ANALYSED);
  const cuts = [...r.stdout.matchAll(/^frame:\d+\s+pts:\S+\s+pts_time:([\d.]+)/gm)]
    .map((m) => Number(m[1]))
    .filter((t) => t > 0 && t < span);
  const edges = [0, ...cuts, span];
  const shots = edges.slice(1).map((e, i) => e - edges[i]);
  return {
    cuts: cuts.length,
    cutTimes: cuts.map((c) => Math.round(c * 1000) / 1000),
    averageShotSeconds: Math.round((span / shots.length) * 1000) / 1000,
    cutsPerMinute: Math.round((cuts.length / span) * 60 * 1000) / 1000,
  };
}

/** Mean frame-to-frame brightness change at 5 samples a second. */
function motionOf(file) {
  const r = ffmpeg([
    ...input(file),
    "-t",
    String(MAX_ANALYSED),
    "-an",
    "-vf",
    "fps=5,scale=64:36,tblend=all_mode=difference,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-",
    "-f",
    "null",
    "-",
  ]);
  return [...r.stdout.matchAll(/signalstats\.YAVG=([\d.]+)/g)].map((m) => Number(m[1])).slice(1);
}

/** Silences ({ start, end }) quieter than -35 dB for 0.35 s, in the first ten minutes. */
function silencesOf(file, seconds) {
  const span = Math.min(seconds, MAX_ANALYSED);
  const log = ffmpeg(
    [
      ...input(file),
      "-t",
      String(MAX_ANALYSED),
      "-vn",
      "-af",
      "silencedetect=noise=-35dB:d=0.35",
      "-f",
      "null",
      "-",
    ],
    { level: "info" },
  ).stderr;
  const out = [];
  let open = null;
  for (const m of log.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    if (m[1] === "start") open = Math.max(0, Number(m[2]));
    else if (open !== null) {
      out.push({ start: open, end: Number(m[2]) });
      open = null;
    }
  }
  if (open !== null) out.push({ start: open, end: span });
  return out;
}

/** The share of time that is not silence. */
const soundShare = (silences, seconds) => {
  const span = Math.min(seconds, MAX_ANALYSED);
  const quiet = silences.reduce((n, s) => n + (s.end - s.start), 0);
  return Math.round((1 - quiet / span) * 1000) / 1000;
};

/** Run ffmpeg into a temp file and read it back as bytes (the runner returns text, which would damage raw data). */
function rawOut(args, ext) {
  const work = mkdtempSync(path.join(os.tmpdir(), "video-analyze-"));
  try {
    const out = path.join(work, `raw.${ext}`);
    ffmpeg([...args, "-y", out]);
    return readFileSync(out);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Pixels from about 12 frames spread over the video, as [r, g, b]. */
function pixelsOf(file, seconds) {
  const fps = Math.max(0.05, Math.min(2, 12 / Math.min(seconds, MAX_ANALYSED)));
  const buf = rawOut(
    [
      ...input(file),
      "-t",
      String(MAX_ANALYSED),
      "-an",
      "-vf",
      `fps=${fps},scale=32:18`,
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
    ],
    "rgb",
  );
  const px = [];
  for (let i = 0; i + 2 < buf.length; i += 3) px.push([buf[i], buf[i + 1], buf[i + 2]]);
  return px;
}

/** Mono 8 kHz samples of the sound, for the tempo guess. */
function samplesOf(file) {
  const buf = rawOut(
    [...input(file), "-t", String(MAX_ANALYSED), "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le"],
    "pcm",
  );
  const out = new Int16Array(Math.floor(buf.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}

/** Words with times from whisper.cpp, or null when it is not set up (the recipe then says speech was not measured). */
function wordsOf(file, lang) {
  const model = configuredModel();
  if (!model || !existsSync(model)) return null;
  const work = mkdtempSync(path.join(os.tmpdir(), "video-analyze-"));
  try {
    const wav = path.join(work, "a.wav");
    ffmpeg([
      ...input(file),
      "-t",
      String(MAX_ANALYSED),
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-y",
      wav,
    ]);
    const prefix = path.join(work, "out");
    const r = run("whisper-cli", whisperArgs({ model, wav, lang, outPrefix: prefix }), {
      timeoutMs: 3_600_000,
    });
    return r.status === 0
      ? parseWhisperJson(JSON.parse(readFileSync(`${prefix}.json`, "utf8")))
      : null;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Analyse one reference and return { recipe, notes }, or { refused } when the request is not allowed. */
export function analyze({ file, name, rights, transcript = true, lang = "en" }) {
  if (!NAME.test(String(name ?? "")))
    return {
      refused: [
        "--name must be lowercase letters, digits and hyphens, starting with a letter (at most 40)",
      ],
    };
  if (rights === undefined)
    return {
      refused: [
        `say on what basis you may analyse this video: --rights ${RIGHTS.join("|")}. It is recorded, not verified; if you have no right, do not use this file`,
      ],
    };
  if (!RIGHTS.includes(rights))
    return {
      refused: [
        `rights "${rights}" is not one of ${RIGHTS.join(", ")}; with no rights basis this skill will not analyse the video`,
      ],
    };
  const abs = checkPath(file, "input");
  if (!existsSync(abs)) return { refused: [`${path.basename(abs)} does not exist`] };
  const info = probe(abs);
  if (!info.hasVideo) return { refused: ["the file has no picture"] };
  const notes = [];
  const scenes = scenesOf(abs, info.seconds);
  const moving = movingShare(motionOf(abs));
  const silences = info.audio ? silencesOf(abs, info.seconds) : [];
  const sound = info.audio ? soundShare(silences, info.seconds) : null;
  const colors = palette(pixelsOf(abs, info.seconds));
  const beat = info.audio
    ? tempo(envelope(samplesOf(abs)))
    : { bpm: null, confidence: null, note: "no sound" };
  let words = null;
  if (info.audio && transcript) {
    words = wordsOf(abs, lang);
    if (!words) notes.push("speech not measured: whisper.cpp is not set up (see /video doctor)");
  }
  const span = Math.min(info.seconds, MAX_ANALYSED);
  const speech = speechStats(words ? trimToSound(words, silences, span) : [], span);
  if (info.seconds > MAX_ANALYSED)
    notes.push(`only the first ${MAX_ANALYSED / 60} minutes were measured`);
  const sha256 = createHash("sha256").update(readFileSync(abs)).digest("hex");
  const recipe = buildRecipe({
    name,
    file: path.basename(abs),
    sha256,
    rights,
    info,
    scenes,
    shares: { moving, sound },
    speech,
    colors,
    beat,
  });
  return { recipe, notes };
}

function main() {
  try {
    const { flags, positional } = parseArgs(process.argv.slice(2), {
      booleans: ["no-transcript", "force"],
      strings: ["name", "rights", "dir", "lang"],
    });
    if (!positional[0] || !flags.name)
      throw new Error(
        "Usage: node analyze.mjs <file> --name <recipe-name> --rights own|permission|cc|public-domain [--dir recipes] [--no-transcript] [--lang en] [--force]",
      );
    const r = analyze({
      file: positional[0],
      name: flags.name,
      rights: flags.rights,
      transcript: !flags["no-transcript"],
      lang: flags.lang ?? "en",
    });
    if (r.refused) {
      console.log(
        capLines(
          r.refused.map((x) => `REFUSED  ${x}`),
          "Nothing was analysed or written.",
        ),
      );
      process.exit(1);
    }
    const out = checkOutput(
      path.join(flags.dir ?? "recipes", `${flags.name}.json`),
      path.resolve(positional[0]),
      flags.force,
    );
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(r.recipe, null, 2)}\n`);
    const p = r.recipe;
    const lines = [
      `Recipe ${path.relative(process.cwd(), out)} from ${p.reference.file} (${sec(p.reference.seconds)} s, ${p.format.width}x${p.format.height}, rights: ${p.reference.rights}).`,
      `pace: ${p.pace.cuts} cuts, ${sec(p.pace.cutsPerMinute)} a minute, average shot ${sec(p.pace.averageShotSeconds)} s, hook ${sec(p.pace.hookSeconds)} s`,
      `shares: moving ${p.shares.moving}, sound ${p.shares.sound ?? "none"}, speech ${p.shares.speech ?? "not measured"}`,
      `palette: ${p.palette.map((c) => `${c.hex} ${Math.round(c.share * 100)}%`).join(", ")}`,
      `tempo: ${p.tempo.bpm ? `${p.tempo.bpm} BPM (confidence ${p.tempo.confidence}; heuristic)` : p.tempo.note}`,
      ...r.notes.map((n) => `note: ${n}`),
    ];
    console.log(
      capLines(
        lines,
        "The recipe holds numbers only. The reference's footage, audio, words and characters are not kept or reusable.",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
