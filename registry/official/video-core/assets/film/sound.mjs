// Original sound effects synthesised from maths: no samples, no recordings, no licence to track, no network.
// Each effect is a pure function of its name and a seed, so the same call always gives the same bytes.
// Mono, 16-bit, 48 kHz, peak at about -3 dBFS, with a 5 ms fade at both ends so nothing clicks.

import { Buffer } from "node:buffer";

export const RATE = 48000;
export const NAMES = ["whoosh", "impact", "riser", "tick", "glitch", "swell", "pop"];

/** A repeatable noise source in [-1, 1) (a small linear congruential generator). */
function noise(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
}

const clamp = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x));
const frames = (seconds) => Math.max(1, Math.round(seconds * RATE));

/** A one-pole low-pass filter; `k` in (0, 1], bigger lets more high frequencies through. */
const lowpass = () => {
  let y = 0;
  return (x, k) => (y += clamp(k, 0.0005, 1) * (x - y));
};

const DEFAULT_SECONDS = {
  whoosh: 0.7,
  impact: 1.1,
  riser: 1.6,
  tick: 0.06,
  glitch: 0.35,
  swell: 1.8,
  pop: 0.12,
};

/** Raw samples (floats, roughly -1 to 1) of an effect. */
function raw(name, seconds, seed) {
  const n = frames(seconds);
  const rnd = noise(seed);
  const out = new Float64Array(n);
  switch (name) {
    case "whoosh": {
      // Band-limited noise whose brightness sweeps up and back down, under a smooth bell envelope.
      const lp1 = lowpass();
      const lp2 = lowpass();
      for (let i = 0; i < n; i++) {
        const u = i / n;
        const env = Math.sin(Math.PI * u) ** 2;
        const k = 0.02 + 0.55 * Math.sin(Math.PI * u) ** 1.5;
        const x = rnd();
        out[i] = (lp1(x, k) - lp2(x, k * 0.12)) * env * 3;
      }
      return out;
    }
    case "impact": {
      // A falling sine (the thump), a short noise burst (the click) and a decaying tail.
      let phase = 0;
      const lp = lowpass();
      for (let i = 0; i < n; i++) {
        const t = i / RATE;
        const f = 38 + 120 * Math.exp(-t * 14);
        phase += (2 * Math.PI * f) / RATE;
        const thump = Math.sin(phase) * Math.exp(-t * 4.2);
        const click = lp(rnd(), 0.35) * Math.exp(-t * 60) * 0.9;
        const tail = lp(rnd(), 0.03) * Math.exp(-t * 3.2) * 0.25;
        out[i] = thump + click + tail;
      }
      return out;
    }
    case "riser": {
      // Noise that brightens and a rising tone, swelling to the end.
      let phase = 0;
      const lp = lowpass();
      for (let i = 0; i < n; i++) {
        const u = i / n;
        const f = 180 * 2 ** (u * 3.2);
        phase += (2 * Math.PI * f) / RATE;
        const env = u ** 2.2;
        out[i] = (lp(rnd(), 0.02 + 0.5 * u) * 0.9 + Math.sin(phase) * 0.35) * env;
      }
      return out;
    }
    case "tick": {
      // A crisp click: a few milliseconds of high-passed noise and a tiny tone.
      let prev = 0;
      for (let i = 0; i < n; i++) {
        const t = i / RATE;
        const x = rnd();
        const hp = x - prev * 0.9;
        prev = x;
        out[i] = (hp * 0.8 + Math.sin(2 * Math.PI * 2400 * t) * 0.4) * Math.exp(-t * 90);
      }
      return out;
    }
    case "glitch": {
      // Stuttering, bit-crushed bursts of noise and tone.
      let held = 0;
      let phase = 0;
      for (let i = 0; i < n; i++) {
        const t = i / RATE;
        const slot = Math.floor(t * 40);
        const gate = rnd() > -2 && (slot * 7919) % 5 < 3 ? 1 : 0;
        if (i % 6 === 0) held = Math.round(rnd() * 6) / 6; // crushed noise
        phase += (2 * Math.PI * (300 + ((slot * 131) % 7) * 220)) / RATE;
        out[i] = (held * 0.7 + Math.sign(Math.sin(phase)) * 0.3) * gate * Math.exp(-t * 4);
      }
      return out;
    }
    case "swell": {
      // A soft chord (A, E, A an octave up and a fifth) that fades in and out.
      const freqs = [110, 164.81, 220, 329.63];
      const lp = lowpass();
      for (let i = 0; i < n; i++) {
        const t = i / RATE;
        const u = i / n;
        const env = Math.sin(Math.PI * u) ** 2.4;
        let v = 0;
        for (const [k, f] of freqs.entries())
          v += Math.sin(2 * Math.PI * f * t + k) * (0.5 / (k + 1));
        out[i] = (v + lp(rnd(), 0.02) * 0.2) * env;
      }
      return out;
    }
    case "pop": {
      // A soft, round blip: a sine that drops quickly in pitch, with a breath of noise on the attack.
      let phase = 0;
      for (let i = 0; i < n; i++) {
        const t = i / RATE;
        const f = 320 + 700 * Math.exp(-t * 45);
        phase += (2 * Math.PI * f) / RATE;
        out[i] = Math.sin(phase) * Math.exp(-t * 34) + rnd() * 0.08 * Math.exp(-t * 200);
      }
      return out;
    }
    default:
      throw new Error(`Unknown effect "${name}" (have: ${NAMES.join(", ")}).`);
  }
}

/** 16-bit samples of an effect, faded at both ends and scaled so the peak sits near -3 dBFS. */
export function synth(name, { seconds, seed = 1 } = {}) {
  if (!NAMES.includes(name))
    throw new Error(`Unknown effect "${name}" (have: ${NAMES.join(", ")}).`);
  const s = seconds ?? DEFAULT_SECONDS[name];
  if (!(s >= 0.02 && s <= 8)) throw new Error("seconds: 0.02 to 8");
  const x = raw(name, s, seed);
  let peak = 1e-9;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const gain = 0.708 / peak;
  const fade = Math.min(Math.round(RATE * 0.005), Math.floor(x.length / 2));
  const out = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const edge = Math.min(1, i / fade, (x.length - 1 - i) / fade);
    out[i] = Math.round(clamp(x[i] * gain * edge) * 32767);
  }
  return out;
}

/** A complete mono 16-bit PCM WAV file. */
export function wav(samples, rate = RATE) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(v, i * 2));
  const head = Buffer.alloc(44);
  head.write("RIFF", 0, "latin1");
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVEfmt ", 8, "latin1");
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36, "latin1");
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

/** Peak level in dBFS of 16-bit samples. */
export const peakDb = (samples) => 20 * Math.log10(Math.max(1, ...samples.map(Math.abs)) / 32768);

/**
 * An original music bed made from maths: a minor four-chord loop (i, VI, III, VII) on soft detuned pads, a sub
 * bass, a gentle kick on the beat with the pads ducking under it, and quiet off-beat hats. Mono 16-bit at RATE, faded
 * in and out, peak near -6 dBFS (the mix pushes it far under the voice). Pure: the same seconds and bpm give the
 * same bytes. No samples, so there is no licence to track.
 */
export function bed({ seconds, bpm = 104, seed = 3 } = {}) {
  if (!(seconds > 0 && seconds <= 600)) throw new Error("seconds: up to 600");
  const n = frames(seconds);
  const rnd = noise(seed);
  const beat = 60 / bpm;
  const bar = beat * 4;
  // A minor: Am, F, C, G (root note frequencies and chord tones in Hz)
  const chords = [
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
    [196.0, 261.63, 329.63],
    [196.0, 246.94, 293.66],
  ];
  const roots = [55.0, 43.65, 65.41, 49.0];
  const out = new Float64Array(n);
  const lpPad = lowpass();
  const lpHat = lowpass();
  let prevHat = 0;
  let kickPhase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const ci = Math.floor(t / bar) % chords.length;
    const inBar = t % bar;
    const inBeat = t % beat;
    // pads: two slightly detuned saws per note, low-passed, swelling with each bar
    let pad = 0;
    for (const f of chords[ci])
      for (const d of [0.997, 1.003]) pad += 2 * (((t * f * d) % 1) - 0.5);
    pad = lpPad(pad / 6, 0.035 + 0.02 * Math.sin((2 * Math.PI * t) / (bar * 2)));
    const swell = Math.min(1, inBar / 0.4) * (1 - 0.25 * (inBar / bar));
    // kick: a short falling sine on every beat; the pads duck under it
    const kt = inBeat;
    const kf = 45 + 90 * Math.exp(-kt * 30);
    kickPhase += (2 * Math.PI * kf) / RATE;
    const kick = Math.sin(kickPhase) * Math.exp(-kt * 9) * 0.55;
    const duck = 1 - 0.6 * Math.exp(-kt * 7);
    // sub bass on the root, following the kick's pump
    const sub = Math.sin(2 * Math.PI * roots[ci] * t) * 0.35 * duck;
    // hats on the off-beats: high-passed noise, very quiet
    const ht = (t + beat / 2) % beat;
    const x = rnd();
    const hp = x - prevHat;
    prevHat = x;
    const hat = lpHat(hp, 0.6) * Math.exp(-ht * 60) * 0.12;
    out[i] = pad * 0.9 * swell * duck + kick + sub + hat;
  }
  let peak = 1e-9;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = 0.5 / peak;
  const fadeIn = Math.round(RATE * 0.6);
  const fadeOut = Math.round(RATE * Math.min(2, seconds / 4));
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const edge = Math.min(1, i / fadeIn, (n - 1 - i) / fadeOut);
    pcm[i] = Math.round(clamp(out[i] * gain * edge) * 32767);
  }
  return pcm;
}
