#!/usr/bin/env node
// Sets each scene's length from the voice audio and writes timing.json next to video.json.
// Voice files are voice/<line-id>.wav (one per script line). Fixed scenes keep their `seconds`.
// Lengths come from the WAV header; other audio is measured with ffprobe through the runner.
// Usage: node timing.mjs <project-dir> [--pad 0.3]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { run } from "./run.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

export const DEFAULT_PAD = 0.3; // seconds of air after a scene's last line

/** Seconds of audio in a RIFF/WAVE buffer, or null when it is not a WAV this reader understands. */
export function wavSeconds(buf) {
  if (
    buf.length < 44 ||
    buf.toString("latin1", 0, 4) !== "RIFF" ||
    buf.toString("latin1", 8, 12) !== "WAVE"
  )
    return null;
  let byteRate = 0;
  for (let at = 12; at + 8 <= buf.length;) {
    const id = buf.toString("latin1", at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(at + 16);
    if (id === "data") {
      // A streamed file may carry 0 or 0xFFFFFFFF as the size; use what is actually there.
      const bytes =
        size === 0 || size === 0xffffffff || at + 8 + size > buf.length
          ? buf.length - at - 8
          : size;
      return byteRate > 0 ? bytes / byteRate : null;
    }
    at += 8 + size + (size % 2);
  }
  return null;
}

/** Length of one audio file in seconds. */
export function audioSeconds(file) {
  const buf = readFileSync(file);
  const wav = wavSeconds(buf);
  if (wav !== null) return wav;
  const r = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  const n = Number.parseFloat(r.stdout);
  if (r.status !== 0 || !Number.isFinite(n))
    throw new Error(`Cannot measure ${path.basename(file)}.`);
  return n;
}

/**
 * Build the timing table. `measure(lineId)` returns seconds for a voiced line (injected in tests).
 * Frames are whole numbers so two runs always cut at the same frame.
 */
export function buildTiming(video, measure, pad = DEFAULT_PAD) {
  const fps = video.meta.fps;
  let cursor = 0;
  const scenes = video.scenes.map((s) => {
    const lines = [];
    let seconds;
    if ((s.durationFrom ?? "voice") === "fixed") seconds = s.seconds;
    else {
      let t = 0;
      for (const id of s.narration ?? []) {
        const d = measure(id);
        lines.push({ id, start: round(t), seconds: round(d) });
        t += d;
      }
      seconds = Math.max(t + pad, s.seconds ?? 0);
    }
    const frames = Math.max(1, Math.ceil(seconds * fps - 1e-9));
    const out = {
      id: s.id,
      startFrame: cursor,
      frames,
      start: round(cursor / fps),
      seconds: round(frames / fps),
      lines,
    };
    cursor += frames;
    return out;
  });
  return { version: 1, fps, totalFrames: cursor, totalSeconds: round(cursor / fps), scenes };
}

const round = (n) => Math.round(n * 1000) / 1000;

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { strings: ["pad"] });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const dir = path.resolve(parsed.positional[0] ?? "");
  const file = path.join(dir, "video.json");
  if (!parsed.positional[0] || !existsSync(file)) {
    console.error("Usage: node timing.mjs <project-dir> [--pad 0.3]  (needs video.json)");
    process.exit(2);
  }
  const pad = parsed.flags.pad === undefined ? DEFAULT_PAD : Number(parsed.flags.pad);
  if (!Number.isFinite(pad) || pad < 0) {
    console.error("--pad must be a number of seconds, 0 or more.");
    process.exit(2);
  }
  const video = JSON.parse(readFileSync(file, "utf8"));
  const missing = [];
  const measure = (id) => {
    for (const ext of [".wav", ".mp3", ".m4a", ".flac"]) {
      const f = path.join(dir, "voice", `${id}${ext}`);
      if (existsSync(f)) return audioSeconds(f);
    }
    missing.push(id);
    return 0;
  };
  const timing = buildTiming(video, measure, pad);
  if (missing.length) {
    console.error(
      capLines(
        missing.map((id) => `missing voice/${id}.wav`),
        `${missing.length} voice file(s) missing; run the voice step first.`,
      ),
    );
    process.exit(1);
  }
  writeFileSync(path.join(dir, "timing.json"), `${JSON.stringify(timing, null, 2)}\n`);
  console.log(
    capLines(
      timing.scenes.map(
        (s) => `${s.id.padEnd(12)} ${String(s.seconds).padStart(7)}s  ${s.frames} frames`,
      ),
      `Wrote timing.json: ${timing.scenes.length} scenes, ${timing.totalSeconds}s, ${timing.totalFrames} frames.`,
    ),
  );
}

if (isEntry(import.meta.url)) main();
