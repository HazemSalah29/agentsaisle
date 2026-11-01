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
