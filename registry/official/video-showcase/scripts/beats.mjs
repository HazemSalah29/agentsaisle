#!/usr/bin/env node
// Finds the beats of a music track and (optionally) snaps scene boundaries to them. The track is decoded by
// ffmpeg to a temporary file of mono samples that is read and deleted here; nothing is uploaded or fetched.
// Usage: node beats.mjs --audio <track> [--out beats.json] [--into video.json --snap [--tolerance 0.2] [--offset 0]]
// Exit: 0 done, 2 refused or failed.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyse, snapScenes } from "./_beats.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";
import { checkOutput, checkPath, ffmpeg, input } from "./ffwrap.mjs";

const RATE = 22050;
const MAX_SECONDS = 600;

/** Decode any audio file ffmpeg reads to mono float samples at 22.05 kHz. */
function decode(file) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "aisle-beats-"));
  const raw = path.join(dir, "pcm.f32");
  try {
    ffmpeg([
      ...input(file),
      "-t",
      String(MAX_SECONDS),
      "-vn",
      "-ac",
      "1",
      "-ar",
      String(RATE),
      "-f",
      "f32le",
      raw,
    ]);
    const buf = readFileSync(raw);
    return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function execute(argv) {
  const { flags } = parseArgs(argv, {
    booleans: ["snap", "force"],
    strings: ["audio", "out", "into", "tolerance", "offset"],
  });
  const file = checkPath(flags.audio, "input");
  const result = analyse(decode(file), RATE);
  const lines = [
    `${path.basename(file)}: ${result.duration}s, ${result.bpm ? `${result.bpm} BPM` : "no steady tempo found"}`,
    `${result.beats.length} beats, ${result.onsets.length} onsets; first beats ${result.beats
      .slice(0, 4)
      .join(", ")} s`,
  ];
  if (!result.bpm)
    lines.push("The beats are the onsets themselves; check them by ear before cutting to them.");
  if (flags.out) {
    const out = checkOutput(flags.out, null, flags.force);
    if (!/\.json$/i.test(out)) throw new Error("--out must be a .json file.");
    writeFileSync(out, `${JSON.stringify({ version: 1, ...result }, null, 2)}\n`);
    lines.push(`wrote ${path.basename(out)}`);
  }
  if (flags.snap) {
    if (!flags.into) throw new Error("--snap needs the project file (--into <video.json>).");
    const tolerance = Number(flags.tolerance ?? 0.2);
    const offset = Number(flags.offset ?? 0);
    if (!(tolerance > 0 && tolerance <= 1))
      throw new Error("--tolerance must be above 0 and up to 1 second.");
    if (!Number.isFinite(offset) || Math.abs(offset) > 60)
      throw new Error("--offset must be within 60 seconds.");
    const vf = path.resolve(flags.into);
    const video = JSON.parse(readFileSync(vf, "utf8"));
    const scenes = video.scenes ?? [];
    const movable = scenes.map(
      (s) => (s.durationFrom ?? "voice") === "fixed" && s.kind !== "screen",
    );
    const before = scenes.map((s) => s.seconds ?? 0);
    const after = snapScenes(
      before,
      result.beats.map((b) => b + offset),
      { tolerance, movable },
    );
    let moved = 0;
    scenes.forEach((s, i) => {
      if (after[i] !== before[i]) {
        s.seconds = after[i];
        moved++;
      }
    });
    writeFileSync(vf, `${JSON.stringify(video, null, 2)}\n`);
    const fixed = movable.filter(Boolean).length;
    lines.push(
      `snapped ${moved} scene length(s) to the beat (${fixed} of ${scenes.length} scenes can move; voice-timed and screen scenes keep their length)`,
    );
  }
  return lines;
}

function main() {
  try {
    console.log(capLines(execute(process.argv.slice(2)), "The track was not changed."));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
