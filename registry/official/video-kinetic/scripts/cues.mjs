#!/usr/bin/env node
// Adds sound to a kinetic project once the words are timed: a whoosh and a hit on each transition and a tick on each
// key word, written as `sfx` in video.json with original WAV files made from maths (no samples, no licence, no
// network) in audio/. Run it after voice, align and timing; run it again after changing the script (it replaces the
// previous cues). Reads video-core's word timing code from the sibling video-core skill.
// Usage: node cues.mjs <project-dir> [--preset volt|ember|ice] [--no-sound]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";
import { soundCues } from "./_plan.mjs";
import { NAMES, synth, wav } from "./_synth.mjs";

async function main() {
  try {
    const { flags, positional } = parseArgs(process.argv.slice(2), {
      strings: ["preset"],
      booleans: ["no-sound"],
    });
    const dir = positional[0];
    if (!dir) throw new Error("Usage: node cues.mjs <project-dir> [--preset volt|ember|ice]");
    const read = (f) => JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    if (!existsSync(path.join(dir, "video.json")) || !existsSync(path.join(dir, "timing.json")))
      throw new Error("Needs video.json and timing.json: run plan, voice, align and timing first.");
    const video = read("video.json");
    const timing = read("timing.json");
    const presets = JSON.parse(
      readFileSync(path.join(skillDir(), "assets", "presets.json"), "utf8"),
    );
    const preset = presets[flags.preset ?? "volt"];
    if (!preset) throw new Error(`--preset is one of ${Object.keys(presets).join(", ")}.`);
    let words;
    try {
      const { loadWords, sceneWords } = await import("../../video-core/scripts/words-data.mjs");
      words = sceneWords(timing, loadWords(dir));
    } catch {
      throw new Error(
        "Needs the video-core skill installed next to video-kinetic (word timing code).",
      );
    }
    const scenes = video.scenes.map((s, i) => ({
      start: timing.scenes[i].start,
      seconds: timing.scenes[i].seconds,
      transitionIn: s.transitionIn,
      emph: s.props?.emph ?? [],
      slab: s.props?.bg === "accent",
      words: words[i] ?? [],
    }));
    const cues = flags["no-sound"] ? [] : soundCues(scenes, preset, timing.totalSeconds);
    video.sfx = cues.map((c) => ({ file: `audio/${c.name}.wav`, at: c.at, gainDb: c.gainDb }));
    if (!video.sfx.length) delete video.sfx;
    mkdirSync(path.join(dir, "audio"), { recursive: true });
    for (const n of new Set(cues.map((c) => c.name)))
      if (NAMES.includes(n)) writeFileSync(path.join(dir, "audio", `${n}.wav`), wav(synth(n)));
    writeFileSync(path.join(dir, "video.json"), `${JSON.stringify(video, null, 2)}\n`);
    console.log(
      capLines(
        [`Wrote ${cues.length} sound cue(s) to ${dir}/video.json.`],
        "Next: check.mjs, render.mjs --draft, sync.mjs.",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) await main();
