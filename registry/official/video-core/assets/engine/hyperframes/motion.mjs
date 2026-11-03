// Shared motion helpers for the scene kinds that sample their animation (shot, kinetic, transitions): named easing
// curves as pure functions, a repeatable pseudo-random source and an even sampling of a time span. Nothing here
// touches the page, the disk or the clock, so a frame always depends on the scene's time alone.

/** Named easing curves, t in [0, 1] to progress (some overshoot). */
export const EASE_FN = {
  linear: (t) => t,
  out: (t) => 1 - (1 - t) ** 5,
  inOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  in: (t) => t ** 3,
  expo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  snap: (t) => 1 - (1 - t) ** 7,
  spring: (t) => 1 - Math.cos(t * 4.5 * Math.PI) * Math.exp(-6 * t),
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};
export const EASE_NAMES = Object.keys(EASE_FN);

export const r3 = (n) => Math.round(n * 1000) / 1000;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** A repeatable pseudo-random number in [0, 1) for an integer key. */
export const rnd = (k) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Evenly spaced progress values in [0, 1] for a span of `seconds`, with a hard cap, always including both ends. */
export const samples = (seconds, perSecond = 24, max = 120) => {
  const n = Math.min(max, Math.max(2, Math.ceil(seconds * perSecond) + 1));
  return Array.from({ length: n }, (_, i) => i / (n - 1));
};
