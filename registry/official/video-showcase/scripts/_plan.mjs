// From the interaction log to the `screen` scene: which parts of the recording to cut or speed up, where the
// camera looks and when, where the cursor goes and when it clicks. Pure and deterministic: the same log and
// options give the same result. Log times are seconds in the recording; every time in the result is in the
// edited film (after cuts and speed-ups). Coordinates are fractions (0 to 1) of the recording.
export const DEFAULTS = {
  maxIdle: 1.2, // idle stretches longer than this are cut down
  keepIdle: 0.5, // ... to this much
  typeSpeed: 3, // typing plays this many times faster
  lead: 0.5, // the camera starts moving this long before the action
  zoomDur: 0.8,
  holdAfter: 0.8, // the camera stays this long after the action before easing out
  outGap: 2.5, // ease back out only when the next action is at least this far away
  minScale: 1.4,
  maxScale: 2.4,
  moveDur: 0.6, // longest cursor move
  fps: 30,
};
const r3 = (n) => Math.round(n * 1000) / 1000;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (u) => u * u * (3 - 2 * u);
const SAMPLES = 6;
const POINT = ["click", "hover", "type", "go"];

/** Problems with an interaction log, as strings (empty when it can be planned). */
export function logProblems(log) {
  if (!log || typeof log !== "object" || !Array.isArray(log.events))
    return ["events: a list is needed"];
  const out = [];
  if (!(log.duration > 0)) out.push("duration: seconds of the recording are needed");
  const vp = log.viewport;
  if (!vp || !(vp.w > 0) || !(vp.h > 0)) out.push("viewport: {w, h} is needed");
  let prev = -1;
  log.events.forEach((e, i) => {
    if (
      !e ||
      typeof e.t !== "number" ||
      !Number.isFinite(e.t) ||
      e.t < 0 ||
      e.t > (log.duration ?? 0) + 0.5
    )
      return void out.push(`events[${i}].t: a time inside the recording is needed`);
    if (e.t < prev) out.push(`events[${i}].t: events must be in time order`);
    prev = e.t;
    for (const k of ["x", "y"])
      if (e[k] !== undefined && !(e[k] >= 0 && e[k] <= 1)) out.push(`events[${i}].${k}: 0 to 1`);
    if (e.end !== undefined && !(e.end >= e.t)) out.push(`events[${i}].end: not before t`);
  });
  if (log.events.length > 200) out.push("events: at most 200");
  return out;
}

/** The segments of the recording to keep: [{ from, to, speed }] in source seconds. */
export function segmentsFor(log, o = DEFAULTS) {
  const D = log.duration;
  const busy = [];
  const fast = [];
  for (const e of log.events) {
    if (e.kind === "wait" || e.kind === "say") continue;
    const end = e.end ?? e.t;
    busy.push([Math.max(0, e.t - 0.3), Math.min(D, end + 0.5)]);
    if (e.kind === "type" && end - e.t > 0.2) fast.push([e.t, end]);
  }
  busy.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const b of busy) {
    const last = merged.at(-1);
    if (last && b[0] <= last[1]) last[1] = Math.max(last[1], b[1]);
    else merged.push([...b]);
  }
  const gaps = [];
  let cur = 0;
  for (const [a, b] of merged) {
    if (a > cur) gaps.push([cur, a]);
    cur = b;
  }
  if (cur < D) gaps.push([cur, D]);
  const cuts = new Set([0, D]);
  for (const [a, b] of [...merged, ...fast, ...gaps]) {
    cuts.add(r3(a));
    cuts.add(r3(b));
  }
  for (const [a, b] of gaps)
    if (r3(b - a) > o.maxIdle) {
      cuts.add(r3(a + o.keepIdle / 2));
      cuts.add(r3(b - o.keepIdle / 2));
    }
  const pts = [...cuts].filter((t) => t >= 0 && t <= D).sort((a, b) => a - b);
  const within = (list, m) => list.find(([a, b]) => m >= a && m < b);
  const segs = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    if (b - a < 1e-6) continue;
    const m = (a + b) / 2;
    let keep = true;
    let speed = 1;
    if (within(fast, m)) speed = o.typeSpeed;
    else if (!within(merged, m)) {
      const g = within(gaps, m);
      if (g && r3(g[1] - g[0]) > o.maxIdle)
        keep = m < g[0] + o.keepIdle / 2 || m > g[1] - o.keepIdle / 2;
    }
    if (!keep || (b - a) / speed < 0.5 / o.fps) continue;
    const last = segs.at(-1);
    if (last && last.speed === speed && Math.abs(last.to - a) < 1e-6) last.to = b;
    else segs.push({ from: a, to: b, speed });
  }
  return segs;
}

/** Edited-film time for a recording time (a time inside a cut part maps to the cut point). */
export function retimer(segs) {
  return (t) => {
    let acc = 0;
    for (const s of segs) {
      if (t <= s.from) return r3(acc);
      if (t < s.to) return r3(acc + (t - s.from) / s.speed);
      acc += (s.to - s.from) / s.speed;
    }
    return r3(acc);
  };
}

const posOf = (e) => (typeof e.x === "number" && typeof e.y === "number" ? [e.x, e.y] : null);

/** Plan the whole scene. Returns { seconds, segments, says, props: { viewport, zoom, cursor, ripples } }. */
export function planShowcase(log, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const problems = logProblems(log);
  if (problems.length) throw new Error(`The interaction log cannot be planned: ${problems[0]}`);
  const segments = segmentsFor(log, o);
  const at = retimer(segments);
  const seconds = at(log.duration);

  const says = {};
  for (const e of log.events) if (e.kind === "say" && e.id && !(e.id in says)) says[e.id] = at(e.t);

  // Camera: one move per action that has a target, easing back out when the next action is far away.
  const focus = log.events.filter((e) => ["click", "type", "hover"].includes(e.kind) && posOf(e));
  const zoom = [];
  let prevEnd = 0;
  let view = { x: 0.5, y: 0.5, scale: 1 };
  const push = (z) => {
    const start = Math.max(prevEnd, z.at);
    const dur = Math.min(z.dur, seconds - start);
    if (dur < 0.3) return false;
    zoom.push({ at: r3(start), dur: r3(dur), x: r3(z.x), y: r3(z.y), scale: r3(z.scale) });
    prevEnd = start + dur;
    view = { x: z.x, y: z.y, scale: z.scale };
    return true;
  };
  focus.forEach((e, i) => {
    const size = Math.max(e.w ?? 0.1, e.h ?? 0.05);
    const te = at(e.t);
    const done = at(e.end ?? e.t);
    if (size <= 0.5) {
      const scale = clamp(0.4 / Math.max(size, 0.01), o.minScale, o.maxScale);
      const near =
        view.scale > 1 &&
        Math.hypot(view.x - e.x, view.y - e.y) < 0.06 &&
        Math.abs(view.scale - scale) < 0.2;
      if (!near) push({ at: te - o.lead, dur: o.zoomDur, x: e.x, y: e.y, scale });
    }
    const next = focus[i + 1];
    const nextStart = next ? at(next.t) - o.lead : seconds;
    if (view.scale > 1 && nextStart - done >= o.outGap)
      push({ at: done + o.holdAfter, dur: o.zoomDur, x: 0.5, y: 0.5, scale: 1 });
  });
  if (view.scale > 1 && seconds - prevEnd >= o.holdAfter + o.zoomDur)
    push({
      at: Math.max(prevEnd + o.holdAfter, seconds - o.zoomDur - 0.4),
      dur: o.zoomDur,
      x: 0.5,
      y: 0.5,
      scale: 1,
    });

  // Cursor: rests on each target, glides to the next one just in time (smoothstep), never jumps.
  const cursor = [];
  const addPoint = (t, p) => {
    const last = cursor.at(-1);
    const tt = Math.max(r3(t), last ? last.t : 0);
    if (last && last.t === tt && last.x === r3(p[0]) && last.y === r3(p[1])) return;
    cursor.push({ t: tt, x: r3(p[0]), y: r3(p[1]) });
  };
  const stops = log.events.filter((e) => POINT.includes(e.kind) && posOf(e) && e.kind !== "go");
  let cur = null;
  let curT = 0;
  stops.forEach((e) => {
    const te = at(e.t);
    const p = posOf(e);
    if (!cur) {
      cur = [clamp(p[0] - 0.12, 0, 1), clamp(p[1] - 0.1, 0, 1)];
      addPoint(0, cur);
    }
    const travel = Math.min(o.moveDur, Math.max(0.1, (te - curT) * 0.8));
    const t0 = Math.max(curT, te - travel);
    addPoint(t0, cur);
    for (let k = 1; k <= SAMPLES; k++) {
      const u = smooth(k / SAMPLES);
      addPoint(t0 + (travel * k) / SAMPLES, [
        cur[0] + (p[0] - cur[0]) * u,
        cur[1] + (p[1] - cur[1]) * u,
      ]);
    }
    cur = p;
    curT = at(e.end ?? e.t);
    addPoint(curT, cur);
  });
  if (cur) addPoint(seconds, cur);

  const ripples = log.events
    .filter((e) => e.kind === "click" && posOf(e))
    .map((e) => ({ t: at(e.t), x: r3(e.x), y: r3(e.y) }));

  return { seconds, segments, says, props: { viewport: log.viewport, zoom, cursor, ripples } };
}

/** ffmpeg filter_complex that keeps the segments, applies each speed and joins them (video only). */
export function filterFor(segments, fps = DEFAULTS.fps) {
  const parts = segments.map(
    (s, i) =>
      `[0:v]trim=start=${s.from}:end=${s.to},setpts=(PTS-STARTPTS)/${s.speed},fps=${fps}[v${i}]`,
  );
  const join =
    segments.length === 1
      ? "[v0]null[v]"
      : `${segments.map((_, i) => `[v${i}]`).join("")}concat=n=${segments.length}:v=1:a=0[v]`;
  return [...parts, join].join(";");
}
