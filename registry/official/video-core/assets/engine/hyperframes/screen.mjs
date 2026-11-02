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

/** Padding of the device body around its screen, in units of 1% of the frame width. */
const PAD = {
  phone: { x: 2.4, top: 2.4, bottom: 2.4, r: 5, rs: 3 },
  laptop: { x: 1.6, top: 1.6, bottom: 3.4, r: 1.6, rs: 0.4 },
  browser: { x: 0.3, top: 3.8, bottom: 0.3, r: 1.2, rs: 0 },
  none: { x: 0, top: 0, bottom: 0, r: 0, rs: 0 },
};
const BODY = { phone: "#0c0d10", laptop: "#14161a", browser: "#1d2026", none: "none" };

/** The largest screen of aspect `ar` that fits `availW` x `availH` with the device padding around it. */
function fit(device, ar, availW, availH) {
  const pad = PAD[device];
  const sw = Math.min(availW - pad.x * 2, (availH - pad.top - pad.bottom) * ar);
  const sh = sw / ar;
  return { pad, sw: r2(sw), sh: r2(sh), w: r2(sw + pad.x * 2), h: r2(sh + pad.top + pad.bottom) };
}

/** Path of a rounded rectangle (units of 1% of the frame width). */
const rr = (x, y, w, h, r) => {
  const k = Math.min(r, w / 2, h / 2);
  return `M${r2(x + k)} ${r2(y)}H${r2(x + w - k)}A${k} ${k} 0 0 1 ${r2(x + w)} ${r2(y + k)}V${r2(y + h - k)}A${k} ${k} 0 0 1 ${r2(x + w - k)} ${r2(y + h)}H${r2(x + k)}A${k} ${k} 0 0 1 ${r2(x)} ${r2(y + h - k)}V${r2(y + k)}A${k} ${k} 0 0 1 ${r2(x + k)} ${r2(y)}Z`;
};

/**
 * HyperFrames wants a <video> to be its own timed clip, not inside the timed scene section, so the recording is
 * returned as `root` (placed at the top level of the page) and the section holds a mask: a layer in the page
 * colour with a hole where the screen is, the device body around it, and the cursor and ripples under the mask.
 */
export function screen(s, ctx) {
  const bad = screenProblems(s.props);
  if (bad.length) throw new Error(`Screen scene cannot be drawn: ${bad[0]}`);
  const p = s.props;
  const asset = ctx.assets.get(p.asset);
  const vp = p.viewport ?? { w: 1280, h: 720 };
  const device = p.device ?? "browser";
  const [W, H] = ctx.size ?? [1080, 1920];
  const H100 = r2((H / W) * 100);
  const vertical = H > W;
  const heading = p.title ? 8 : 0;
  const top0 = 4 + heading;
  const region = H100 - (vertical ? 18 : 8) - 4 - top0;
  const f = fit(device, vp.w / vp.h, vertical ? 92 : 86, region);
  const left = r2((100 - f.w) / 2);
  const top = r2(top0 + Math.max(0, (region - f.h) / 2));
  const sx = r2(left + f.pad.x);
  const sy = r2(top + f.pad.top);
  const pad = PAD[device];
  const hole = rr(sx, sy, f.sw, f.sh, pad.rs);
  const rect = (x, y, w, h) =>
    `left:calc(var(--u)*${x});top:calc(var(--u)*${y});width:calc(var(--u)*${w});height:calc(var(--u)*${h})`;
  const screenBox = rect(sx, sy, f.sw, f.sh);

  const id = `${ctx.prefix}-cam`;
  const vid = `${ctx.prefix}-vid`;
  const isVideo = VIDEO_EXT.test(asset.file);
  const src = `assets/media/${esc(asset.file)}`;
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
  const still = isVideo ? "" : `<img class="scr-media" src="${src}" alt="">`;

  let svg = `<path class="scr-bgfill" fill-rule="evenodd" d="M0 0H100V${H100}H0Z${hole}"/>`;
  if (device !== "none") {
    svg += `<path fill="${BODY[device]}" fill-rule="evenodd" d="${rr(left, top, f.w, f.h, pad.r)}${hole}"/>`;
    if (device === "phone")
      svg += `<path fill="none" stroke="#2b2e35" stroke-width="0.25" d="${rr(left, top, f.w, f.h, pad.r)}"/>`;
    if (device === "laptop")
      svg += `<path fill="#2b2e35" d="${rr(left - 2, top + f.h, f.w + 4, 1.2, 0.6)}"/>`;
    if (device === "browser") {
      for (let k = 0; k < 3; k++)
        svg += `<circle cx="${r2(left + 1.7 + k * 1.8)}" cy="${r2(top + 1.9)}" r="0.5" fill="#5a5f69"/>`;
      svg += `<path fill="#2b2e35" d="${rr(left + 7.4, top + 1, f.w - 9, 1.8, 0.9)}"/>`;
    }
  }
  const title = p.title ? `<p class="scr-title">${esc(p.title)}</p>` : "";
  const html =
    `<div class="scr-view" style="${screenBox}"><div id="${id}" class="scr-pan">${still}${ripples}${cursor}</div></div>` +
    `<svg class="scr-over" viewBox="0 0 100 ${H100}" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>` +
    title;

  let root = "";
  if (isVideo)
    root += `<video id="${vid}" class="clip scr-vid" data-start="${ctx.at}" data-duration="${ctx.seconds}" data-track-index="2" src="${src}" muted playsinline style="${screenBox}"></video>`;
  if (p.pip) {
    const a = ctx.assets.get(p.pip);
    root += `<video id="${ctx.prefix}-pip" class="clip scr-pip" data-start="${ctx.at}" data-duration="${ctx.seconds}" data-track-index="3" src="assets/media/${esc(a.file)}" muted playsinline></video>`;
  }

  const plan = [];
  if (p.zoom?.length) {
    const frames = cameraFrames(p.zoom, ctx.seconds);
    for (const target of isVideo ? [id, vid] : [id])
      plan.push({ id: target, frames, at: ctx.at, dur: ctx.seconds, ease: "linear" });
  }
  if (p.cursor?.length) {
    const pts = p.cursor.filter((c) => c.t <= ctx.seconds);
    if (pts.length) {
      const pos = (c) => ({ left: `${r4(c.x * 100)}%`, top: `${r4(c.y * 100)}%` });
      const frames = [
        { offset: 0, ...pos(pts[0]) },
        ...pts.map((c) => ({ offset: r4(Math.min(1, c.t / ctx.seconds)), ...pos(c) })),
        { offset: 1, ...pos(pts.at(-1)) },
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
  return { html, plan, root };
}

export const screenCss = (brand) => `
.scene-screen{padding:0;z-index:2}
.scr-over{position:absolute;inset:0;width:100%;height:100%}
.scr-bgfill{fill:${brand.colors.bg}}
.scr-title{position:absolute;inset-inline:0;top:calc(var(--u)*4);margin:0;font-size:calc(var(--u)*4.6);font-weight:700;line-height:1.15;text-align:center}
.scr-view{position:absolute;overflow:hidden;direction:ltr}
.scr-pan{position:absolute;inset:0;transform-origin:0 0}
.scr-vid{position:absolute;z-index:1;transform-origin:0 0;object-fit:fill}
.scr-media{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}
.scr-cursor{position:absolute;left:0;top:0;width:calc(var(--u)*1.9);height:calc(var(--u)*2.8);fill:#fff;stroke:#000;stroke-width:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
.scr-ripple{position:absolute;width:calc(var(--u)*5);height:calc(var(--u)*5);border-radius:50%;border:calc(var(--u)*.4) solid ${brand.colors.accent};background:rgba(255,255,255,.18);opacity:0}
.scr-pip{position:absolute;z-index:3;inset-inline-end:calc(var(--u)*4);bottom:calc(var(--u)*20);width:calc(var(--u)*20);height:calc(var(--u)*20);border-radius:50%;object-fit:cover;border:calc(var(--u)*.5) solid ${brand.colors.accent}}
`;
