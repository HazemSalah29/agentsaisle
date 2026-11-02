// Beat detection for a music track, in plain Node: no audio library, no network. The track is decoded to mono
// samples elsewhere (ffmpeg); this file finds the onsets, the tempo and a steady beat grid, and snaps scene
// boundaries to the nearest beat. Pure and deterministic: the same samples give the same beats.
export const LIMITS = { minBpm: 60, maxBpm: 180, hop: 512, win: 1024 };
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Onset strength per hop: how much the (high-passed) energy rose since the frame before. */
export function onsetStrength(samples, rate, { hop = LIMITS.hop, win = LIMITS.win } = {}) {
  const n = Math.max(0, Math.floor((samples.length - win) / hop));
  const energy = new Float64Array(n);
  for (let f = 0; f < n; f++) {
    let e = 0;
    const o = f * hop;
    for (let i = 1; i < win; i++) {
      const d = samples[o + i] - samples[o + i - 1]; // first difference: favours clicks and drum hits over hum
      e += d * d;
    }
    energy[f] = Math.log1p((e / win) * 1e4);
  }
  const flux = new Float64Array(n);
  for (let f = 1; f < n; f++) flux[f] = Math.max(0, energy[f] - energy[f - 1]);
  return { flux, step: hop / rate };
}

/** Peaks of the onset strength above a moving threshold, at least `minGap` seconds apart. */
export function pickOnsets(flux, step, minGap = 0.2) {
  const w = Math.max(3, Math.round(1 / step));
  const out = [];
  for (let f = 1; f + 1 < flux.length; f++) {
    if (!(flux[f] > flux[f - 1] && flux[f] >= flux[f + 1])) continue;
    let sum = 0;
    let sq = 0;
    let c = 0;
    for (let k = Math.max(0, f - w); k < Math.min(flux.length, f + w); k++) {
      sum += flux[k];
      sq += flux[k] * flux[k];
      c++;
    }
    const mean = sum / c;
    const sd = Math.sqrt(Math.max(0, sq / c - mean * mean));
    if (flux[f] < mean + 1.2 * sd || flux[f] < 0.05) continue;
    const t = f * step;
    const last = out.at(-1);
    if (last && t - last.t < minGap) {
      if (flux[f] > last.s) {
        last.t = t;
        last.s = flux[f];
      }
    } else out.push({ t, s: flux[f] });
  }
  return out;
}

/** Tempo by autocorrelation of the onset strength, within 60 to 180 BPM. Returns { bpm, period } or null. */
export function tempoOf(raw, step) {
  // A beat period is rarely a whole number of hops; a little smoothing lets near-misses still correlate.
  const flux = new Float64Array(raw.length);
  for (let i = 0; i < raw.length; i++)
    flux[i] = 0.25 * (raw[i - 1] ?? 0) + 0.5 * raw[i] + 0.25 * (raw[i + 1] ?? 0);
  const lo = Math.round(60 / LIMITS.maxBpm / step);
  const hi = Math.round(60 / LIMITS.minBpm / step);
  if (flux.length < hi * 2) return null;
  let best = null;
  const score = new Float64Array(hi + 2);
  for (let lag = lo; lag <= hi + 1; lag++) {
    let s = 0;
    for (let i = lag; i < flux.length; i++) s += flux[i] * flux[i - lag];
    score[lag] = s / (flux.length - lag);
  }
  // Peaks repeat at multiples of the period, so take the shortest lag whose peak is close to the strongest.
  const peaks = [];
  for (let lag = lo; lag <= hi; lag++)
    if (score[lag] >= score[lag - 1] && score[lag] >= score[lag + 1] && score[lag] > 0)
      peaks.push({ lag, s: score[lag] });
  const top = Math.max(0, ...peaks.map((p) => p.s));
  best = peaks.find((p) => p.s >= top * 0.7) ?? null;
  if (!best || best.s <= 0) return null;
  const [a, b, c] = [score[best.lag - 1], score[best.lag], score[best.lag + 1]];
  const shift = a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
  const period = (best.lag + shift) * step;
  return { bpm: r3(60 / period), period };
}

/** A steady grid at `period`, with the phase that lines up best with the onsets. */
export function gridFor(onsets, period, duration) {
  if (!onsets.length) return [];
  let best = { phase: 0, s: -1 };
  const tries = 60;
  for (let k = 0; k < tries; k++) {
    const phase = (period * k) / tries;
    let s = 0;
    for (const o of onsets) {
      const d = (((o.t - phase) % period) + period) % period;
      const off = Math.min(d, period - d);
      s += o.s * Math.max(0, 1 - off / (period * 0.15));
    }
    if (s > best.s) best = { phase, s };
  }
  // Refine the phase from the onsets that sit close to the grid (a mean offset), so a small tempo error does not drift.
  let sum = 0;
  let w = 0;
  for (const o of onsets) {
    let d = (((o.t - best.phase) % period) + period) % period;
    if (d > period / 2) d -= period;
    if (Math.abs(d) < period * 0.15) {
      sum += d * o.s;
      w += o.s;
    }
  }
  const phase = best.phase + (w ? sum / w : 0);
  const beats = [];
  for (let t = phase < 0 ? phase + period : phase; t <= duration + 1e-9; t += period)
    beats.push(r3(t));
  return beats;
}

/** Everything about a track: { bpm, beats, onsets, duration } (bpm is null when no steady tempo was found). */
export function analyse(samples, rate) {
  const duration = r3(samples.length / rate);
  const { flux, step } = onsetStrength(samples, rate);
  const onsets = pickOnsets(flux, step);
  const tempo = tempoOf(flux, step);
  const beats = tempo ? gridFor(onsets, tempo.period, duration) : onsets.map((o) => r3(o.t));
  return {
    duration,
    bpm: tempo ? tempo.bpm : null,
    beats,
    onsets: onsets.map((o) => r3(o.t)),
  };
}

/**
 * Move each boundary between two scenes to the nearest beat within `tolerance` seconds. `durations` are the
 * scene lengths; `movable[i]` says whether scene i may change length. A boundary moves only when both scenes
 * beside it are movable, and never below `minLen`, so the total length does not change.
 */
export function snapScenes(durations, beats, { tolerance = 0.2, minLen = 0.8, movable } = {}) {
  const out = [...durations];
  let t = 0;
  for (let i = 0; i + 1 < out.length; i++) {
    t += out[i];
    if (movable && !(movable[i] && movable[i + 1])) continue;
    let near = null;
    for (const b of beats) if (near === null || Math.abs(b - t) < Math.abs(near - t)) near = b;
    if (near === null || Math.abs(near - t) > tolerance) continue;
    const delta = near - t;
    if (out[i] + delta < minLen || out[i + 1] - delta < minLen) continue;
    out[i] = r3(out[i] + delta);
    out[i + 1] = r3(out[i + 1] - delta);
    t = near;
  }
  return out;
}
