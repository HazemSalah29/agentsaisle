// Builds a HyperFrames project (as a map of files) from video.json + timing.json + brand. Pure: it reads the
// tween helper from this skill and returns what to write; render.mjs writes it and copies the media.
import { readFileSync } from "node:fs";
import path from "node:path";
import { captionProblem, renderCaptions } from "../assets/engine/hyperframes/captions.mjs";
import { KINDS, esc, kindCss, renderScene } from "../assets/engine/hyperframes/scenes.mjs";
import { skillDir } from "./_lib.mjs";

export const SIZES = {
  "reel-9x16": [1080, 1920],
  "short-9x16": [1080, 1920],
  "youtube-16x9": [1920, 1080],
  "square-1x1": [1080, 1080],
};
export const BUILT_TRANSITIONS = ["cut", "fade"];
const FADE_FRAMES = 8;

export const DEFAULT_BRAND = Object.freeze({
  colors: { bg: "#0F1115", fg: "#F5F5F2", accent: "#FF5A1F", muted: "#A3A9B0" },
  font: "Inter",
});

const COLOR = /^#[0-9a-fA-F]{3,8}$/;
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/;

/** Brand with only safe values kept: colours must be hex, the font a plain family name. */
export function cleanBrand(raw) {
  const colors = { ...DEFAULT_BRAND.colors };
  for (const k of Object.keys(colors))
    if (COLOR.test(raw?.colors?.[k] ?? "")) colors[k] = raw.colors[k];
  const font = FAMILY.test(raw?.font ?? "") ? raw.font : DEFAULT_BRAND.font;
  return { colors, font };
}

const css = ({ w, h, brand, stack, faces, vertical }) => `${faces}
html,body{margin:0;background:${brand.colors.bg}}
#root{--u:${w / 100}px;position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${brand.colors.bg};color:${brand.colors.fg};font-family:${stack};}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:calc(var(--u)*3);box-sizing:border-box;padding:calc(var(--u)*6) calc(var(--u)*7) ${vertical ? "calc(var(--u)*16)" : "calc(var(--u)*6)"}}
.title{margin:0;font-size:calc(var(--u)*10.5);line-height:1.08;font-weight:700;letter-spacing:-.01em}
.sub{margin:0;font-size:calc(var(--u)*3.8);line-height:1.3;color:${brand.colors.muted}}
.quote{margin:0;padding-inline-start:calc(var(--u)*3);border-inline-start:calc(var(--u)*.8) solid ${brand.colors.accent};font-size:calc(var(--u)*5.4);line-height:1.2;font-weight:700}
.quote p{margin:0}
.cite{margin:0;font-size:calc(var(--u)*3.4);color:${brand.colors.muted}}
.heading{margin:0;font-size:calc(var(--u)*6);line-height:1.1;font-weight:700}
.items{margin:0;padding-inline-start:calc(var(--u)*7);font-size:calc(var(--u)*5.2);line-height:1.35}
.items li{margin-bottom:calc(var(--u)*2)}
.items li::marker{color:${brand.colors.accent}}
.chart{width:100%;height:auto;font-family:inherit}
.chart .axis{stroke:${brand.colors.muted};stroke-width:.3}
.chart .bar{fill:${brand.colors.accent}}
.chart .line{fill:none;stroke:${brand.colors.accent};stroke-width:.9;stroke-linecap:round;stroke-linejoin:round}
.chart .dot{fill:${brand.colors.fg}}
.chart text{text-anchor:middle;fill:${brand.colors.fg}}
.chart .val{font-size:3.2px;font-weight:700}
.chart .lab{font-size:3px;fill:${brand.colors.muted}}
.scene-broll{padding:0;gap:0}
.media{position:absolute;inset:0;width:100%;height:100%}
.media-cap{position:absolute;inset-inline:calc(var(--u)*7);bottom:calc(var(--u)*${vertical ? 16 : 6});margin:0;font-size:calc(var(--u)*3.8);font-weight:700}
${kindCss(brand, vertical)}`;

/**
 * Build the project (`captions` is a parsed captions.json to draw, or null). Returns { files: { "index.html": text }, media: [{ from, to }], fonts: [{ from, to }],
 * notes: [string] }. `fontFiles` are absolute paths found in brand/fonts; `assetPaths` maps asset id -> abs path.
 */
export function buildProject({
  video,
  timing,
  brand: rawBrand,
  fontFiles = [],
  assetPaths = new Map(),
  captions = null,
}) {
  const [w, h] = SIZES[video.meta.format];
  const vertical = h > w;
  const brand = cleanBrand(rawBrand);
  const fps = timing.fps;
  const lang = video.meta.lang;
  const dir = video.meta.dir ?? (/^(ar|he|fa|ur)\b/.test(lang) ? "rtl" : "ltr");
  const notes = [];

  const fonts = fontFiles.map((from) => {
    const base = path.basename(from);
    return { from, to: `assets/fonts/${base}`, family: path.basename(base, path.extname(base)) };
  });
  const faces = fonts
    .filter((f) => FAMILY.test(f.family))
    .map((f) => `@font-face{font-family:'${f.family}';src:url('${f.to}');}`)
    .join("\n");
  const stack = [
    brand.font,
    ...fonts.map((f) => f.family).filter((f) => FAMILY.test(f)),
    "Inter",
    "sans-serif",
  ]
    .map((f) => (/\s/.test(f) ? `'${f}'` : f))
    .join(",");

  const assets = new Map();
  const media = [];
  for (const s of video.scenes) {
    if (s.kind !== "broll") continue;
    const a = (video.assets ?? []).find((x) => x.id === s.props.asset);
    if (!a || assets.has(a.id)) continue;
    const file = `${a.id}${path.extname(a.path).toLowerCase()}`;
    assets.set(a.id, { file });
    media.push({ from: assetPaths.get(a.id) ?? a.path, to: `assets/media/${file}` });
  }

  const plan = [];
  let body = "";
  video.scenes.forEach((s, i) => {
    const t = timing.scenes[i];
    const first = i === 0;
    const transition = s.transitionIn ?? "cut";
    if (!BUILT_TRANSITIONS.includes(transition))
      notes.push(`scene ${s.id}: transition "${transition}" is not built yet; used cut`);
    const prefix = `sc-${s.id}`;
    const r = renderScene(s, {
      prefix,
      at: t.start,
      seconds: t.seconds,
      lines: t.lines,
      lang,
      first,
      rise: Math.round((w / 100) * 2.4),
      assets,
    });
    plan.push(...r.plan);
    if (transition === "fade" && !first)
      plan.push({
        id: prefix,
        frames: [{ opacity: 0 }, { opacity: 1 }],
        at: t.start,
        dur: FADE_FRAMES / fps,
        ease: "inOut",
      });
    body += `<section id="${prefix}" class="clip scene scene-${s.kind}" data-start="${t.start}" data-duration="${t.seconds}">${r.html}</section>\n`;
  });

  let captionCss = "";
  if (captions) {
    const problem = captionProblem(captions, fps, timing.totalSeconds);
    if (problem) throw new Error(`Captions cannot be drawn: ${problem}. Run captions.mjs again.`);
    const c = renderCaptions({ captions, brand, size: [w, h] });
    body += c.html;
    plan.push(...c.plan);
    captionCss = c.css;
  }

  const tween = readFileSync(path.join(skillDir(), "assets", "lib", "tween.js"), "utf8");
  const planJson = JSON.stringify(plan).replace(/</g, "\\u003c");
  const index = `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<style>${css({ w, h, brand, stack, faces, vertical })}${captionCss}</style>
</head>
<body>
<div id="root" dir="${dir}" data-composition-id="main" data-start="0" data-duration="${timing.totalSeconds}" data-width="${w}" data-height="${h}" data-fps="${fps}">
${body}</div>
<script>${tween}</script>
<script>window.__timelines = window.__timelines || {};
window.__timelines["main"] = VT.run(${planJson}, { id: "main", duration: ${timing.totalSeconds} });</script>
</body>
</html>
`;
  return {
    files: { "index.html": index },
    media,
    fonts: fonts.map(({ from, to }) => ({ from, to })),
    notes,
    size: [w, h],
  };
}

export { KINDS };
