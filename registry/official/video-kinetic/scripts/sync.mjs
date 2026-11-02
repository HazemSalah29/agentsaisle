#!/usr/bin/env node
// Checks that a kinetic project's words are on the beat of the voice: every kinetic scene has spoken words with real
// (whisper) timings, no phrase has more than four words, no word is too small to read, and each phrase stays on
// screen long enough to be read. Prints a short report and exits 0 when nothing is wrong, 1 when something is.
// Reads video-core's scene code from the sibling video-core skill. Read-only.
// Usage: node sync.mjs <project-dir> [--allow-estimated]
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

/** The reading time a phrase of `n` words needs on screen, in seconds. */
export const readSeconds = (n) => 0.4 + 0.25 * n;

async function main() {
  try {
    const { flags, positional } = parseArgs(process.argv.slice(2), {
      booleans: ["allow-estimated"],
    });
    const dir = positional[0];
    if (!dir) throw new Error("Usage: node sync.mjs <project-dir> [--allow-estimated]");
    for (const f of ["video.json", "timing.json"])
      if (!existsSync(path.join(dir, f)))
        throw new Error(`${f} is missing: run plan, voice, align and timing first.`);
    const read = (f) => JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    const video = read("video.json");
    const timing = read("timing.json");
    let kin;
    let wd;
    try {
      kin = await import("../../video-core/assets/engine/hyperframes/kinetic.mjs");
      wd = await import("../../video-core/scripts/words-data.mjs");
    } catch {
      throw new Error("Needs the video-core skill installed next to video-kinetic.");
    }
    const words = wd.sceneWords(timing, wd.loadWords(dir));
    const errors = [];
    const warns = [];
    let total = 0;
    video.scenes.forEach((s, i) => {
      if (s.kind !== "kinetic") return;
      const ws = words[i] ?? [];
      const T = timing.scenes[i].seconds;
      if (!ws.length) return void errors.push(`${s.id}: no spoken words (run voice and align)`);
      if (ws.some((w) => w.approximate) && !flags["allow-estimated"])
        errors.push(
          `${s.id}: word times are estimated, not measured (install whisper.cpp, or use --allow-estimated)`,
        );
      const times = kin.phraseTimes(s.props ?? {}, ws, T);
      for (const [j, ph] of times.entries()) {
        total++;
        if (ph.words.length > kin.LIMITS.perPhrase)
          errors.push(
            `${s.id} phrase ${j + 1}: ${ph.words.length} words at once (at most ${kin.LIMITS.perPhrase})`,
          );
        const size = kin.phraseSize(
          ph.words.map((w) => kin.shown(w.text)),
          s.props?.bg === "accent",
        );
        if (size < 8)
          errors.push(
            `${s.id} phrase ${j + 1}: type size ${size} is too small to read (shorten the line)`,
          );
        const visible = (ph.exitAt ?? T) - ph.start;
        if (visible < readSeconds(ph.words.length))
          warns.push(
            `${s.id} phrase ${j + 1}: on screen ${visible.toFixed(2)} s, a reader needs about ${readSeconds(ph.words.length).toFixed(2)} s (speak slower or split the line)`,
          );
      }
    });
    const lines = [...errors.map((e) => `ERROR ${e}`), ...warns.map((w) => `warn  ${w}`)];
    console.log(
      capLines(
        lines,
        errors.length
          ? `${errors.length} problem(s), ${warns.length} warning(s).`
          : `ok: ${total} phrases, every word pops on its spoken start${warns.length ? `; ${warns.length} warning(s)` : ""}.`,
      ),
    );
    process.exit(errors.length ? 1 : 0);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) await main();
