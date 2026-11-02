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
