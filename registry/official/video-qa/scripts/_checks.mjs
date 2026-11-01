// Pure parts of the QA checks: they read ffmpeg/ffprobe text and decide. No process is started here.

/** Integrated loudness (LUFS) and true peak (dBTP) from the end of an ebur128 log, or null when absent. */
export function parseEbur128(log) {
  const tail = log.slice(log.lastIndexOf("Summary:"));
  if (!tail.includes("Integrated loudness")) return null;
  const i = tail.match(/I:\s+(-?[\d.]+|-inf)\s+LUFS/);
  const p = tail.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf)\s+dBFS/);
  const num = (m) => (m ? (m[1] === "-inf" ? -Infinity : Number(m[1])) : null);
  return { lufs: num(i), truePeak: num(p) };
}

/** Black stretches: [{ start, end, seconds }] from blackdetect lines. */
export function parseBlack(log) {
  return [
    ...log.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g),
  ].map((m) => ({ start: Number(m[1]), end: Number(m[2]), seconds: Number(m[3]) }));
}

/** Frozen stretches: [{ start, seconds }] from freezedetect lines. */
export function parseFreeze(log) {
  const starts = [...log.matchAll(/freeze_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const durs = [...log.matchAll(/freeze_duration:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  return starts.map((start, i) => ({ start, seconds: durs[i] ?? Infinity }));
}

/** Per-frame values from metadata=print output: [{ t, YMIN, YMAX, YAVG ... }]. */
export function parseSignalstats(text) {
  const frames = [];
  let cur = null;
  for (const line of text.split("\n")) {
    const f = line.match(/^frame:\d+\s+pts:\S+\s+pts_time:([\d.]+)/);
    if (f) frames.push((cur = { t: Number(f[1]) }));
    const kv = line.match(/^lavfi\.signalstats\.(\w+)=(-?[\d.]+)/);
    if (kv && cur) cur[kv[1]] = Number(kv[2]);
  }
  return frames;
}

/**
 * Flash count: a flash is a rise and a fall in average brightness (or the other way round), each at least
 * `change` of full range, one after the other. Returns { worst, at } - the most flashes in any one second.
 * TODO(verify) against the published definition of a general flash.
 */
export function flashes(frames, change = 0.1, range = 255) {
  const swings = [];
  let dir = 0;
  for (let i = 1; i < frames.length; i++) {
    const d = (frames[i].YAVG - frames[i - 1].YAVG) / range;
    if (Math.abs(d) < change) continue;
    const s = Math.sign(d);
    if (dir && s !== dir) swings.push(frames[i].t);
    dir = s;
  }
  let worst = 0;
  let at = 0;
  swings.forEach((t, i) => {
    const n = swings.filter((u) => u >= t && u < t + 1).length;
    if (n > worst) {
      worst = n;
      at = swings[i];
    }
  });
  return { worst, at };
}

/** Relative luminance of #rrggbb (WCAG). */
export function luminance(hex) {
  const v = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  const lin = v.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Leftover placeholders and doubled words in a piece of on-screen or narrated text. */
export function textProblems(text) {
  const out = [];
  const marker = text.match(/\b(TODO|TBD|FIXME|XXX)\b|lorem ipsum|\[needs-source\]|\?\?\?/i);
  if (marker) out.push({ level: "fail", text: `leftover placeholder "${marker[0]}"` });
  const twice = text.match(/\b([A-Za-z]{2,})\s+\1\b/i);
  if (twice) out.push({ level: "warn", text: `the word "${twice[1]}" is doubled` });
  return out;
}

/** Contact-sheet times: one per scene (at 70% of it) plus every 2 s from 1 s, sorted, at most `max`. */
export function sheetTimes(timing, max = 24) {
  const set = new Set();
  for (const s of timing.scenes) set.add(Math.round((s.start + s.seconds * 0.7) * 100) / 100);
  for (let t = 1; t < timing.totalSeconds; t += 2) set.add(t);
  const all = [...set].filter((t) => t < timing.totalSeconds).sort((a, b) => a - b);
  if (all.length <= max) return all;
  const keep = new Set(
    timing.scenes.map((s) => Math.round((s.start + s.seconds * 0.7) * 100) / 100),
  );
  const rest = all.filter((t) => !keep.has(t));
  const room = Math.max(0, max - keep.size);
  const step = rest.length / Math.max(1, room);
  const picked = Array.from({ length: room }, (_, i) => rest[Math.floor(i * step)]);
  return [...keep, ...picked].sort((a, b) => a - b).slice(0, max);
}
