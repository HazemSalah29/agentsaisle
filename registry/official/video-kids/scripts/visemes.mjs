#!/usr/bin/env node
// Mouth shapes for a puppet's lip sync: voice/words.json (word times) -> voice/visemes.json. Each word is spelled
// out into mouth shapes (a small English and Arabic letter table, not a phonetic dictionary), spread over the
// word's time with vowels held longer. When the line's WAV file is a plain 16-bit recording, silent stretches
// close the mouth. No network, no models: the same input gives the same output. Reads and writes text and WAV only.
// Usage: node visemes.mjs <project-dir> [--no-audio]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

export const VISEMES = ["rest", "a", "e", "o", "u", "mbp", "fv", "l"];
export const MIN_SHAPE = 0.06;
const r3 = (n) => Math.round(n * 1000) / 1000;

// Shapes that open the mouth are vowels; the rest are consonant shapes.
const VOWEL_SHAPES = new Set(["a", "e", "o", "u"]);

const EN_DIGRAPHS = [
  ["tion", ["e", "o"]],
  ["ough", ["o"]],
  ["igh", ["a", "e"]],
  ["th", ["l"]],
  ["sh", ["e"]],
  ["ch", ["e"]],
  ["ph", ["fv"]],
  ["ck", ["e"]],
  ["wh", ["u"]],
  ["qu", ["u"]],
  ["oo", ["u"]],
  ["ou", ["o", "u"]],
  ["ew", ["u"]],
  ["ee", ["e"]],
  ["ea", ["e"]],
  ["ai", ["a"]],
  ["ay", ["a"]],
  ["oa", ["o"]],
  ["ow", ["o"]],
  ["oi", ["o", "e"]],
  ["oy", ["o", "e"]],
];
const EN_LETTER = {
  a: "a",
  e: "e",
  i: "e",
  o: "o",
  u: "u",
  y: "e",
  m: "mbp",
  b: "mbp",
  p: "mbp",
  f: "fv",
  v: "fv",
  l: "l",
  n: "l",
  t: "l",
  d: "l",
  w: "u",
  r: "u",
  q: "u",
  s: "e",
  z: "e",
  c: "e",
  k: "e",
  g: "e",
  h: "e",
  j: "e",
  x: "e",
};

const AR_HARAKA = { "َ": "a", "ُ": "u", "ِ": "e", "ً": "a", "ٌ": "u", "ٍ": "e" };
const AR_LETTER = {
  ب: "mbp",
  م: "mbp",
  ف: "fv",
  ا: "a",
  أ: "a",
  إ: "e",
  آ: "a",
  ى: "e",
  ي: "e",
  و: "u",
  ؤ: "u",
  ئ: "e",
  ل: "l",
  ن: "l",
  ت: "l",
  د: "l",
  ط: "l",
  ث: "l",
  ذ: "l",
  ظ: "l",
  ر: "l",
  ع: "a",
  ح: "a",
  ه: "a",
  ص: "e",
  س: "e",
  ز: "e",
  ش: "e",
  ج: "e",
  ك: "e",
  ق: "e",
  خ: "e",
  غ: "e",
  ء: "e",
  ض: "e",
};

/** The mouth shapes a written word goes through, in order. Unknown characters are skipped. */
export function wordShapes(word) {
  const out = [];
  const lower = word.toLowerCase().normalize("NFKC");
  if (/[؀-ۿ]/.test(lower)) {
    for (const ch of lower) {
      if (AR_HARAKA[ch]) out.push(AR_HARAKA[ch]);
      else if (AR_LETTER[ch]) out.push(AR_LETTER[ch]);
    }
  } else {
    const text = lower.replace(/[^a-z]/g, "");
    // A silent final "e" after a consonant ("make", "name") adds no mouth shape.
    const body = /[^aeiouy]e$/.test(text) && text.length > 2 ? text.slice(0, -1) : text;
    for (let i = 0; i < body.length;) {
      const hit = EN_DIGRAPHS.find(([g]) => body.startsWith(g, i));
      if (hit) {
        out.push(...hit[1]);
        i += hit[0].length;
      } else {
        const v = EN_LETTER[body[i]];
        if (v) out.push(v);
        i++;
      }
    }
  }
  return out.filter((v, i) => v !== out[i - 1]);
}

/** Events [{ t, v }] for the words of one line (word times in seconds from the start of the line). */
export function lineVisemes(words, seconds, quiet = () => false) {
  const events = [];
  const push = (t, v) => {
    const last = events[events.length - 1];
    if (last && last.v === v) return;
    if (last && last.t === t) last.v = v;
    else events.push({ t: r3(t), v });
  };
  for (const w of words) {
    const shapes = wordShapes(w.text);
    if (!shapes.length) continue;
    const weights = shapes.map((v) => (VOWEL_SHAPES.has(v) ? 2 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    const span = Math.max(0, w.end - w.start);
    let at = w.start;
    shapes.forEach((v, i) => {
      const dur = (weights[i] / total) * span;
      // A shape too short to see is left to the shape before it (the word's first shape always stays).
      if (i === 0 || dur >= MIN_SHAPE || !VOWEL_SHAPES.has(v))
        push(at, quiet(at + dur / 2) ? "rest" : v);
      at += dur;
    });
    push(Math.min(seconds, w.end), "rest");
  }
  if (!events.length || events[0].t > 0) events.unshift({ t: 0, v: "rest" });
  // Merge shapes shorter than MIN_SHAPE into the one before.
  return events.filter((e, i) => {
    const next = events[i + 1];
    return i === 0 || !next || next.t - e.t >= MIN_SHAPE || e.v === "rest";
  });
}

/** Loudness per 20 ms window from a plain 16-bit PCM WAV file (null for any other kind of file). */
export function windowLoudness(buf) {
  if (
    buf.length < 44 ||
    buf.toString("latin1", 0, 4) !== "RIFF" ||
    buf.toString("latin1", 8, 12) !== "WAVE"
  )
    return null;
  let pos = 12;
  let fmt = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("latin1", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === "fmt ")
      fmt = {
        tag: buf.readUInt16LE(pos + 8),
        ch: buf.readUInt16LE(pos + 10),
        rate: buf.readUInt32LE(pos + 12),
        bits: buf.readUInt16LE(pos + 22),
      };
    if (id === "data") {
      if (!fmt || fmt.tag !== 1 || fmt.bits !== 16) return null;
      const frame = fmt.ch * 2;
      const win = Math.max(1, Math.round(fmt.rate * 0.02));
      const end = Math.min(buf.length, pos + 8 + size);
      const out = [];
      for (let p = pos + 8; p + win * frame <= end; p += win * frame) {
        let sum = 0;
        for (let k = 0; k < win; k++) sum += (buf.readInt16LE(p + k * frame) / 32768) ** 2;
        out.push(Math.sqrt(sum / win));
      }
      return { windows: out, step: 0.02 };
    }
    pos += 8 + size + (size % 2);
  }
  return null;
}

/** A predicate that is true where the recording is much quieter than its own speech level. */
export function quietFrom(loud) {
  if (!loud || !loud.windows.length) return () => false;
  const sorted = [...loud.windows].sort((a, b) => a - b);
  const level = sorted[Math.floor(sorted.length * 0.9)];
  const gate = Math.max(0.004, level * 0.08);
  return (t) => {
    const i = Math.min(loud.windows.length - 1, Math.max(0, Math.floor(t / loud.step)));
    return loud.windows[i] < gate;
  };
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2), { booleans: ["no-audio"] });
  const dir = path.resolve(positional[0] ?? ".");
  const file = path.join(dir, "voice", "words.json");
  if (!existsSync(file)) {
    console.error(
      "voice/words.json is missing: run the voice and align steps first (video-voice).",
    );
    process.exit(1);
  }
  const words = JSON.parse(readFileSync(file, "utf8"));
  const lines = {};
  const out = [];
  let gated = 0;
  for (const l of words.lines ?? []) {
    let quiet = () => false;
    const wav = path.join(dir, "voice", `${l.id}.wav`);
    if (!flags["no-audio"] && existsSync(wav)) {
      const loud = windowLoudness(readFileSync(wav));
      if (loud) {
        quiet = quietFrom(loud);
        gated++;
      }
    }
    lines[l.id] = lineVisemes(l.words ?? [], l.seconds ?? 0, quiet);
    out.push(`  ${l.id}: ${lines[l.id].length} mouth changes`);
  }
  writeFileSync(
    path.join(dir, "voice", "visemes.json"),
    JSON.stringify({ approximate: Boolean(words.approximate), lines }, null, 2) + "\n",
  );
  const note = words.approximate
    ? " Word times were estimated, so the mouths are approximate."
    : "";
  console.log(
    capLines(
      out,
      `Wrote voice/visemes.json (${gated} of ${out.length} lines used the audio to close the mouth).${note}`,
    ),
  );
}

if (isEntry(import.meta.url)) main();
