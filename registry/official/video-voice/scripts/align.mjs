#!/usr/bin/env node
// Word timings for every voiced line -> voice/words.json. Uses whisper.cpp when it and a model are installed:
// the audio is transcribed, then the script's own words are matched to what whisper heard, so the text is always
// the script's. Without whisper (or when it fails on a line) the words are spread over the line's audio by
// letter count and marked approximate. Times in words.json are seconds from the start of each line's audio.
// Usage: node align.mjs <project-dir> [--engine auto|whisper|estimate] [--model path-to-ggml-model]
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { wavSeconds } from "./providers.mjs";
import { run as defaultRun } from "./run.mjs";
import { parseScript } from "./script-parse.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const r3 = (n) => Math.round(n * 1000) / 1000;

/** Comparison form of a word: lower case, no punctuation, Arabic diacritics and tatweel removed. */
export const normWord = (w) =>
  w
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[ـً-ٰٟ]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

/** Words of a line as written, split on spaces. */
export const splitWords = (text) => text.trim().split(/\s+/).filter(Boolean);

/** Spread the words over `seconds` by letter count, with extra weight after sentence and clause ends. */
export function estimateWords(text, seconds) {
  const words = splitWords(text);
  const weight = (w) =>
    Math.max(1, normWord(w).length) + (/[.!?؟]$/.test(w) ? 3 : /[,;:،؛]$/.test(w) ? 1.5 : 0);
  const total = words.reduce((s, w) => s + weight(w), 0) || 1;
  let at = 0;
  return words.map((w) => {
    const start = at;
    at += (weight(w) / total) * seconds;
    return { text: w, start: r3(start), end: r3(Math.min(at, seconds)) };
  });
}

/** whisper-cli arguments. The one place that knows its flags (`TODO(verify)` against the installed build). */
export const whisperArgs = ({ model, wav, lang, outPrefix }) => [
  "-m",
  model,
  "-f",
  wav,
  "-l",
  lang,
  "-ml",
  "1",
  "-sow",
  "-oj",
  "-of",
  outPrefix,
];

/** Words (seconds) from whisper.cpp JSON: one entry per word with `-ml 1`; pieces without a leading space join. */
export function parseWhisperJson(json) {
  const out = [];
  for (const e of json?.transcription ?? []) {
    const text = String(e.text ?? "");
    if (/^\s*[[(].*[\])]\s*$/.test(text) || !text.trim()) continue;
    const from = (e.offsets?.from ?? 0) / 1000;
    const to = (e.offsets?.to ?? 0) / 1000;
    if (out.length && !/^\s/.test(text)) {
      const last = out[out.length - 1];
      last.text += text;
      last.end = to;
    } else out.push({ text: text.trim(), start: from, end: to });
  }
  return out;
}

/**
 * Give each script word the time of the whisper word it matches (longest common subsequence of normalised
 * words); words whisper missed are spread between their matched neighbours. Returns { words, matched }.
 */
export function alignToScript(scriptWords, heard, seconds) {
  const a = scriptWords.map(normWord);
  const b = heard.map((h) => normWord(h.text));
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] =
        a[i] && a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Array(a.length).fill(null);
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] && a[i] === b[j]) hit[i++] = heard[j++];
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const matched = hit.filter(Boolean).length;
  const words = scriptWords.map((text, i) => ({
    text,
    start: hit[i]?.start ?? null,
    end: hit[i]?.end ?? null,
  }));
  // fill runs of unmatched words between known neighbours
  for (let i = 0; i < words.length;) {
    if (words[i].start !== null) {
      i++;
      continue;
    }
    let j = i;
    while (j < words.length && words[j].start === null) j++;
    const from = i > 0 ? words[i - 1].end : 0;
    const to = j < words.length ? words[j].start : seconds;
    const span = Math.max(0, to - from) / (j - i);
    for (let k = i; k < j; k++) {
      words[k].start = from + span * (k - i);
      words[k].end = from + span * (k - i + 1);
    }
    i = j;
  }
  for (const w of words) {
    w.start = r3(Math.max(0, Math.min(w.start, seconds)));
    w.end = r3(Math.max(w.start, Math.min(w.end, seconds)));
  }
  return { words, matched };
}

/**
 * Align one line. `engine` is null (estimate) or { model, run, convert(wav) -> { wav16, cleanup } }.
 * Returns { words, source, approximate, note? }.
 */
export function alignLine({ text, wavFile, seconds, lang, engine, tmp = os.tmpdir() }) {
  const estimate = (note) => ({
    words: estimateWords(text, seconds),
    source: "estimate",
    approximate: true,
    ...(note ? { note } : {}),
  });
  if (!engine) return estimate();
  const dir = mkdtempSync(path.join(tmp, "video-align-"));
  try {
    const wav16 = path.join(dir, "in.wav");
    const conv = engine.run("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-i",
      wavFile,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      wav16,
    ]);
    if (conv.status !== 0) return estimate("ffmpeg could not convert the audio");
    const outPrefix = path.join(dir, "out");
    const r = engine.run(
      "whisper-cli",
      whisperArgs({ model: engine.model, wav: wav16, lang: lang.slice(0, 2), outPrefix }),
    );
    if (r.status !== 0 || !existsSync(`${outPrefix}.json`))
      return estimate("whisper failed on this line");
    const heard = parseWhisperJson(JSON.parse(readFileSync(`${outPrefix}.json`, "utf8")));
    const scriptWords = splitWords(text);
    const { words, matched } = alignToScript(scriptWords, heard, seconds);
    if (matched < Math.ceil(scriptWords.length / 2))
      return estimate("whisper heard too little of this line");
    return { words, source: "whisper", approximate: false };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Where tools.json says the whisper model is, if anywhere. */
export function configuredModel(home = os.homedir()) {
  try {
    const m = JSON.parse(
      readFileSync(path.join(home, ".aisle-video", "tools.json"), "utf8"),
    )?.whisperModel;
    return typeof m === "string" && path.isAbsolute(m) ? m : null;
  } catch {
    return null;
  }
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { strings: ["engine", "model"] });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const { flags, positional } = parsed;
  if (!positional[0] || !["auto", "whisper", "estimate", undefined].includes(flags.engine)) {
    console.error(
      "Usage: node align.mjs <project-dir> [--engine auto|whisper|estimate] [--model path]",
    );
    process.exit(2);
  }
  const dir = path.resolve(positional[0]);
  const sfile = path.join(dir, "script.md");
  if (!existsSync(sfile)) {
    console.error(`No script.md in ${dir}.`);
    process.exit(2);
  }
  const vfile = path.join(dir, "video.json");
  const lang = existsSync(vfile)
    ? (JSON.parse(readFileSync(vfile, "utf8")).meta?.lang ?? "en")
    : "en";
  const { lines } = parseScript(readFileSync(sfile, "utf8"));
  const want = flags.engine ?? "auto";
  let engine = null;
  if (want !== "estimate") {
    const model = flags.model ?? configuredModel();
    const probe = model && existsSync(model) ? defaultRun("whisper-cli", ["--help"]) : null;
    if (probe && probe.status === 0) engine = { model, run: defaultRun };
    else if (want === "whisper") {
      console.error(
        "whisper.cpp or its model is not available. Install whisper-cli and a ggml model (see references/engines.md), or use --engine estimate.",
      );
      process.exit(1);
    }
  }
  const out = { version: 1, approximate: false, lines: [] };
  const notes = [];
  const missing = [];
  for (const l of lines) {
    const wavFile = path.join(dir, "voice", `${l.id}.wav`);
    if (!existsSync(wavFile)) {
      missing.push(l.id);
      continue;
    }
    const seconds = r3(wavSeconds(readFileSync(wavFile)) ?? 0);
    const r = alignLine({ text: l.text, wavFile, seconds, lang, engine });
    if (r.note) notes.push(`${l.id}: ${r.note}`);
    out.lines.push({
      id: l.id,
      seconds,
      source: r.source,
      approximate: r.approximate,
      words: r.words,
    });
  }
  if (missing.length) {
    console.error(
      capLines(
        missing.map((id) => `missing voice/${id}.wav`),
        `${missing.length} voice file(s) missing; run voice.mjs first.`,
      ),
    );
    process.exit(1);
  }
  out.approximate = out.lines.some((l) => l.approximate);
  mkdirSync(path.join(dir, "voice"), { recursive: true });
  writeFileSync(path.join(dir, "voice", "words.json"), `${JSON.stringify(out, null, 2)}\n`);
  const words = out.lines.reduce((s, l) => s + l.words.length, 0);
  console.log(
    capLines(
      notes.map((n) => `note: ${n}`),
      `Wrote voice/words.json: ${out.lines.length} lines, ${words} words, ${out.approximate ? "APPROXIMATE timings (estimated, not measured)" : "timings from whisper.cpp"}.`,
    ),
  );
}

if (isEntry(import.meta.url)) main();
