// The planner behind `cut`: speech spans in, an edit decision list out. Pure; it reads no file and runs nothing.
// A span is { text, start, end } in seconds (a word from whisper, or a stretch of sound between silences).
import { encode, input } from "./ffwrap.mjs";

const r3 = (n) => Math.round(n * 1000) / 1000;
// Escapes inside a string, so no Arabic mark or bidi character has to sit in this file.
const MARKS = new RegExp("[\\u064B-\\u065F\\u0670\\u0640]", "g");

/** A word as compared against the filler list: no case, no punctuation, no Arabic diacritics or tatweel. */
export const normalizeWord = (t) =>
  String(t ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(MARKS, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** The filler set for a language: the defaults, plus the optional ones named in `extra` (comma list or "all"). */
export function fillerSet(file, lang, extra) {
  const base = (file[lang] ?? []).map(normalizeWord);
  const optional = (file.optional?.[lang] ?? []).map(normalizeWord);
  const asked = String(extra ?? "")
    .split(",")
    .map(normalizeWord)
    .filter(Boolean);
  const more = asked.includes("all") ? optional : asked;
  return new Set([...base, ...more]);
}

/**
 * Plan the cut. Pauses longer than `pause` shrink to `breath` seconds; fillers are removed; the clip starts
 * `lead` s before the first word and ends `tail` s after the last. Returns { keeps, removed, ... }.
 */
export function buildCutPlan(
  spans,
  { duration, pause = 0.35, breath = 0.12, lead = 0.05, tail = 0.25, fillers = new Set() },
) {
  if (!(duration > 0)) throw new Error("The clip has no length.");
  if (!(pause >= 0.15 && pause <= 3)) throw new Error("--pause must be from 0.15 to 3 seconds.");
  if (!(breath >= 0 && breath < pause))
    throw new Error("--breath must be at least 0 and less than --pause.");
  const clean = spans
    .map((s) => ({ text: String(s.text ?? ""), start: Number(s.start), end: Number(s.end) }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .sort((a, b) => a.start - b.start);
  const isFiller = (s) => s.text !== "" && fillers.has(normalizeWord(s.text));
  const speech = clean.filter((s) => !isFiller(s));
  const filler = clean.filter(isFiller);
  if (!speech.length) throw new Error("No speech found, so there is nothing to keep.");

  const removed = [];
  const cut = (start, end, kind, text) => {
    if (end - start > 0.02)
      removed.push({ start: r3(start), end: r3(end), kind, ...(text ? { text } : {}) });
  };
  const inside = (a, b) => filler.filter((f) => f.start >= a - 0.001 && f.end <= b + 0.001);
  const first = speech[0];
  const last = speech[speech.length - 1];
  if (first.start > pause) cut(0, first.start - lead, "pause");
  if (duration - last.end > tail + 0.05) cut(last.end + tail, duration, "pause");
  for (let i = 0; i + 1 < speech.length; i++) {
    const a = speech[i].end;
    const b = speech[i + 1].start;
    const fs = inside(a, b);
    if (b - a > pause) {
      // The zone leaves a half breath after each word, but always covers a filler that sits in the gap whole.
      const from = Math.min(a + breath / 2, ...fs.map((x) => x.start));
      const to = Math.max(b - breath / 2, ...fs.map((x) => x.end));
      if (fs.length) cut(from, to, "filler", fs.map((x) => x.text.trim()).join(" "));
      else cut(from, to, "pause");
    } else for (const f of fs) cut(f.start, f.end, "filler", f.text.trim());
  }
  removed.sort((x, y) => x.start - y.start);
  const keeps = [];
  let at = 0;
  for (const r of removed) {
    if (r.start - at >= 0.04) keeps.push({ start: r3(at), end: r.start });
    at = Math.max(at, r.end);
  }
  if (duration - at >= 0.04) keeps.push({ start: r3(at), end: r3(duration) });
  const after = r3(keeps.reduce((n, k) => n + (k.end - k.start), 0));
  return {
    version: 1,
    settings: { pause, breath, lead, tail },
    removed,
    keeps,
    seconds: { before: r3(duration), after, saved: r3(duration - after) },
    counts: {
      pauses: removed.filter((r) => r.kind === "pause").length,
      fillers: removed.filter((r) => r.kind === "filler").length,
    },
  };
}

/**
 * ffmpeg arguments that render a plan: each kept stretch is trimmed, its sound faded in and out over 10 ms so
 * joins do not click, and all are joined in order. The picture and the sound are cut at the same times.
 */
export function cutArgs({ file, out, keeps, best }, info) {
  if (!keeps.length) throw new Error("The plan keeps nothing.");
  if (keeps.length > 400) throw new Error("More than 400 cuts; raise --pause so there are fewer.");
  const fade = 0.01;
  const parts = keeps.map((k, i) => {
    const len = r3(k.end - k.start);
    const v = `[0:v]trim=start=${k.start}:end=${k.end},setpts=PTS-STARTPTS[v${i}]`;
    const f = Math.min(fade, len / 2);
    const a = info.audio
      ? `;[0:a]atrim=start=${k.start}:end=${k.end},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${f},afade=t=out:st=${r3(len - f)}:d=${f}[a${i}]`
      : "";
    return v + a;
  });
  const labels = keeps.map((_, i) => `[v${i}]${info.audio ? `[a${i}]` : ""}`).join("");
  const graph = `${parts.join(";")};${labels}concat=n=${keeps.length}:v=1:a=${info.audio ? 1 : 0}[v]${info.audio ? "[a]" : ""}`;
  return [
    ...input(file),
    "-filter_complex",
    graph,
    "-map",
    "[v]",
    ...(info.audio ? ["-map", "[a]"] : []),
    ...encode({ best, audio: info.audio }),
    "-y",
    out,
  ];
}

/** silencedetect arguments: stretches quieter than `noiseDb` for at least `pause` seconds. */
export function silenceArgs({ file, pause = 0.35, noiseDb = -35 }) {
  return [
    ...input(file),
    "-vn",
    "-af",
    `silencedetect=noise=${noiseDb}dB:d=${pause}`,
    "-f",
    "null",
    "-",
  ];
}

/** Silences [{ start, end }] from silencedetect's log; one that never ended runs to `duration`. */
export function parseSilence(log, duration) {
  const out = [];
  let open = null;
  for (const m of log.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    if (m[1] === "start") open = Math.max(0, Number(m[2]));
    else if (open !== null) {
      out.push({ start: open, end: Number(m[2]) });
      open = null;
    }
  }
  if (open !== null) out.push({ start: open, end: duration });
  return out;
}

/** The stretches of sound between silences, as spans with no text. */
export function speechSpans(silences, duration) {
  const spans = [];
  let at = 0;
  for (const s of silences) {
    if (s.start - at > 0.05) spans.push({ text: "", start: r3(at), end: r3(s.start) });
    at = Math.max(at, s.end);
  }
  if (duration - at > 0.05) spans.push({ text: "", start: r3(at), end: r3(duration) });
  return spans;
}

/** Words from a words.json: a list of { text, start, end } (what `transcribe` writes), validated. */
export function readWords(raw) {
  const list = Array.isArray(raw) ? raw : raw?.words;
  if (!Array.isArray(list) || !list.length)
    throw new Error("The words file must be a list of { text, start, end }.");
  list.forEach((w, i) => {
    if (
      typeof w?.text !== "string" ||
      !Number.isFinite(w.start) ||
      !Number.isFinite(w.end) ||
      w.end < w.start
    )
      throw new Error(`Word ${i + 1} needs text, start and end (seconds, end not before start).`);
  });
  return list;
}
