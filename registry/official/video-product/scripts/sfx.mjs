#!/usr/bin/env node
// Writes original sound effects (whoosh, impact, riser, tick, glitch, swell) as WAV files, made from maths in
// _synth.mjs: nothing is downloaded or sampled, so there is no licence to track and the same call gives the same
// bytes. Writes only into the folder you name; an existing file is never overwritten.
// Usage: node sfx.mjs --out <project>/audio [--names whoosh,impact] [--seed 1]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";
import { NAMES, RATE, peakDb, synth, wav } from "./_synth.mjs";

function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), { strings: ["out", "names", "seed"] });
    if (!flags.out) throw new Error("Give --out <project>/audio");
    const names = flags.names ? flags.names.split(",").map((n) => n.trim()) : NAMES;
    const bad = names.filter((n) => !NAMES.includes(n));
    if (bad.length)
      throw new Error(`Unknown effect: ${bad.join(", ")} (have: ${NAMES.join(", ")}).`);
    const seed = flags.seed === undefined ? 1 : Number(flags.seed);
    if (!Number.isInteger(seed) || seed < 1) throw new Error("--seed: a whole number from 1");
    mkdirSync(flags.out, { recursive: true });
    const lines = [];
    for (const n of names) {
      const file = path.join(flags.out, `${n}.wav`);
      if (existsSync(file)) {
        lines.push(`kept ${n}.wav (already there)`);
        continue;
      }
      const s = synth(n, { seed });
      writeFileSync(file, wav(s));
      lines.push(`${n}.wav  ${(s.length / RATE).toFixed(2)} s  peak ${peakDb(s).toFixed(1)} dBFS`);
    }
    console.log(
      capLines(
        lines,
        `Wrote effects to ${flags.out}. Place them with "sfx" in video.json: { "file": "audio/<name>.wav", "at": seconds, "gainDb": -6 }.`,
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
