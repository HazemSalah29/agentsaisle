#!/usr/bin/env node
// Makes the voice of a puppet character sound younger. Kokoro has only adult voices and nothing here can make a
// real child's voice, so each character's lines are pitch-shifted with their formants shifted along (a smaller
// "voice box"), by the number of semitones in the bible's "Voice pitch" line (0 to 8; 3 to 6 sounds like a young
// child, more sounds like a cartoon). Different characters get different amounts, so they do not sound alike.
// Originals are kept in voice/raw/. Re-running does nothing for lines already done. No network, no models.
// Usage: node kidvoice.mjs <project-dir> [--dry-run]
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { loadBible } from "./bible-check.mjs";
import { run } from "./run.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

export const MAX_SEMITONES = 8;
const sha = (b) => createHash("sha256").update(b).digest("hex");

/** The ffmpeg filter for a pitch shift of `st` semitones that keeps the length and shifts the formants too. */
export const pitchFilter = (st) =>
  `rubberband=pitch=${(2 ** (st / 12)).toFixed(5)}:formant=shifted`;

/** Who says each line, from the puppet scenes: Map(line id -> character). The first speaker of a line wins. */
export function speakers(video) {
  const out = new Map();
  for (const s of video.scenes ?? [])
    if (s.kind === "puppet")
      for (const c of s.props?.cast ?? [])
        for (const id of c.speaks ?? []) if (!out.has(id)) out.set(id, c.rig);
  return out;
}

/** Semitones for a character from its bible, or { error }. A bible without the line means no change. */
export function pitchOf(dir, name) {
  const found = loadBible(dir, name);
  const raw = found?.bible["voice-pitch"];
  if (raw === undefined) return { semitones: 0 };
  const m = /^\+?(\d+(?:\.\d+)?)\s*(?:semitones?)?$/i.exec(String(raw).trim());
  const n = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > MAX_SEMITONES)
    return { error: `${name}: "Voice pitch" must be 0 to ${MAX_SEMITONES} semitones` };
  return { semitones: n };
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2), { booleans: ["dry-run"] });
  const dir = path.resolve(positional[0] ?? ".");
  const vfile = path.join(dir, "video.json");
  if (!existsSync(vfile)) {
    console.error("video.json is missing: write the storyboard first.");
    process.exit(1);
  }
  const who = speakers(JSON.parse(readFileSync(vfile, "utf8")));
  const stateFile = path.join(dir, "voice", "kidvoice.json");
  const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : { lines: {} };
  const lines = [];
  let bad = 0;
  let changed = 0;
  for (const [id, name] of who) {
    const wav = path.join(dir, "voice", `${id}.wav`);
    if (!existsSync(wav)) {
      lines.push(`ERROR ${id}: voice/${id}.wav is missing (run video-voice first)`);
      bad++;
      continue;
    }
    const p = pitchOf(dir, name);
    if (p.error) {
      lines.push(`ERROR ${p.error}`);
      bad++;
      continue;
    }
    const now = sha(readFileSync(wav));
    const done = state.lines[id];
    if (done && done.after === now && done.semitones === p.semitones) {
      lines.push(`= ${id} (${name}, +${p.semitones}, kept)`);
      continue;
    }
    if (p.semitones === 0) {
      lines.push(`= ${id} (${name}, no pitch change)`);
      continue;
    }
    if (flags["dry-run"]) {
      lines.push(`would shift ${id} (${name}) by +${p.semitones} semitones`);
      continue;
    }
    // A line already shifted and then re-voiced is new raw audio; one shifted before starts from its saved original.
    const raw = path.join(dir, "voice", "raw", `${id}.wav`);
    mkdirSync(path.dirname(raw), { recursive: true });
    if (!done || done.after !== now) copyFileSync(wav, raw);
    const tmp = path.join(dir, "voice", `.${id}.tmp.wav`);
    const r = run(
      "ffmpeg",
      ["-y", "-v", "error", "-i", raw, "-af", pitchFilter(p.semitones), "-c:a", "pcm_s16le", tmp],
      { cwd: dir },
    );
    if (r.status !== 0) {
      lines.push(
        `ERROR ${id}: ffmpeg could not shift the pitch (${(r.stderr || String(r.error ?? "")).split("\n")[0].slice(0, 90)})`,
      );
      bad++;
      continue;
    }
    copyFileSync(tmp, wav);
    state.lines[id] = { character: name, semitones: p.semitones, after: sha(readFileSync(wav)) };
    lines.push(`+ ${id} (${name}, +${p.semitones} semitones)`);
    changed++;
  }
  if (!flags["dry-run"] && changed) writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  console.log(
    capLines(
      lines,
      `${changed} line(s) shifted${bad ? `, ${bad} problem(s)` : ""}. This is a younger-sounding adult voice, not a real child's.\nNext: align the words again, then visemes.mjs.`,
    ),
  );
  process.exit(bad ? 1 : 0);
}

if (isEntry(import.meta.url)) main();
