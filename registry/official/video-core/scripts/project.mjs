// Builds a HyperFrames project (as a map of files) from video.json + timing.json + brand. Pure: it reads the
// tween helper from this skill and returns what to write; render.mjs writes it and copies the media.
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  captionClearance,
  captionProblem,
  renderCaptions,
} from "../assets/engine/hyperframes/captions.mjs";
import { KINDS, esc, kindCss, renderScene } from "../assets/engine/hyperframes/scenes.mjs";
import {
  MIN_SLASH_GAP,
  TRANSITIONS,
  transitionCss,
  transitionParts,
} from "../assets/engine/hyperframes/transitions.mjs";
import { skillDir } from "./_lib.mjs";

export const SIZES = {
  "reel-9x16": [1080, 1920],
  "short-9x16": [1080, 1920],
  "youtube-16x9": [1920, 1080],
  "square-1x1": [1080, 1080],
};
export const BUILT_TRANSITIONS = ["cut", "fade", ...TRANSITIONS];
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

/** Type for plain scenes grows a fifth on tall frames, where the width is the limit and the frame is mostly empty. */
const grow = (n, vertical) => Math.round(n * (vertical ? 1.2 : 1) * 100) / 100;

const css = ({ w, h, brand, stack, faces, vertical, bottomPad, kinds }) => `${faces}
html,body{margin:0;background:${brand.colors.bg}}
#root{--u:${w / 100}px;position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${brand.colors.bg};color:${brand.colors.fg};font-family:${stack};}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:calc(var(--u)*3);box-sizing:border-box;padding:${vertical ? "calc(var(--u)*8)" : "calc(var(--u)*6)"} calc(var(--u)*7) ${bottomPad}}
.title{margin:0;font-size:calc(var(--u)*10.5);line-height:1.08;font-weight:700;letter-spacing:-.01em}
.sub{margin:0;font-size:calc(var(--u)*${grow(3.8, vertical)});line-height:1.3;color:${brand.colors.muted}}
.quote{margin:0;padding-inline-start:calc(var(--u)*3);border-inline-start:calc(var(--u)*.8) solid ${brand.colors.accent};font-size:calc(var(--u)*${grow(5.4, vertical)});line-height:1.2;font-weight:700}
.quote p{margin:0}
.cite{margin:0;font-size:calc(var(--u)*${grow(3.4, vertical)});color:${brand.colors.muted}}
.heading{margin:0;font-size:calc(var(--u)*${grow(6, vertical)});line-height:1.1;font-weight:700}
.items{margin:0;padding-inline-start:calc(var(--u)*7);font-size:calc(var(--u)*${grow(5.2, vertical)});line-height:1.35}
.items li{position:relative;margin-bottom:calc(var(--u)*2.6)}
.rail{position:absolute;inset-inline:0;bottom:calc(var(--u)*-1);display:block;height:calc(var(--u)*.7);border-radius:calc(var(--u)*.35);background:${brand.colors.accent};transform-origin:0 50%}
[dir=rtl] .rail{transform-origin:100% 50%}
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
${kindCss(brand, vertical, kinds)}${transitionCss(brand)}`;

/**
 * Everything an engine needs to draw the film, before it is wrapped in a page: the stylesheet, the scene
 * markup, the animation plan (absolute-time Web Animations), the media to copy and the
 * canvas. Both engines (HyperFrames and Remotion) start from this, so a scene is written once.
 * Build the project (`captions` is a parsed captions.json to draw, or null). Returns { files: { "index.html": text }, media: [{ from, to }], fonts: [{ from, to }],
 * notes: [string] }. `fontFiles` are absolute paths found in brand/fonts; `assetPaths` maps asset id -> abs path.
 */
export function buildParts({
  video,
  timing,
  brand: rawBrand,
  fontFiles = [],
  assetPaths = new Map(),
  captions = null,
  words = [],
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
  // Kinetic scenes use the display font that ships with this skill (Anton, SIL OFL), copied into the project.
  if (video.scenes.some((s) => s.kind === "kinetic") && !fonts.some((f) => f.family === "Anton"))
    fonts.push({
      from: path.join(skillDir(), "assets", "fonts", "Anton-Regular.ttf"),
      to: "assets/fonts/Anton-Regular.ttf",
      family: "Anton",
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
    if (s.kind !== "broll" && s.kind !== "screen" && s.kind !== "shot") continue;
    const ids =
      s.kind === "shot"
        ? (s.props?.layers ?? []).map((l) => l?.asset)
        : ["asset", "pip"].map((key) => s.props?.[key]);
    for (const id of ids) {
      const a = (video.assets ?? []).find((x) => x.id === id);
      if (!a || assets.has(a.id)) continue;
      const file = `${a.id}${path.extname(a.path).toLowerCase()}`;
      assets.set(a.id, { file });
      media.push({ from: assetPaths.get(a.id) ?? a.path, to: `assets/media/${file}` });
    }
  }

  const plan = [];
  let body = "";
  let roots = ""; // video layers a scene needs at the top level of the page (screen recordings)
  let trans = "";
  let lastSlash = -Infinity;
  const ctxs = [];
  video.scenes.forEach((s, i) => {
    const t = timing.scenes[i];
    const first = i === 0;
    const transition = s.transitionIn ?? "cut";
    if (!BUILT_TRANSITIONS.includes(transition))
      notes.push(`scene ${s.id}: transition "${transition}" is not built yet; used cut`);
    const prefix = `sc-${s.id}`;
    const ctx = {
      prefix,
      at: t.start,
      seconds: t.seconds,
      lines: t.lines,
      lang,
      first,
      rise: Math.round((w / 100) * 2.4),
      size: [w, h],
      assets,
      words: words[i] ?? [],
      fps,
    };
    ctxs.push(ctx);
    const r = renderScene(s, ctx);
    plan.push(...r.plan);
    roots += r.root ?? "";
    if (transition === "fade" && !first)
      plan.push({
        id: prefix,
        frames: [{ opacity: 0 }, { opacity: 1 }],
        at: t.start,
        dur: FADE_FRAMES / fps,
        ease: "inOut",
      });
    body += `<section id="${prefix}" class="clip scene scene-${s.kind}" data-start="${t.start}" data-duration="${t.seconds}">${r.html}</section>\n`;
    // Overlapping transitions: the previous scene is drawn again in its final state and cut or moved away on top.
    if (!first && TRANSITIONS.includes(transition)) {
      let style = transition;
      if (style === "slash" && t.start - lastSlash < MIN_SLASH_GAP) {
        notes.push(
          `scene ${s.id}: a slash within ${MIN_SLASH_GAP} s of the last one would strobe; used a whip`,
        );
        style = "whip";
      }
      if (style === "slash") lastSlash = t.start;
      const prev = video.scenes[i - 1];
      const pc = ctxs[i - 1];
      const tr = transitionParts({
        style,
        id: `tr${i}`,
        kind: prev.kind,
        copy: (tag) => renderScene(prev, { ...pc, prefix: `${pc.prefix}-t${i}${tag}` }),
        size: [w, h],
        at: t.start,
        dur: s.transitionSeconds,
        seed: i * 17 + 3,
        angle: s.transitionAngle ?? (i % 2 ? -62 : 58),
      });
      trans += tr.html;
      plan.push(...tr.plan);
    }
  });

  body += roots;
  body += trans;

  // Scenes keep clear of burned captions: their bottom padding is at least the caption zone.
  const basePad = (w / 100) * (vertical ? 16 : 6);
  const bottomPad = `${Math.round(Math.max(basePad, captions ? captionClearance(captions, [w, h]) : 0))}px`;
  let captionCss = "";
  if (captions) {
    const problem = captionProblem(captions, fps, timing.totalSeconds);
    if (problem) throw new Error(`Captions cannot be drawn: ${problem}. Run captions.mjs again.`);
    const c = renderCaptions({ captions, brand, size: [w, h] });
    body += c.html;
    plan.push(...c.plan);
    captionCss = c.css;
  }

  const planJson = JSON.stringify(plan).replace(/</g, "\\u003c");
  return {
    css:
      css({
        w,
        h,
        brand,
        stack,
        faces,
        vertical,
        bottomPad,
        kinds: new Set(video.scenes.map((s) => s.kind)),
      }) + captionCss,
    body,
    plan,
    planJson,
    lang,
    dir,
    fps,
    seconds: timing.totalSeconds,
    media,
    fonts: fonts.map(({ from, to }) => ({ from, to })),
    notes,
    size: [w, h],
  };
}

/** Build the HyperFrames project: one index.html (see buildParts for the inputs). */
export function buildProject(args) {
  const p = buildParts(args);
  const [w, h] = p.size;
  const tween = readFileSync(path.join(skillDir(), "assets", "lib", "tween.js"), "utf8");
  const index = `<!doctype html>
<html lang="${esc(p.lang)}">
<head>
<meta charset="utf-8">
<style>${p.css}</style>
</head>
<body>
<div id="root" dir="${p.dir}" data-composition-id="main" data-start="0" data-duration="${p.seconds}" data-width="${w}" data-height="${h}" data-fps="${p.fps}">
${p.body}</div>
<script>${tween}</script>
<script>window.__timelines = window.__timelines || {};
window.__timelines["main"] = VT.run(${p.planJson}, { id: "main", duration: ${p.seconds} });</script>

</body>
</html>
`;
  return {
    files: { "index.html": index },
    media: p.media,
    fonts: p.fonts,
    notes: p.notes,
    size: p.size,
  };
}

export { KINDS };
