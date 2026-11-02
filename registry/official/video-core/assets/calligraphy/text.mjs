// Pure checks for calligraphy text (no imports, so the video-calligraphy skill keeps a byte-identical copy):
// limits, reading direction, words, and the problems a scene or a quote file can have.
// Joiners (ZWNJ, ZWJ) are allowed because Arabic needs them; control and direction marks are refused.

export const LIMITS = { text: 80, words: 10, translation: 80, by: 40 };
export const REVEALS = ["wipe", "fade", "rise"];
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,40}$/;
const ARABIC = new RegExp("[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]");
const RTL = new RegExp("[\u0590-\u08ff]");
// Bidi controls and C0/C1 controls are refused; joiners (ZWNJ, ZWJ) stay because Arabic needs them.
const UNSAFE = new RegExp("[\\p{Cc}\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]", "u");
// Pre-shaped letters (presentation forms) mean the text was pasted from a PDF or a drawing tool: they do not join.
const PRESHAPED = new RegExp("[\ufb50-\ufdff\ufe70-\ufeff]");

/** True when the text has Arabic-script letters. */
export const hasArabic = (text) => ARABIC.test(text);

/** Reading direction of a text: right-to-left when it has letters of an RTL script (Arabic, Hebrew, Syriac). */
export const dirOf = (text) => (RTL.test(text) ? "rtl" : "ltr");
export const wordsOf = (text) => String(text).trim().split(/\s+/).filter(Boolean);

/** Problems with a calligraphy scene's props, as readable strings. */
export function calligraphyProblems(props) {
  const p = [];
  const t = props.text;
  if (typeof t !== "string" || !t.trim()) return ["text: write the lettering as text"];
  if (t.length > LIMITS.text) p.push(`text: longer than ${LIMITS.text} characters`);
  if (wordsOf(t).length > LIMITS.words) p.push(`text: more than ${LIMITS.words} words`);
  if (UNSAFE.test(t)) p.push("text: has control or direction-mark characters; remove them");
  if (PRESHAPED.test(t))
    p.push(
      "text: has pre-shaped (presentation form) letters, which do not join; retype it with normal letters",
    );
  for (const k of ["translation", "by"])
    if (props[k] !== undefined && (typeof props[k] !== "string" || props[k].length > LIMITS[k]))
      p.push(`${k}: text of at most ${LIMITS[k]} characters`);
  if (props.font !== undefined && !(typeof props.font === "string" && FAMILY.test(props.font)))
    p.push("font: a plain family name (the file name in brand/fonts without its extension)");
  if (props.reveal !== undefined && !REVEALS.includes(props.reveal))
    p.push(`reveal: one of ${REVEALS.join(", ")}`);
  return p;
}
