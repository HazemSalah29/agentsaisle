// The caption layer for the HyperFrames engine: captions.json -> markup, style rules and animations.
// Words are real text in HTML, so the browser shapes Arabic (letters join) and handles right-to-left order;
// nothing is split into letters and nothing is drawn with ffmpeg. Text is escaped like every other scene.
import { esc } from "./scenes.mjs";

const SECOND = 0.8; // the translation line is this fraction of the main caption size
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const num = (v, d, lo, hi) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

/** Why captions.json cannot be drawn into this film, or null. */
export function captionProblem(c, fps, totalSeconds) {
  if (!c || !Array.isArray(c.groups)) return "captions.json has no groups";
  if (c.fps !== fps) return `captions.json was made for ${c.fps} fps, the film is ${fps} fps`;
  for (const g of c.groups)
    if (
      !(g.end > g.start) ||
      g.start < 0 ||
      g.end > totalSeconds + 0.5 ||
      !Array.isArray(g.words) ||
      !g.words.length
    )
      return `caption ${g.id} does not fit the film (${g.start}-${g.end} s of ${totalSeconds} s)`;
  for (const t of c.secondary ?? [])
    if (
      !(t.end > t.start) ||
      t.start < 0 ||
      t.end > totalSeconds + 0.5 ||
      typeof t.text !== "string" ||
      !t.text
    )
      return `translation line ${t.id} does not fit the film (${t.start}-${t.end} s of ${totalSeconds} s)`;
  return null;
}

/**
 * Pixels from the bottom edge that scenes keep clear while captions are burned in: the platform safe zone,
 * two lines of captions and a small gap. `size` is [width, height].
 */
export function captionClearance(captions, size) {
  const h = size[1];
  const px = num(captions.style?.size, 0.05, 0.02, 0.12) * h;
  const bottom = num(captions.safeZone?.bottom, 0.22, 0, 0.5) * h;
  // A second (translation) line sits under the main one and may take two lines of its own.
  const second =
    Array.isArray(captions.secondary) && captions.secondary.length ? SECOND * 2 * px * 1.3 : 0;
  return Math.round(bottom + 2 * px * 1.25 + second + 0.02 * h);
}

/**
 * { css, html, plan } for the caption layer. `size` is [width, height]; `brand` has cleaned colours.
 * Animations are placed at absolute film times like the scenes' animations.
 */
export function renderCaptions({ captions, brand, size }) {
  const [w, h] = size;
  const s = captions.style;
  const px = Math.round(num(s.size, 0.05, 0.02, 0.12) * h);
  const side = Math.round(num(captions.safeZone?.side, 0.08, 0, 0.3) * w);
  const bottom = Math.round(num(captions.safeZone?.bottom, 0.22, 0, 0.5) * h);
  const { fg, bg, accent } = brand.colors;
  const sec = Array.isArray(captions.secondary) ? captions.secondary : [];
  const secPx = Math.round(px * SECOND);
  // The main caption moves up by the room two lines of translation need.
  const lift = sec.length ? Math.round(secPx * 1.3 * 2) : 0;

  const color = (v, d) => (HEX.test(v) ? v : d);
  const shadow =
    s.stroke > 0
      ? `text-shadow:0 0 ${(s.stroke * px).toFixed(1)}px ${color(bg, "#000")},0 0 ${(s.stroke * px * 2).toFixed(1)}px ${color(bg, "#000")};`
      : "";
  const panel =
    s.background === "panel"
      ? `background:color-mix(in srgb, ${color(bg, "#000")} 78%, transparent);padding:${(px * 0.3).toFixed(0)}px ${(px * 0.6).toFixed(0)}px;border-radius:${(px * 0.35).toFixed(0)}px;`
      : "";
  const css = `.cap-group{position:absolute;inset-inline:${side}px;bottom:${bottom + lift}px;text-align:center;z-index:20;overflow-wrap:anywhere;font-size:${px}px;font-weight:${Number(s.weight) || 700};line-height:1.25;color:${color(fg, "#fff")};${shadow}}
.cap-line{display:inline-block;max-width:100%;${panel}${s.uppercase ? "text-transform:uppercase;" : ""}}
.cap-w{display:inline-block;white-space:pre}
.cap-sec{position:absolute;inset-inline:${side}px;bottom:${bottom}px;text-align:center;z-index:20;font-size:${secPx}px;font-weight:${Math.min(Number(s.weight) || 700, 700)};line-height:1.3;color:${color(fg, "#fff")};opacity:.92;${shadow.replace(/\$\{px\}/g, String(secPx))}}
.cap-sec span{display:inline-block;max-width:100%;${panel}}
`;
  const plan = [];
  let html = "";
  for (const g of captions.groups) {
    const id = `cap-${g.id}`;
    html += `<div id="${id}" class="clip cap-group" data-start="${g.start}" data-duration="${Math.round((g.end - g.start) * 1000) / 1000}" data-layout-allow-overlap data-layout-allow-caption-zone><span id="${id}-l" class="cap-line">`;
    g.words.forEach((word, i) => {
      const wid = `${id}-w${i}`;
      html += `<span id="${wid}" class="cap-w">${esc(word.text)}</span>${i < g.words.length - 1 ? " " : ""}`;
      const dur = Math.max(0.12, word.end - word.start);
      if (s.highlight === "word")
        plan.push({
          id: wid,
          frames: [
            { color: fg },
            { color: accent, offset: 0.15 },
            { color: accent, offset: 0.85 },
            { color: fg },
          ],
          at: word.start,
          dur,
          ease: "linear",
        });
      if (s.wordIn === "pop")
        plan.push({
          id: wid,
          frames: [
            { opacity: 0, transform: "scale(0.6)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          at: word.start,
          dur: 0.16,
          ease: "out",
        });
    });
    html += "</span></div>\n";
    if (s.lineIn === "fade")
      plan.push({
        id: `${id}-l`,
        frames: [{ opacity: 0 }, { opacity: 1 }],
        at: g.start,
        dur: 0.12,
        ease: "out",
      });
  }
  for (const t of sec) {
    const id = `cap-${t.id}`;
    const dir = t.dir === "rtl" ? "rtl" : "ltr";
    const lang = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(t.lang) ? t.lang : "und";
    html += `<div id="${id}" class="clip cap-sec" lang="${lang}" dir="${dir}" data-start="${t.start}" data-duration="${Math.round((t.end - t.start) * 1000) / 1000}" data-layout-allow-overlap data-layout-allow-caption-zone><span id="${id}-l">${esc(t.text)}</span></div>\n`;
    plan.push({
      id: `${id}-l`,
      frames: [{ opacity: 0 }, { opacity: 1 }],
      at: t.start,
      dur: 0.12,
      ease: "out",
    });
  }
  return { css, html, plan };
}
