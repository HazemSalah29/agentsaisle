// Rate-limit simulator for the `rate-limit` scene. Pure and seeded: the same spec always gives the same event
// log, and the animation is drawn from that log, so what the video shows is what the algorithm does.
// No clock, no randomness except the seeded generator, no I/O. Times are whole milliseconds.
//
// Spec: { seed, count, pattern: { type, ratePerSec, burstSize?, burstEverySec? },
//         algos: [{ algo, ...params }] }
// Algorithms and params:
//   token-bucket   capacity, refillPerSec   (starts full; a request takes 1 token)
//   leaky-bucket   capacity, leakPerSec     (starts empty; a request adds 1; the level drains steadily)
//   fixed-window   limit, windowSec         (the count resets at multiples of the window)
//   sliding-window limit, windowSec         (counts allowed requests in the last windowSec seconds)

export const ALGOS = ["token-bucket", "leaky-bucket", "fixed-window", "sliding-window"];
export const PATTERNS = ["steady", "poisson", "burst"];
export const MAX_COUNT = 2000;

const PARAMS = {
  "token-bucket": ["capacity", "refillPerSec"],
  "leaky-bucket": ["capacity", "leakPerSec"],
  "fixed-window": ["limit", "windowSec"],
  "sliding-window": ["limit", "windowSec"],
};

/** Seeded generator (mulberry32): a function returning numbers in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pos = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Problems with a spec, as readable strings. Empty means the spec can be simulated. */
export function specProblems(spec) {
  const p = [];
  if (!spec || typeof spec !== "object") return ["props: expected an object"];
  if (!Number.isInteger(spec.seed) || spec.seed < 0 || spec.seed > 0xffffffff)
    p.push("seed: must be a whole number from 0 to 4294967295");
  if (!Number.isInteger(spec.count) || spec.count < 1 || spec.count > MAX_COUNT)
    p.push(`count: must be a whole number from 1 to ${MAX_COUNT}`);
  const pat = spec.pattern;
  if (!pat || typeof pat !== "object") p.push("pattern: missing");
  else {
    if (!PATTERNS.includes(pat.type)) p.push(`pattern.type: must be one of ${PATTERNS.join(", ")}`);
    if (!pos(pat.ratePerSec)) p.push("pattern.ratePerSec: must be a number above 0");
    if (pat.type === "burst") {
      if (!Number.isInteger(pat.burstSize) || pat.burstSize < 1)
        p.push("pattern.burstSize: must be a whole number of 1 or more");
      if (!pos(pat.burstEverySec)) p.push("pattern.burstEverySec: must be a number above 0");
    }
  }
  if (!Array.isArray(spec.algos) || spec.algos.length < 1 || spec.algos.length > 2)
    p.push("algos: one or two algorithms");
  else
    spec.algos.forEach((a, i) => {
      const at = `algos[${i}]`;
      if (!ALGOS.includes(a?.algo)) return p.push(`${at}.algo: must be one of ${ALGOS.join(", ")}`);
      for (const k of PARAMS[a.algo])
        if (!pos(a[k])) p.push(`${at}.${k}: must be a number above 0`);
      for (const k of Object.keys(a))
        if (k !== "algo" && !PARAMS[a.algo].includes(k))
          p.push(`${at}.${k}: not a parameter of ${a.algo}`);
    });
  return p;
}

/** Arrival times in whole milliseconds, ascending, one per request. */
export function arrivals({ seed, count, pattern }) {
  const rand = rng(seed);
  const out = [];
  if (pattern.type === "steady") {
    const gap = 1000 / pattern.ratePerSec;
    for (let i = 0; i < count; i++) out.push(Math.round(i * gap));
  } else if (pattern.type === "poisson") {
    let t = 0;
    for (let i = 0; i < count; i++) {
      t += (-Math.log(1 - rand()) / pattern.ratePerSec) * 1000;
      out.push(Math.round(t));
    }
  } else {
    // Bursts of burstSize arrive at once every burstEverySec; ratePerSec is not used for timing.
    for (let i = 0; i < count; i++)
      out.push(Math.round(Math.floor(i / pattern.burstSize) * pattern.burstEverySec * 1000));
  }
  return out;
}

const r3 = (n) => Math.round(n * 1000) / 1000;

function decider(a) {
  if (a.algo === "token-bucket") {
    let tokens = a.capacity;
    let last = 0;
    return (t) => {
      tokens = Math.min(a.capacity, tokens + ((t - last) / 1000) * a.refillPerSec);
      last = t;
      const ok = tokens >= 1;
      if (ok) tokens -= 1;
      return { ok, level: r3(tokens), max: a.capacity };
    };
  }
  if (a.algo === "leaky-bucket") {
    let level = 0;
    let last = 0;
    return (t) => {
      level = Math.max(0, level - ((t - last) / 1000) * a.leakPerSec);
      last = t;
      const ok = level + 1 <= a.capacity;
      if (ok) level += 1;
      return { ok, level: r3(level), max: a.capacity };
    };
  }
  const w = a.windowSec * 1000;
  if (a.algo === "fixed-window") {
    let start = 0;
    let n = 0;
    return (t) => {
      const s = Math.floor(t / w) * w;
      if (s !== start) {
        start = s;
        n = 0;
      }
      const ok = n < a.limit;
      if (ok) n += 1;
      return { ok, level: n, max: a.limit };
    };
  }
  const kept = [];
  return (t) => {
    while (kept.length && kept[0] <= t - w) kept.shift();
    const ok = kept.length < a.limit;
    if (ok) kept.push(t);
    return { ok, level: kept.length, max: a.limit };
  };
}

/**
 * Run the spec. Returns { arrivals, runs: [{ algo, params, events, allowed, rejected }], durationMs }.
 * An event is { id, t, outcome: "allowed" | "rejected", level, max }: `level` is what the meter shows right after
 * the decision (tokens left, bucket fill, or requests counted in the window).
 */
export function simulate(spec) {
  const problems = specProblems(spec);
  if (problems.length) throw new Error(`Invalid rate-limit spec: ${problems.join("; ")}`);
  const times = arrivals(spec);
  const runs = spec.algos.map((a) => {
    const decide = decider(a);
    const { algo, ...params } = a;
    let allowed = 0;
    const events = times.map((t, id) => {
      const d = decide(t);
      if (d.ok) allowed += 1;
      return { id, t, outcome: d.ok ? "allowed" : "rejected", level: d.level, max: d.max };
    });
    return { algo, params, events, allowed, rejected: times.length - allowed };
  });
  return { arrivals: times, runs, durationMs: times[times.length - 1] ?? 0 };
}
