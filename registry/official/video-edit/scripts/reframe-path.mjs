// The maths behind `reframe` (16:9 to 9:16): from where the speaker's face was seen to where the crop sits.
// Pure; it reads no file and runs nothing. Positions are fractions of the source width (0 to 1) for faces and
// pixels for the crop's left edge.
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Median of a list of numbers. */
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

/**
 * Fill gaps: a sample without a face keeps the last position seen (the crop never jumps to the middle), and
 * samples before the first face take the first position. Returns null when no face was seen at all.
 */
export function fillGaps(samples) {
  const first = samples.find((s) => Number.isFinite(s.cx));
  if (!first) return null;
  let last = first.cx;
  return samples.map((s) => {
    if (Number.isFinite(s.cx)) last = s.cx;
    return { t: s.t, cx: last, seen: Number.isFinite(s.cx) };
  });
}

/**
 * The crop's left edge in pixels over time, from face samples ({ t, cx } with cx null when no face was found).
 * Steps: fill gaps, median over 5 samples (a one-frame wrong detection is ignored), a dead band (the crop does not
 * move for a face that moves less than 8% of the crop width), a speed limit (at most half a crop width a second),
 * then clamp inside the frame. Returns { points: [{ t, x }], coverage } or null when no face was seen.
 */
export function smoothPath(samples, { srcW, cropW, deadband = 0.08, maxSpeed = 0.5 }) {
  const filled = fillGaps(samples);
  if (!filled) return null;
  const maxLeft = srcW - cropW;
  const left = (cx) => Math.min(maxLeft, Math.max(0, cx * srcW - cropW / 2));
  const med = filled.map((_, i) =>
    median(filled.slice(Math.max(0, i - 2), i + 3).map((s) => s.cx)),
  );
  let pos = left(med[0]);
  const points = [{ t: filled[0].t, x: pos }];
  for (let i = 1; i < filled.length; i++) {
    const want = left(med[i]);
    const dt = filled[i].t - filled[i - 1].t;
    let target = pos;
    if (Math.abs(want - pos) > deadband * cropW) target = want;
    const step = maxSpeed * cropW * dt;
    pos += Math.max(-step, Math.min(step, target - pos));
    points.push({ t: filled[i].t, x: pos });
  }
  const seen = filled.filter((s) => s.seen).length;
  return { points, coverage: r3(seen / filled.length) };
}

/** Ramer-Douglas-Peucker on (t, x): fewest points that stay within `eps` pixels of the path. */
export function simplify(points, eps) {
  if (points.length <= 2) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  let worst = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const on = a.x + ((b.x - a.x) * (points[i].t - a.t)) / (b.t - a.t || 1);
    const d = Math.abs(points[i].x - on);
    if (d > worst) [worst, at] = [d, i];
  }
  if (worst <= eps) return [a, b];
  return [
    ...simplify(points.slice(0, at + 1), eps).slice(0, -1),
    ...simplify(points.slice(at), eps),
  ];
}

/** At most `max` keyframes: raise the tolerance until the path is simple enough for an ffmpeg expression. */
export function keyframes(points, max = 60) {
  let eps = 1;
  let k = simplify(points, eps);
  while (k.length > max && eps < 400) {
    eps *= 1.5;
    k = simplify(points, eps);
  }
  return k.map((p) => ({ t: r3(p.t), x: r1(p.x) }));
}

/** An ffmpeg expression in `t` that moves straight from keyframe to keyframe and holds the last one. */
export function cropExpr(keys) {
  if (!keys.length) throw new Error("The path has no keyframes.");
  if (keys.length === 1) return String(keys[0].x);
  let expr = String(keys[keys.length - 1].x);
  for (let i = keys.length - 2; i >= 0; i--) {
    const a = keys[i];
    const b = keys[i + 1];
    const span = b.t - a.t || 0.001;
    expr = `if(lt(t,${b.t}),${a.x}+(${r1(b.x - a.x)})*(t-${a.t})/${r3(span)},${expr})`;
  }
  return expr;
}

/** The crop's left edge for a fixed mode: center, left, right, or x=<0..1> (where the middle of the crop goes). */
export function fixedLeft(mode, { srcW, cropW }) {
  const maxLeft = srcW - cropW;
  if (mode === "center") return maxLeft / 2;
  if (mode === "left") return 0;
  if (mode === "right") return maxLeft;
  const m = /^x=(\d*\.?\d+)$/.exec(mode);
  if (m && Number(m[1]) >= 0 && Number(m[1]) <= 1)
    return Math.min(maxLeft, Math.max(0, Number(m[1]) * srcW - cropW / 2));
  throw new Error(`Unknown --mode "${mode}". Use face, center, left, right or x=<0 to 1>.`);
}

/** Size of the crop: full source height, width for the target shape, even numbers. Throws if the source is not wide enough. */
export function cropSize({ srcW, srcH }, outW, outH) {
  if (![srcW, srcH, outW, outH].every((n) => Number.isFinite(n) && n > 0))
    throw new Error("The picture size is not known.");
  const w = Math.round((srcH * outW) / outH / 2) * 2;
  if (w >= srcW)
    throw new Error(
      `The picture is ${srcW}x${srcH}, already as narrow as ${outW}x${outH} or narrower; reframe needs a wider picture.`,
    );
  return { cropW: w, cropH: srcH };
}

/** The plan reported to the user: where the crop goes, from a path or a fixed left edge. */
export function describePath(keys, cropW, srcW) {
  const xs = keys.map((k) => k.x);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return {
    keyframes: keys.length,
    leftMin: r1(lo),
    leftMax: r1(hi),
    travelPercentOfWidth: r1(((hi - lo) / srcW) * 100),
    cropW,
  };
}
