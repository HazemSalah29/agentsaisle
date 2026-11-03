// Helpers shared by the scene kinds. Text is always escaped, so a hostile string in video.json is shown as text
// and never becomes markup.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

export const fadeUp = (first, rise) => [
  first
    ? { transform: `translateY(${rise}px)` }
    : { opacity: 0, transform: `translateY(${rise}px)` },
  { opacity: 1, transform: "translateY(0)" },
];

/** Seconds the entrance of each element takes, and how far apart staggered items start. */
export const IN = 0.5;
export const STAGGER = 0.18;

const STOP = new Set(
  "a an the and or of to in on at for with is are was were be it its this that as by from your you we our their".split(
    " ",
  ),
);
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٟ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** The words of `text` that name something: no joining words, and nothing under 2 letters. */
export const contentWords = (text) =>
  norm(text)
    .split(" ")
    .filter((w) => w.length >= 2 && !STOP.has(w));

/**
 * Finds when each item of a scene is spoken. `find(text)` returns the time (in the film) of the first spoken word
 * that is one of the content words of `text`, searching on from the last match so a list is matched in order, or
 * `null` when there is no voice or no match. The search is bounded to the scene because `ctx.words` already is.
 * Pure; the cursor is the only state.
 */
export function wordCursor(ctx) {
  const words = (ctx.words ?? []).map((w) => ({ ...w, key: norm(w.text) }));
  let from = 0;
  return {
    find(text) {
      const want = new Set(contentWords(text));
      if (!want.size) return null;
      for (let i = from; i < words.length; i++)
        if (want.has(words[i].key)) {
          from = i + 1;
          return ctx.at + words[i].start;
        }
      return null;
    },
  };
}

/** How long before a spoken word its element starts, so the eye is there when the word is said. */
export const LEAD = 0.06;

/**
 * The stretch each item is spoken in: from its own in-time to the next item's in-time; the last one runs to just
 * before the scene ends. `ats` are in-times in film seconds, in order. Returns [{ at, until }].
 */
export const spansOf = (ats, ctx) =>
  ats.map((at, i) => ({
    at,
    until: Math.max(at + 0.3, i + 1 < ats.length ? ats[i + 1] : ctx.at + ctx.seconds - 0.15),
  }));

/**
 * A rail: a bar that fills at a steady pace across the stretch an item is being spoken, so something moves for as
 * long as the voice is on that item. Returns { html, plan } for an element with the given id.
 */
export const rail = (id, span) => ({
  html: `<i id="${id}" class="rail"></i>`,
  plan: [
    {
      id,
      at: span.at,
      dur: Math.max(0.3, span.until - span.at),
      ease: "linear",
      frames: [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
    },
  ],
});

/** The item has been said: it steps back (dims) when the next one arrives. The last item stays bright. */
export const settle = (id, span, last) =>
  last
    ? []
    : [{ id, at: span.until, dur: 0.3, ease: "out", frames: [{ opacity: 1 }, { opacity: 0.45 }] }];

/** Whether an item scene follows the voice with a rail and dimming (on unless `focus: false`). */
export const focusOn = (props) => props?.focus !== false;

/**
 * Frames for a dot that follows the voice: `samples` are [{ t, left, top }] (film seconds, percent). The dot is
 * hidden until the first sample, then moves through the rest linearly; being sampled keeps it a function of time.
 * Returns { at, dur, frames } for a plan entry with ease "linear".
 */
export function pathPlan(samples) {
  const t0 = samples[0].t;
  const dur = Math.max(0.3, samples.at(-1).t - t0);
  const frames = samples.map((m, k) => ({
    offset: Math.min(1, Math.max(0, (m.t - t0) / dur)),
    left: m.left,
    top: m.top,
    opacity: k === 0 ? 0 : 1,
  }));
  return { at: t0, dur, frames };
}

/**
 * A halo that pulses (grows and fades) once a second across a span, so the item being spoken keeps moving until the
 * next one. Returns a plan entry for an element with the given id (opacity 0 outside the pulses).
 */
export function pulsePlan(id, span, period = 1) {
  const dur = Math.max(0.6, span.until - span.at);
  const n = Math.max(1, Math.round(dur / period));
  const frames = [];
  for (let k = 0; k < n; k++) {
    const a = k / n;
    const b = (k + 0.9) / n;
    frames.push({ offset: a, opacity: 0.85, transform: "scale(1)" });
    frames.push({ offset: b, opacity: 0, transform: "scale(2.2)" });
  }
  frames.push({ offset: 1, opacity: 0, transform: "scale(2.2)" });
  return { id, at: span.at, dur, ease: "out", frames };
}

/** The first item of a scene comes in within this many seconds of the scene starting, even if its word is said later. */
export const FIRST_BY = 1.0;
