#!/usr/bin/env node
// Turns voice/words.json + timing.json into caption groups (captions.json) and subtitle files (.srt, .vtt).
// Groups never leave a single word alone on a line (unless a line is one word long), break at sentence ends and
// long pauses, and respect the platform safe zone. How they look is data: a style from assets/styles.json,
// adjusted by brand.json and the captions block of video.json. video-core draws them in the browser engine,
// so Arabic letters join properly.
// Usage: node captions.mjs <project-dir> [--style karaoke|pop|clean|kids] [--max-words 4] [--burn|--srt|--both]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";

const r3 = (n) => Math.round(n * 1000) / 1000;
const SENTENCE_END = /[.!?؟…]$/;
const CLAUSE_END = /[,;:،؛]$/;
const PAUSE = 0.35; // seconds of silence that starts a new caption
const HOLD = 0.2; // seconds a caption stays after its last word

export const loadStyles = () =>
  JSON.parse(readFileSync(path.join(skillDir(), "assets", "styles.json"), "utf8"));
export const STYLE_NAMES = ["karaoke", "pop", "clean", "kids"];

/**
 * Split n items into groups of at most `max`, as even as possible (sizes differ by at most one) and never a
 * group of one (unless n is 1). With max 2 and an odd n that means one group of 3.
 */
export function evenSizes(n, max) {
  const k = Math.max(1, Math.min(Math.ceil(n / max), Math.floor(n / 2)));
  const base = Math.floor(n / k);
  const extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Caption groups for one line's words ({ text, start, end } in absolute seconds).
 * Segments break at sentence ends and long pauses; one-word segments join the next (or previous) one; each
 * segment is then cut into even groups of at most `max` words.
 */
export function groupWords(words, max = 4) {
  if (!words.length) return [];
  const segs = [[]];
  words.forEach((w, i) => {
    segs.at(-1).push(w);
    const next = words[i + 1];
    if (
      next &&
      (SENTENCE_END.test(w.text) ||
        next.start - w.end >= PAUSE ||
        (CLAUSE_END.test(w.text) && segs.at(-1).length >= 2))
    )
      segs.push([]);
  });
  for (let i = 0; i < segs.length && segs.length > 1;) {
    if (segs[i].length > 1) {
      i++;
      continue;
    }
    if (i + 1 < segs.length) segs.splice(i, 2, [...segs[i], ...segs[i + 1]]);
    else segs.splice(i - 1, 2, [...segs[i - 1], ...segs[i]]);
  }
  return segs.flatMap((seg) => {
    let at = 0;
    return evenSizes(seg.length, max).map((n) => seg.slice(at, (at += n)));
  });
}

/** The caption look: style defaults, then brand.json `captions`, then video.json `captions`. */
export function resolveStyle({ styles, name, brand = {}, overrides = {}, format }) {
  const vertical = /9x16/.test(format);
  const base = styles[name];
  if (!base) throw new Error(`Unknown caption style "${name}" (have: ${STYLE_NAMES.join(", ")}).`);
  const merged = { ...base, ...pick(brand.captions), ...pick(overrides) };
  const notes = [];
  if (vertical && merged.size < styles.minSizeVertical) {
    notes.push(
      `size ${merged.size} is below ${styles.minSizeVertical} of the frame height on 9:16; raised`,
    );
    merged.size = styles.minSizeVertical;
  }
  return { style: { name, ...merged }, notes };
}
const pick = (o = {}) =>
  Object.fromEntries(
    ["size", "weight", "uppercase", "stroke", "background"]
      .filter((k) => o[k] !== undefined)
      .map((k) => [k, o[k]]),
  );

const dirOf = (video) =>
  video.meta.dir ?? (/^(ar|he|fa|ur)\b/.test(video.meta.lang) ? "rtl" : "ltr");

/**
 * captions.json from words.json and timing.json. Lines belonging to a scene with `captions: "off"` are skipped.
 */
export function buildCaptions({ video, words, timing, styles, brand, name, max }) {
  const cfg = video.captions ?? {};
  const style = name ?? cfg.style ?? brand?.captions?.style ?? "karaoke";
  const maxWords =
    max ?? cfg.maxWordsPerLine ?? brand?.captions?.maxWordsPerLine ?? styles[style]?.maxWords ?? 4;
  const safeZone = cfg.safeZone ?? (/16x9/.test(video.meta.format) ? "youtube" : "reel");
  const byLine = new Map(words.lines.map((l) => [l.id, l]));
  const groups = [];
  const skipped = [];
  video.scenes.forEach((s, i) => {
    const t = timing.scenes[i];
    for (const tl of t.lines) {
      if (s.captions === "off") continue;
      const wl = byLine.get(tl.id);
      if (!wl) {
        skipped.push(tl.id);
        continue;
      }
      const at = t.start + tl.start;
      const abs = wl.words.map((w) => ({
        text: w.text,
        start: r3(at + w.start),
        end: r3(at + w.end),
      }));
      for (const g of groupWords(abs, maxWords))
        groups.push({ scene: s.id, line: tl.id, words: g });
    }
  });
  groups.sort((a, b) => a.words[0].start - b.words[0].start);
  const sceneEnd = new Map(
    video.scenes.map((s, i) => [s.id, timing.scenes[i].start + timing.scenes[i].seconds]),
  );
  groups.forEach((g, i) => {
    g.id = `c${i + 1}`;
    g.start = g.words[0].start;
    const next = groups[i + 1]?.words[0].start ?? Infinity;
    g.end = r3(
      Math.max(g.start + 0.1, Math.min(g.words.at(-1).end + HOLD, next, sceneEnd.get(g.scene))),
    );
  });
  const { style: resolved, notes } = resolveStyle({
    styles,
    name: style,
    brand,
    overrides: cfg,
    format: video.meta.format,
  });
  const out = {
    version: 1,
    lang: video.meta.lang,
    dir: dirOf(video),
    format: video.meta.format,
    fps: timing.fps,
    approximate: words.approximate === true,
    maxWordsPerLine: maxWords,
    safeZone: { name: safeZone, ...styles.safeZones[safeZone] },
    style: resolved,
    groups: groups.map(({ id, start, end, words: w }) => ({ id, start, end, words: w })),
  };
  return { captions: out, notes, skipped };
}

const stamp = (sec, sep) => {
  const ms = Math.round(sec * 1000);
  const p = (n, w) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000), 2)}:${p(Math.floor(ms / 60000) % 60, 2)}:${p(Math.floor(ms / 1000) % 60, 2)}${sep}${p(ms % 1000, 3)}`;
};
const cueText = (g) =>
  g.words
    .map((w) => w.text)
    .join(" ")
    .replace(/-->/g, "→")
    .replace(/\s*\n\s*/g, " ");

/** SubRip text. */
export const toSrt = (c) =>
  c.groups
    .map((g, i) => `${i + 1}\n${stamp(g.start, ",")} --> ${stamp(g.end, ",")}\n${cueText(g)}\n`)
    .join("\n");
/** WebVTT text. */
export const toVtt = (c) =>
  `WEBVTT\n\n${c.groups.map((g) => `${g.id}\n${stamp(g.start, ".")} --> ${stamp(g.end, ".")}\n${cueText(g).replace(/&/g, "&amp;").replace(/</g, "&lt;")}\n`).join("\n")}`;

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      booleans: ["burn", "srt", "both"],
      strings: ["style", "max-words"],
    });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const { flags, positional } = parsed;
  if (!positional[0] || [flags.burn, flags.srt, flags.both].filter(Boolean).length > 1) {
    console.error(
      "Usage: node captions.mjs <project-dir> [--style karaoke|pop|clean|kids] [--max-words 4] [--burn|--srt|--both]",
    );
    process.exit(2);
  }
  const dir = path.resolve(positional[0]);
  const need = (f, hint) => {
    if (!existsSync(path.join(dir, f))) {
      console.error(`Missing ${f}. ${hint}`);
      process.exit(2);
    }
    return JSON.parse(readFileSync(path.join(dir, f), "utf8"));
  };
  const video = need("video.json", "Run the storyboard step first.");
  const timing = need("timing.json", "Run timing.mjs first.");
  const words = need("voice/words.json", "Run voice.mjs and align.mjs first.");
  let brand = {};
  if (video.meta.brand && existsSync(path.join(dir, video.meta.brand)))
    brand = JSON.parse(readFileSync(path.join(dir, video.meta.brand), "utf8"));
  const max = flags["max-words"] === undefined ? undefined : Number(flags["max-words"]);
  if (max !== undefined && !(Number.isInteger(max) && max >= 2 && max <= 8)) {
    console.error("--max-words must be a whole number from 2 to 8.");
    process.exit(2);
  }
  if (flags.style && !STYLE_NAMES.includes(flags.style)) {
    console.error(`Unknown caption style "${flags.style}" (have: ${STYLE_NAMES.join(", ")}).`);
    process.exit(2);
  }
  const { captions, notes, skipped } = buildCaptions({
    video,
    words,
    timing,
    styles: loadStyles(),
    brand,
    name: flags.style,
    max,
  });
  writeFileSync(path.join(dir, "captions.json"), `${JSON.stringify(captions, null, 2)}\n`);
  writeFileSync(path.join(dir, "captions.srt"), toSrt(captions));
  writeFileSync(path.join(dir, "captions.vtt"), toVtt(captions));
  video.captions = {
    ...video.captions,
    style: captions.style.name,
    maxWordsPerLine: captions.maxWordsPerLine,
    safeZone: captions.safeZone.name,
    burn: !flags.srt,
  };
  writeFileSync(path.join(dir, "video.json"), `${JSON.stringify(video, null, 2)}\n`);
  const extra = [
    ...notes,
    ...(skipped.length ? [`no word times for ${skipped.join(", ")}`] : []),
    ...(captions.approximate
      ? ["word times are ESTIMATED (no whisper): captions may drift from the voice"]
      : []),
  ];
  console.log(
    capLines(
      extra.map((n) => `note: ${n}`),
      `Wrote captions.json, captions.srt, captions.vtt: ${captions.groups.length} captions, style ${captions.style.name}, ${captions.dir}, ${video.captions.burn ? "burned into the render" : "subtitle files only"}.`,
    ),
  );
}

if (isEntry(import.meta.url)) main();
