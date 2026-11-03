#!/usr/bin/env node
// Uses the user's own recording as the narration: the whole recording is transcribed once with whisper.cpp, the
// script's words are matched to what was heard, and the audio is cut into one WAV per script line
// (voice/<id>.wav) with word times, so every later step (timing, captions, kinetic type) works as with a
// synthetic voice. Local only: the recording is never uploaded and nothing is downloaded.
// Consent: say whose voice it is. `--speaker self`, or `--speaker other --consent <file>` (a file recording that
// person's consent). Without one of them nothing is written.
// The recording is one read-through of script.md, lines in order. A line whisper cannot find is reported by id
// and nothing is written, so a half-matched recording never becomes a video.
// Usage: node recorded.mjs <project-dir> --file <recording> --speaker self|other [--consent <file>] [--model <ggml>]
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  alignToScript,
  configuredModel,
  normWord,
  parseWhisperJson,
  splitWords,
  whisperArgs,
} from "./align.mjs";
import { wavSeconds } from "./providers.mjs";
import { run as defaultRun } from "./run.mjs";
import { parseScript } from "./script-parse.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const r3 = (n) => Math.round(n * 1000) / 1000;
const sha = (data) => createHash("sha256").update(data).digest("hex");
const MEDIA = /\.(wav|mp3|m4a|aac|flac|ogg|opus|mp4|mov|mkv|webm)$/i;

/** Seconds kept before the first word and after the last word of a line when it is cut out. */
export const PAD_BEFORE = 0.15;
export const PAD_AFTER = 0.3;
/** A line needs at least this share of its words found in the recording. */
export const MIN_LINE_MATCH = 0.6;

/** The recording's path if it is a plain local media file name; throws otherwise (no URLs, no `-` names). */
export function checkRecording(p) {
  if (typeof p !== "string" || !p)
    throw new Error("Give the recording: --file <audio or video file>.");
  if (p.startsWith("-"))
    throw new Error(`Refused "${p.slice(0, 30)}": a name cannot start with "-".`);
  if (/^[A-Za-z][A-Za-z0-9+.-]+:/.test(p) && !/^[A-Za-z]:[\\/]/.test(p))
    throw new Error(`Refused "${p.slice(0, 30)}": URLs and ffmpeg pseudo-files are not files.`);
  if (p.includes("\0") || /[\r\n]/.test(p))
    throw new Error("Refused: the name has control characters.");
  if (!MEDIA.test(p))
    throw new Error(
      `Refused "${path.basename(p)}": use an audio or video file (wav, mp3, m4a, mp4...).`,
    );
  const abs = path.resolve(p);
  if (!existsSync(abs) || !statSync(abs).isFile())
    throw new Error(`The recording ${path.basename(abs)} does not exist.`);
  return abs;
}

/**
 * Why the recording may not be used, or null. Whose voice it is must be said: `speaker` is "self" or "other", and
 * "other" needs a consent file that exists and is not empty. Pure apart from `exists`/`size`.
 */
export function speakerRefusal(
  { speaker, consent },
  exists = existsSync,
  size = (f) => statSync(f).size,
) {
  if (speaker !== "self" && speaker !== "other")
    return "Refused: say whose voice this is: --speaker self (it is your own voice) or --speaker other --consent <file> (the speaker agreed in writing or on tape).";
  if (speaker === "self") return null;
  if (!consent)
    return "Refused: another person's voice needs their consent: pass --consent <file> (a note or recording of them agreeing to this use).";
  if (!exists(consent) || size(consent) === 0)
    return `Refused: consent file "${consent}" does not exist or is empty.`;
  return null;
}

/** Which script words (one flat list) were found in what whisper heard: the same longest-common-subsequence match as the aligner. */
export function matchMask(scriptWords, heard) {
  const a = scriptWords.map(normWord);
  const b = heard.map((h) => normWord(h.text));
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] =
        a[i] && a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Array(a.length).fill(false);
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] && a[i] === b[j]) {
      hit[i++] = true;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return hit;
}

/**
 * Where every script line sits in the recording. `lines` are [{ id, text }], `heard` whisper's words, `total` the
 * recording's length. Returns { lines: [{ id, words (seconds in the recording), found, of, start, end }], matched, of }.
 */
export function locateLines(lines, heard, total) {
  const flat = lines.flatMap((l, k) => splitWords(l.text).map((text) => ({ text, k })));
  const texts = flat.map((w) => w.text);
  const { words } = alignToScript(texts, heard, total);
  const hit = matchMask(texts, heard);
  const out = lines.map((l) => ({ id: l.id, words: [], found: 0, of: 0 }));
  flat.forEach((w, i) => {
    const o = out[w.k];
    o.words.push({ text: words[i].text, start: words[i].start, end: words[i].end });
    o.of++;
    if (hit[i]) o.found++;
  });
  for (const o of out) {
    o.start = o.words[0]?.start ?? 0;
    o.end = o.words.at(-1)?.end ?? 0;
  }
  return { lines: out, matched: hit.filter(Boolean).length, of: hit.length };
}

/**
 * Cut windows [{ id, from, to }] for the located lines: a little air either side of the speech, never overlapping
 * the next line (the gap between two lines is split down the middle) and never outside the recording.
 */
export function planCuts(located, total) {
  return located.map((l, i) => {
    const prev = located[i - 1];
    const next = located[i + 1];
    let from = Math.max(0, l.start - PAD_BEFORE);
    let to = Math.min(total, l.end + PAD_AFTER);
    if (prev) from = Math.max(from, (prev.end + l.start) / 2);
    if (next) to = Math.min(to, (l.end + next.start) / 2);
    return { id: l.id, from: r3(from), to: r3(Math.max(to, from + 0.2)) };
  });
}

/** Lines too poorly found to use: [{ id, found, of }]. */
export const weakLines = (located) =>
  located
    .filter((l) => l.of === 0 || l.found / l.of < MIN_LINE_MATCH)
    .map((l) => ({ id: l.id, found: l.found, of: l.of }));

/** words.json for the cut lines: times relative to each cut's start, measured (never estimated). */
export function wordsJson(located, cuts) {
  return {
    version: 1,
    approximate: false,
    recorded: true,
    lines: located.map((l, i) => ({
      id: l.id,
      seconds: r3(cuts[i].to - cuts[i].from),
      source: "whisper",
      approximate: false,
      words: l.words.map((w) => ({
        text: w.text,
        start: r3(Math.max(0, w.start - cuts[i].from)),
        end: r3(
          Math.min(
            cuts[i].to - cuts[i].from,
            Math.max(w.start - cuts[i].from, w.end - cuts[i].from),
          ),
        ),
      })),
    })),
  };
}

function transcribe({ file, lang, model, run, tmp }) {
  const wav16 = path.join(tmp, "in.wav");
  const conv = run("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-protocol_whitelist",
    "file",
    "-i",
    file,
    "-vn",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    wav16,
  ]);
  if (conv.status !== 0) throw new Error("ffmpeg could not read the recording.");
  const outPrefix = path.join(tmp, "out");
  const r = run("whisper-cli", whisperArgs({ model, wav: wav16, lang, outPrefix }));
  if (r.status !== 0 || !existsSync(`${outPrefix}.json`))
    throw new Error("whisper could not transcribe the recording.");
  return parseWhisperJson(JSON.parse(readFileSync(`${outPrefix}.json`, "utf8")));
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { strings: ["file", "speaker", "consent", "model"] });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const { flags, positional } = parsed;
  if (!positional[0]) {
    console.error(
      "Usage: node recorded.mjs <project-dir> --file <recording> --speaker self|other [--consent <file>] [--model <ggml>]",
    );
    process.exit(2);
  }
  const refusal = speakerRefusal(flags);
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }
  const dir = path.resolve(positional[0]);
  const sfile = path.join(dir, "script.md");
  if (!existsSync(sfile)) {
    console.error(`No script.md in ${dir}.`);
    process.exit(2);
  }
  let file;
  try {
    file = checkRecording(flags.file);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const model = flags.model ?? configuredModel();
  const probe = model && existsSync(model) ? defaultRun("whisper-cli", ["--help"]) : null;
  if (!probe || probe.status !== 0) {
    console.error(
      "whisper.cpp or its model is not available, and a recording cannot be cut without measured word times. Install whisper-cli and a ggml model (see references/engines.md).",
    );
    process.exit(1);
  }
  const vfile = path.join(dir, "video.json");
  const video = existsSync(vfile) ? JSON.parse(readFileSync(vfile, "utf8")) : null;
  const lang = (video?.meta?.lang ?? "en").slice(0, 2);
  const { lines } = parseScript(readFileSync(sfile, "utf8"));
  const tmp = mkdtempSync(path.join(os.tmpdir(), "video-recorded-"));
  try {
    const heard = transcribe({ file, lang, model, run: defaultRun, tmp });
    const probed = defaultRun("ffprobe", [
      "-v",
      "error",
      "-protocol_whitelist",
      "file",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ]);
    const total = Number(String(probed.stdout).trim()) || (heard.at(-1)?.end ?? 0) + 1;
    const found = locateLines(lines, heard, total);
    const weak = weakLines(found.lines);
    if (weak.length) {
      console.error(
        capLines(
          weak.map((w) => `line ${w.id}: found ${w.found} of ${w.of} words`),
          `The recording does not match script.md well enough (${found.matched} of ${found.of} words found). Read the script in order, once through, or fix the lines named here. Nothing was written.`,
        ),
      );
      process.exitCode = 1;
      return;
    }
    const cuts = planCuts(found.lines, total);
    mkdirSync(path.join(dir, "voice"), { recursive: true });
    const manifest = {
      version: 1,
      provider: "recorded",
      voice: "recorded",
      speed: 1,
      seed: 0,
      model: "",
      license: "the speaker's own recording",
      speaker: flags.speaker,
      ...(flags.speaker === "other"
        ? { consentSha256: sha(readFileSync(path.resolve(flags.consent))) }
        : {}),
      source: { name: path.basename(file), sha256: sha(readFileSync(file)), seconds: r3(total) },
      lines: {},
    };
    for (const c of cuts) {
      const out = path.join(dir, "voice", `${c.id}.wav`);
      const r = defaultRun("ffmpeg", [
        "-y",
        "-v",
        "error",
        "-protocol_whitelist",
        "file",
        "-ss",
        String(c.from),
        "-t",
        String(r3(c.to - c.from)),
        "-i",
        file,
        "-vn",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        out,
      ]);
      if (r.status !== 0 || !existsSync(out)) throw new Error(`ffmpeg could not cut line ${c.id}.`);
      const bytes = readFileSync(out);
      manifest.lines[c.id] = {
        file: `voice/${c.id}.wav`,
        key: sha(JSON.stringify(["recorded", c.from, c.to])),
        sha256: sha(bytes),
        seconds: r3(wavSeconds(bytes) ?? c.to - c.from),
      };
    }
    writeFileSync(
      path.join(dir, "voice", "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    writeFileSync(
      path.join(dir, "voice", "words.json"),
      `${JSON.stringify(wordsJson(found.lines, cuts), null, 2)}\n`,
    );
    if (video) {
      video.voice = { provider: "recorded" };
      writeFileSync(vfile, `${JSON.stringify(video, null, 2)}\n`);
    }
    console.log(
      `Cut ${cuts.length} lines from ${path.basename(file)} (${r3(total)} s) into voice/*.wav; ${found.matched} of ${found.of} script words matched; timings measured by whisper.cpp. Speaker: ${flags.speaker === "self" ? "the user" : "another person, consent on file"}. Next: node <video-core>/scripts/timing.mjs ${dir}`,
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (isEntry(import.meta.url)) main();
