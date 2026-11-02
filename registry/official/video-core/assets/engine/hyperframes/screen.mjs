// The `screen` scene: a screen recording shown inside an original, generic device frame (phone, laptop or
// browser window), with a camera that eases in on the action, a smoothed cursor and click ripples. The
// camera, cursor and ripples are data (zoom, cursor, ripples), made by video-showcase's plan.mjs from the
// interaction log, so the film follows what really happened on screen. Speed-ups and cut waits are done on
// the media file beforehand, so every time here is in the scene's own clock. All text is escaped.
import { esc } from "./shared.mjs";

export const DEVICES = ["phone", "laptop", "browser", "none"];
export const LIMITS = { zoom: 40, cursor: 600, ripples: 60, scale: 3, seconds: 600 };
const ID = /^[a-z][a-z0-9-]{0,31}$/;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const RIPPLE = 0.55;
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
const unit = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
const time = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= LIMITS.seconds;

/** Problems with a screen scene's props, as readable strings. */
export function screenProblems(props) {
  const out = [];
  if (!ID.test(props.asset ?? "")) out.push("asset: name the id of the recording in assets");
  if (props.pip !== undefined && !ID.test(props.pip)) out.push("pip: must be an asset id");
  if (props.device !== undefined && !DEVICES.includes(props.device))
    out.push(`device: one of ${DEVICES.join(", ")}`);
  const vp = props.viewport;
  if (vp !== undefined) {
    const ok = (n) => Number.isInteger(n) && n >= 200 && n <= 4000;
    if (!vp || !ok(vp.w) || !ok(vp.h)) out.push("viewport: {w, h} in pixels, 200 to 4000");
  }
  const list = (key, max) => {
    const v = props[key];
    if (v === undefined) return [];
    if (!Array.isArray(v)) {
      out.push(`${key}: must be a list`);
      return [];
    }
    if (v.length > max) out.push(`${key}: at most ${max} entries`);
    return v.slice(0, max);
  };
  let prevEnd = 0;
  list("zoom", LIMITS.zoom).forEach((z, i) => {
    const at = `zoom[${i}]`;
    if (!z || typeof z !== "object") return void out.push(`${at}: must be an object`);
    if (!time(z.at) || !(z.dur > 0 && z.dur <= 30))
      return void out.push(`${at}: at (seconds) and dur (0 to 30 s) are needed`);
    if (!unit(z.x) || !unit(z.y)) out.push(`${at}: x and y are 0 to 1 across the recording`);
    if (!(z.scale >= 1 && z.scale <= LIMITS.scale)) out.push(`${at}.scale: 1 to ${LIMITS.scale}`);
    if (z.at < prevEnd - 1e-6)
      out.push(`${at}: starts before the previous zoom ends (${r2(prevEnd)} s); move or shorten`);
    prevEnd = z.at + z.dur;
  });
  let prevT = -1;
  list("cursor", LIMITS.cursor).forEach((c, i) => {
    if (!c || !time(c.t) || !unit(c.x) || !unit(c.y))
      return void out.push(`cursor[${i}]: t (seconds), x and y (0 to 1) are needed`);
    if (c.t < prevT) out.push(`cursor[${i}].t: points must be in time order`);
    prevT = c.t;
  });
  list("ripples", LIMITS.ripples).forEach((c, i) => {
    if (!c || !time(c.t) || !unit(c.x) || !unit(c.y))
      out.push(`ripples[${i}]: t (seconds), x and y (0 to 1) are needed`);
  });
  if (props.title !== undefined && (typeof props.title !== "string" || props.title.length > 120))
    out.push("title: text of at most 120 characters");
  return out;
}

/** The transform for a camera looking at (x, y) at `scale`, clamped so the view never leaves the recording. */
export function cameraTransform(x, y, scale) {
  const half = 0.5 / scale;
  const cx = Math.min(Math.max(x, half), 1 - half);
  const cy = Math.min(Math.max(y, half), 1 - half);
  const tx = -(scale * cx - 0.5) * 100;
  const ty = -(scale * cy - 0.5) * 100;
  return `translate(${r2(tx)}%, ${r2(ty)}%) scale(${r2(scale)})`;
}

/** Keyframes for the camera over a scene of `seconds`: hold, ease to each target, hold. */
export function cameraFrames(zoom, seconds) {
  const off = (t) => r4(Math.min(1, Math.max(0, t / seconds)));
  let at = cameraTransform(0.5, 0.5, 1);
  const frames = [{ offset: 0, transform: at, easing: "cubic-bezier(0.65, 0, 0.35, 1)" }];
  for (const z of zoom) {
    frames.push({ offset: off(z.at), transform: at, easing: "cubic-bezier(0.65, 0, 0.35, 1)" });
    at = cameraTransform(z.x, z.y, z.scale);
    frames.push({ offset: off(z.at + z.dur), transform: at, easing: "linear" });
  }
  frames.push({ offset: 1, transform: at });
  // Keyframe offsets must not decrease; equal offsets are fine.
  for (let i = 1; i < frames.length; i++)
    frames[i].offset = Math.max(frames[i].offset, frames[i - 1].offset);
  return frames;
}

/** Sizes in units of 1% of the frame width: the screen's width, its frame padding, and the outer box. */
function fit(device, ar, availW, availH) {
  const pad = {
    phone: { x: 2.4, top: 2.4, bottom: 2.4 },
    laptop: { x: 1.6, top: 1.6, bottom: 3.4 },
    browser: { x: 0.3, top: 3.8, bottom: 0.3 },
    none: { x: 0, top: 0, bottom: 0 },
  }[device];
  const sw = Math.min(availW - pad.x * 2, (availH - pad.top - pad.bottom) * ar);
  const sh = sw / ar;
  return { pad, sw: r2(sw), sh: r2(sh), w: r2(sw + pad.x * 2), h: r2(sh + pad.top + pad.bottom) };
}

export function screen(s, ctx) {
  const bad = screenProblems(s.props);
  if (bad.length) throw new Error(`Screen scene cannot be drawn: ${bad[0]}`);
  const p = s.props;
  const asset = ctx.assets.get(p.asset);
  const vp = p.viewport ?? { w: 1280, h: 720 };
  const device = p.device ?? "browser";
  const [W, H] = ctx.size ?? [1080, 1920];
  const vertical = H > W;
  const heading = p.title ? 8 : 0;
  const availW = vertical ? 92 : 86;
  const availH = (H / W) * 100 - 2 * 4 - (vertical ? 18 : 8) - heading;
  const f = fit(device, vp.w / vp.h, availW, availH);
  const id = `${ctx.prefix}-cam`;
  const src = `assets/media/${esc(asset.file)}`;
  const media = VIDEO_EXT.test(asset.file)
    ? `<video class="scr-media" src="${src}" muted playsinline></video>`
    : `<img class="scr-media" src="${src}" alt="">`;
  const cursorId = `${ctx.prefix}-cur`;
  const cursor = p.cursor?.length
    ? `<svg id="${cursorId}" class="scr-cursor" viewBox="0 0 12 18" aria-hidden="true"><path d="M1 1 L1 14 L4.4 11 L6.8 16.6 L9 15.6 L6.6 10.2 L11 10 Z"/></svg>`
    : "";
  const ripples = (p.ripples ?? [])
    .map(
      (r, i) =>
        `<span id="${ctx.prefix}-rp${i}" class="scr-ripple" style="left:${r4(r.x * 100)}%;top:${r4(r.y * 100)}%"></span>`,
    )
    .join("");
  let pip = "";
  if (p.pip) {
    const a = ctx.assets.get(p.pip);
    pip = `<video class="scr-pip" src="assets/media/${esc(a.file)}" muted playsinline></video>`;
  }
  const title = p.title ? `<p class="scr-title">${esc(p.title)}</p>` : "";
  const chrome =
    device === "browser"
      ? `<div class="scr-bar"><i></i><i></i><i></i><b></b></div>`
      : device === "laptop"
        ? `<div class="scr-base"></div>`
        : "";
  const html =
    title +
    `<div class="scr-dev scr-${device}" style="width:calc(var(--u)*${f.w});height:calc(var(--u)*${f.h});padding:calc(var(--u)*${f.pad.top}) calc(var(--u)*${f.pad.x}) calc(var(--u)*${f.pad.bottom})">` +
    chrome +
    `<div class="scr-view"><div id="${id}" class="scr-pan">${media}${ripples}${cursor}</div></div></div>` +
    pip;

  const plan = [];
  if (p.zoom?.length)
    plan.push({
      id,
      frames: cameraFrames(p.zoom, ctx.seconds),
      at: ctx.at,
      dur: ctx.seconds,
      ease: "linear",
    });
  if (p.cursor?.length) {
    const pts = p.cursor.filter((c) => c.t <= ctx.seconds);
    if (pts.length) {
      const frames = [
        { offset: 0, left: `${r4(pts[0].x * 100)}%`, top: `${r4(pts[0].y * 100)}%` },
        ...pts.map((c) => ({
          offset: r4(Math.min(1, c.t / ctx.seconds)),
          left: `${r4(c.x * 100)}%`,
          top: `${r4(c.y * 100)}%`,
        })),
        { offset: 1, left: `${r4(pts.at(-1).x * 100)}%`, top: `${r4(pts.at(-1).y * 100)}%` },
      ];
      plan.push({ id: cursorId, frames, at: ctx.at, dur: ctx.seconds, ease: "linear" });
    }
  }
  (p.ripples ?? []).forEach((r, i) => {
    plan.push({
      id: `${ctx.prefix}-rp${i}`,
      frames: [
        { opacity: 0, transform: "translate(-50%,-50%) scale(0.2)", offset: 0 },
        { opacity: 0.85, transform: "translate(-50%,-50%) scale(0.6)", offset: 0.18 },
        { opacity: 0, transform: "translate(-50%,-50%) scale(2.2)", offset: 1 },
      ],
      at: ctx.at + r.t,
      dur: RIPPLE,
      ease: "out",
    });
  });
  return { html, plan };
}

export const screenCss = (brand) => `
.scene-screen{align-items:center;gap:calc(var(--u)*2)}
.scr-title{margin:0;font-size:calc(var(--u)*4.6);font-weight:700;line-height:1.15;text-align:center}
.scr-dev{position:relative;box-sizing:border-box;flex:none;background:#14161a;border-radius:calc(var(--u)*1.4);box-shadow:0 calc(var(--u)*1.6) calc(var(--u)*5) rgba(0,0,0,.35)}
.scr-phone{border-radius:calc(var(--u)*5);background:#0c0d10;border:calc(var(--u)*.25) solid #2b2e35}
.scr-phone .scr-view{border-radius:calc(var(--u)*3)}
.scr-laptop{border-radius:calc(var(--u)*1.6) calc(var(--u)*1.6) 0 0}
.scr-base{position:absolute;left:-4%;right:-4%;bottom:calc(var(--u)*-1.2);height:calc(var(--u)*1.2);background:#2b2e35;border-radius:0 0 calc(var(--u)*1.4) calc(var(--u)*1.4)}
.scr-browser{background:#1d2026}
.scr-bar{position:absolute;inset:0 0 auto 0;height:calc(var(--u)*3.8);display:flex;align-items:center;gap:calc(var(--u)*.7);padding:0 calc(var(--u)*1.4)}
.scr-bar i{width:calc(var(--u)*1);height:calc(var(--u)*1);border-radius:50%;background:#5a5f69}
.scr-bar b{flex:1;height:calc(var(--u)*1.7);margin-inline-start:calc(var(--u)*1.4);border-radius:calc(var(--u)*.9);background:#2b2e35}
.scr-none{background:none;box-shadow:none}
.scr-view{position:relative;width:100%;height:100%;overflow:hidden;background:#000;direction:ltr}
.scr-pan{position:absolute;inset:0;transform-origin:0 0;will-change:transform}
.scr-media{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}
.scr-cursor{position:absolute;left:0;top:0;width:calc(var(--u)*1.9);height:calc(var(--u)*2.8);fill:#fff;stroke:#000;stroke-width:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
.scr-ripple{position:absolute;width:calc(var(--u)*5);height:calc(var(--u)*5);border-radius:50%;border:calc(var(--u)*.4) solid ${brand.colors.accent};background:rgba(255,255,255,.18);opacity:0}
.scr-pip{position:absolute;inset-inline-end:calc(var(--u)*4);bottom:calc(var(--u)*20);width:calc(var(--u)*20);height:calc(var(--u)*20);border-radius:50%;object-fit:cover;border:calc(var(--u)*.5) solid ${brand.colors.accent}}
`;
