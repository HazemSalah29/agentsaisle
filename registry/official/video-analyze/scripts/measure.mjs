// The measurements behind `analyze`, as pure functions on numbers: they read no file and run nothing. What goes
// out is numbers and labels only; no pixel, sample or word of the reference is kept.
const r3 = (n) => Math.round(n * 1000) / 1000;
const hex = (c) =>
  `#${c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/**
 * Dominant colours by k-means. `pixels` is a list of [r, g, b]. The start is spread out and fixed (see below), so
 * the same pixels always give the same colours. Returns [{ hex, share }], biggest first.
 */
export function palette(pixels, k = 5, rounds = 12) {
  if (pixels.length < k) throw new Error("Too few pixels to find a palette.");
  // Start from the pixel nearest the average, then repeatedly the pixel farthest from the centres so far: the
  // starting colours are spread out, and the same pixels always give the same start.
  const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const mean = [0, 1, 2].map((c) => pixels.reduce((n, p) => n + p[c], 0) / pixels.length);
  let first = 0;
  pixels.forEach((p, i) => {
    if (dist(p, mean) < dist(pixels[first], mean)) first = i;
  });
  let centers = [[...pixels[first]]];
  while (centers.length < k) {
    let far = 0;
    let fd = -1;
    pixels.forEach((p, i) => {
      const d = Math.min(...centers.map((c) => dist(p, c)));
      if (d > fd) [fd, far] = [d, i];
    });
    centers.push([...pixels[far]]);
  }
  let owner = new Array(pixels.length).fill(0);
  for (let round = 0; round < rounds; round++) {
    const sum = centers.map(() => [0, 0, 0, 0]);
    pixels.forEach((p, i) => {
      let best = 0;
      let bd = Infinity;
      centers.forEach((c, j) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bd) [bd, best] = [d, j];
      });
      owner[i] = best;
      sum[best][0] += p[0];
      sum[best][1] += p[1];
      sum[best][2] += p[2];
      sum[best][3] += 1;
    });
    centers = centers.map((c, j) =>
      sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : c,
    );
  }
  const count = centers.map((_, j) => owner.filter((o) => o === j).length);
  return centers
    .map((c, j) => ({ hex: hex(c), share: r3(count[j] / pixels.length) }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share || (a.hex < b.hex ? -1 : 1));
}

/** Loudness per 10 ms from mono 16-bit samples at 8 kHz: the energy envelope the tempo guess works on. */
export function envelope(samples, rate = 8000, hop = 0.01) {
  const n = Math.round(rate * hop);
  const out = [];
  for (let i = 0; i + n <= samples.length; i += n) {
    let s = 0;
    for (let j = i; j < i + n; j++) s += samples[j] * samples[j];
    out.push(Math.sqrt(s / n));
  }
  return out;
}

/**
 * A tempo guess in beats a minute from an envelope (10 ms steps): the beat spacing, from 60 to 180 BPM, that the
 * sound's onsets repeat at most. It is a heuristic: it can land on half or double the felt tempo and means nothing
 * for speech or ambient sound, so it comes with a confidence (0 to 1) and null when there is nothing to find.
 */
export function tempo(env, hop = 0.01) {
  if (env.length < 800)
    return { bpm: null, confidence: null, note: "too short (under 8 s) to guess a tempo" };
  const onset = env.map((v, i) => (i ? Math.max(0, v - env[i - 1]) : 0));
  const total = onset.reduce((a, b) => a + b, 0);
  if (total < 1e-6)
    return { bpm: null, confidence: null, note: "no onsets (silence or a steady tone)" };
  const lo = Math.round(60 / 180 / hop);
  const hi = Math.round(60 / 60 / hop);
  const r = [];
  for (let lag = lo; lag <= hi; lag++) {
    let s = 0;
    for (let i = 0; i + lag < onset.length; i++) s += onset[i] * onset[i + lag];
    r.push(s / (onset.length - lag));
  }
  let best = 0;
  r.forEach((v, i) => {
    if (v > r[best] * 1.03) best = i; // an earlier (faster) lag wins unless a later one is clearly better
  });
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const confidence = r[best] > 0 ? Math.max(0, Math.min(1, (r[best] - mean) / r[best])) : 0;
  return {
    bpm: Math.round(60 / ((best + lo) * hop)),
    confidence: r3(confidence),
    note: "a heuristic; may be half or double the felt tempo",
  };
}

/** The stretches of sound between silences ({ start, end } each), for a clip of `duration` seconds. */
export function soundSpans(silences, duration) {
  const out = [];
  let at = 0;
  for (const s of silences) {
    if (s.start - at > 0.05) out.push({ start: r3(at), end: r3(s.start) });
    at = Math.max(at, s.end);
  }
  if (duration - at > 0.05) out.push({ start: r3(at), end: r3(duration) });
  return out;
}

/**
 * Word times from whisper's DTW start where the word before ended, which hides pauses. Trim each word to the sound
 * that really overlaps it (at least 50 ms); a word over no sound is dropped. Same rule as video-edit's cut.
 */
export function trimToSound(words, silences, duration) {
  const sound = soundSpans(silences, duration);
  const out = [];
  for (const w of words) {
    const hits = sound.filter((s) => Math.min(s.end, w.end) - Math.max(s.start, w.start) >= 0.05);
    if (!hits.length) continue;
    const start = Math.max(w.start, hits[0].start);
    const end = Math.min(w.end, hits[hits.length - 1].end);
    if (end - start > 0.02) out.push({ ...w, start: r3(start), end: r3(end) });
  }
  return out;
}

/** Speech numbers from words ({ text, start, end }): share of the time spoken, words a minute, sentence timings. */
export function speechStats(words, seconds) {
  if (!words.length)
    return {
      speechShare: null,
      wordsPerMinute: null,
      openingEndsAt: null,
      lastSentenceStartsAt: null,
    };
  const spoken = words.reduce((n, w) => n + Math.max(0, w.end - w.start), 0);
  const ends = (w) => /[.!?؟…]$/.test(w.text.trim());
  const firstEnd = words.find(ends);
  let lastStart = words[0].start;
  words.forEach((w, i) => {
    if (i && ends(words[i - 1])) lastStart = w.start;
  });
  return {
    speechShare: r3(Math.min(1, spoken / seconds)),
    wordsPerMinute: Math.round((words.length / seconds) * 60),
    openingEndsAt: firstEnd ? r3(firstEnd.end) : null,
    lastSentenceStartsAt: r3(lastStart),
  };
}

/** The share of 5 Hz samples whose frame-to-frame brightness change is above `floor` (of 255). */
export function movingShare(changes, floor = 1) {
  return changes.length ? r3(changes.filter((c) => c > floor).length / changes.length) : null;
}

/** The recipe file: numbers and labels only. */
export function buildRecipe({
  name,
  file,
  sha256,
  rights,
  info,
  scenes,
  shares,
  speech,
  colors,
  beat,
}) {
  return {
    version: 1,
    name,
    statement:
      "This recipe holds measurements only. No footage, audio, script, characters or text of the reference are stored, and none may be copied into a new video.",
    reference: {
      file,
      sha256,
      seconds: r3(info.seconds),
      rights,
      rightsNote: "stated by the person who ran the analysis; not verified",
    },
    format: { width: info.width, height: info.height, fps: r3(info.fps) },
    pace: {
      cuts: scenes.cuts,
      cutsPerMinute: scenes.cutsPerMinute,
      averageShotSeconds: scenes.averageShotSeconds,
      hookSeconds: scenes.cuts ? scenes.cutTimes[0] : r3(info.seconds),
    },
    shares: { moving: shares.moving, sound: shares.sound, speech: speech.speechShare },
    speech: {
      wordsPerMinute: speech.wordsPerMinute,
      openingEndsAt: speech.openingEndsAt,
      lastSentenceStartsAt: speech.lastSentenceStartsAt,
    },
    palette: colors,
    tempo: beat,
    notMeasured: [
      "text on screen",
      "caption style",
      "music genre or whether music is present",
      "who is speaking",
      "what is said",
    ],
  };
}
