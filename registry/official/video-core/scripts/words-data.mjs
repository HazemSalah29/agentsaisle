// Spoken word times for the scenes: voice/words.json (written by video-voice's align step) joined with timing.json,
// so a scene can pop each word in at the moment it is spoken. Text only: nothing in these files is ever run.
import { readFileSync } from "node:fs";
import path from "node:path";

const r3 = (n) => Math.round(n * 1000) / 1000;

/** voice/words.json as data, or null when it is missing or unreadable. */
export function loadWords(dir) {
  try {
    return JSON.parse(readFileSync(path.join(dir, "voice", "words.json"), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Words per scene, as seconds from the start of the scene: [{ text, start, end, line, approximate }] for each scene
 * in `timing`. A line's words are offset by where that line begins inside the scene. A scene without voice, a line
 * without word times and bad numbers give nothing for that scene or line. Pure.
 */
export function sceneWords(timing, wordsJson) {
  const byLine = new Map();
  for (const l of wordsJson?.lines ?? [])
    if (l && typeof l.id === "string" && Array.isArray(l.words)) byLine.set(l.id, l);
  return (timing?.scenes ?? []).map((s) => {
    const out = [];
    for (const line of s.lines ?? []) {
      const w = byLine.get(line.id);
      if (!w) continue;
      for (const word of w.words) {
        if (
          typeof word?.text !== "string" ||
          !Number.isFinite(word.start) ||
          !Number.isFinite(word.end)
        )
          continue;
        const start = line.start + word.start;
        out.push({
          text: word.text,
          start: r3(Math.min(start, s.seconds)),
          end: r3(Math.min(Math.max(line.start + word.end, start), s.seconds)),
          line: line.id,
          approximate: Boolean(w.approximate),
        });
      }
    }
    return out;
  });
}
