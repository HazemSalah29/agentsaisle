// The `shot` scene: one beat of a product or launch edit built from the user's own photos. Layers (a photo, its
// cutout, an overlay) move at different speeds for a 2.5D parallax; a camera pushes, pans, whips or orbits with
// optional speed ramps; kinetic type, small cards, grain, vignette, flashes, shakes and RGB-ghost glitches are
// timed to the beat. Everything is CSS and the Web Animations plan (a function of time), with no script and no
// WebGL in the page. Camera, shake and glitch motion is sampled from pure functions below, so a frame depends on
// the clock alone and every string is escaped.
import { esc } from "./shared.mjs";

export const LIMITS = {
  layers: 4,
  type: 3,
  cards: 3,
  text: 48,
  sub: 40,
  times: 8,
  flashGap: 0.4,
};
export const MOVES = [
  "push",
  "pull",
  "pan-l",
  "pan-r",
  "tilt-up",
  "tilt-down",
  "whip-l",
  "whip-r",
  "orbit",
  "hold",
];
export const ROLES = ["bg", "subject", "overlay"];
export const TYPE_STYLES = ["slam", "stagger", "glitch", "tag", "price"];
export const ANCHORS = ["top", "center", "bottom"];
export const GRADES = ["none", "punch", "warm", "cool", "mono", "film"];
export const ENTERS = ["cut", "flash", "whip-l", "whip-r", "zoom", "glitch"];
export const EASES = ["linear", "out", "inOut", "in", "expo", "snap", "spring", "outBack"];

/** Named easing curves as pure functions, so camera moves are sampled instead of handed to the browser. */
export const EASE_FN = {
  linear: (t) => t,
  out: (t) => 1 - (1 - t) ** 5,
  inOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  in: (t) => t ** 3,
  expo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  snap: (t) => 1 - (1 - t) ** 7,
  spring: (t) => 1 - Math.cos(t * 4.5 * Math.PI) * Math.exp(-6 * t),
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};

const GRADE_CSS = {
  none: "none",
  punch: "contrast(1.12) saturate(1.25)",
  warm: "sepia(0.18) saturate(1.1) contrast(1.05) hue-rotate(-8deg)",
  cool: "hue-rotate(10deg) saturate(0.95) contrast(1.06)",
  mono: "grayscale(1) contrast(1.15)",
  film: "contrast(0.96) saturate(0.9) sepia(0.12)",
};
const DEFAULT_DEPTH = { bg: 0, subject: 0.6, overlay: 1 };
const ID = /^[a-z][a-z0-9-]{0,31}$/;
const num = (v) => typeof v === "number" && Number.isFinite(v);
const r3 = (n) => Math.round(n * 1000) / 1000;
/** A repeatable pseudo-random number in [0, 1) for an integer key. */
export const rnd = (k) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const times = (v) => (Array.isArray(v) ? v : []);

/** Problems with a shot scene's props, as readable strings. `seconds` (optional) bounds the effect times. Pure. */
export function shotProblems(props, seconds) {
  const p = [];
  const layers = props.layers;
  if (!Array.isArray(layers) || layers.length < 1 || layers.length > LIMITS.layers)
    return [`layers: a list of 1 to ${LIMITS.layers} layers`];
  layers.forEach((l, i) => {
    const at = `layers[${i}]`;
    if (!ID.test(l?.asset ?? "")) p.push(`${at}.asset: an asset id`);
    if (l?.role !== undefined && !ROLES.includes(l.role))
      p.push(`${at}.role: one of ${ROLES.join(", ")}`);
    if (l?.depth !== undefined && !(num(l.depth) && l.depth >= 0 && l.depth <= 1))
      p.push(`${at}.depth: a number from 0 to 1`);
  });
  const cam = props.camera;
  if (cam !== undefined) {
    if (!cam || typeof cam !== "object") p.push("camera: an object");
    else {
      if (!MOVES.includes(cam.move)) p.push(`camera.move: one of ${MOVES.join(", ")}`);
      for (const k of ["from", "to"])
        if (cam[k] !== undefined && !(num(cam[k]) && cam[k] >= 0.8 && cam[k] <= 2.5))
          p.push(`camera.${k}: a zoom from 0.8 to 2.5`);
      if (cam.ease !== undefined && !EASES.includes(cam.ease))
        p.push(`camera.ease: one of ${EASES.join(", ")}`);
      if (cam.ramp !== undefined) {
        const r = cam.ramp;
        const ok =
          Array.isArray(r) &&
          r.length === 3 &&
          r.every(num) &&
          r[0] >= 0 &&
          r[1] <= 1 &&
          r[0] < r[1] &&
          r[2] >= 0.2 &&
          r[2] <= 4;
        if (!ok)
          p.push("camera.ramp: [start, end, speed] with 0 <= start < end <= 1 and speed 0.2 to 4");
      }
    }
  }
  const type = props.type ?? [];
  if (!Array.isArray(type) || type.length > LIMITS.type)
    p.push(`type: at most ${LIMITS.type} text items`);
  else
    type.forEach((t, i) => {
      const at = `type[${i}]`;
      if (typeof t?.text !== "string" || !t.text.trim() || t.text.length > LIMITS.text)
        p.push(`${at}.text: 1 to ${LIMITS.text} characters`);
      if (!TYPE_STYLES.includes(t?.style)) p.push(`${at}.style: one of ${TYPE_STYLES.join(", ")}`);
      if (!(num(t?.at) && t.at >= 0 && (seconds === undefined || t.at < seconds)))
        p.push(`${at}.at: a time inside the scene`);
      if (t?.anchor !== undefined && !ANCHORS.includes(t.anchor))
        p.push(`${at}.anchor: one of ${ANCHORS.join(", ")}`);
      if (t?.size !== undefined && !(num(t.size) && t.size >= 2 && t.size <= 24))
        p.push(`${at}.size: 2 to 24`);
    });
  const cards = props.cards ?? [];
  if (!Array.isArray(cards) || cards.length > LIMITS.cards)
    p.push(`cards: at most ${LIMITS.cards}`);
  else
    cards.forEach((c, i) => {
      const at = `cards[${i}]`;
      if (typeof c?.text !== "string" || !c.text.trim() || c.text.length > LIMITS.text)
        p.push(`${at}.text: 1 to ${LIMITS.text} characters`);
      if (c?.sub !== undefined && (typeof c.sub !== "string" || c.sub.length > LIMITS.sub))
        p.push(`${at}.sub: up to ${LIMITS.sub} characters`);
      if (!(num(c?.at) && c.at >= 0 && (seconds === undefined || c.at < seconds)))
        p.push(`${at}.at: a time inside the scene`);
      for (const k of ["x", "y"])
        if (!(num(c?.[k]) && c[k] >= 8 && c[k] <= 92))
          p.push(`${at}.${k}: 8 to 92 (percent, keeps clear of the edges)`);
      if (c?.style !== undefined && !["pill", "card"].includes(c.style))
        p.push(`${at}.style: pill or card`);
    });
  const fx = props.fx;
  if (fx !== undefined) {
    if (!fx || typeof fx !== "object") p.push("fx: an object");
    else {
      if (fx.grade !== undefined && !GRADES.includes(fx.grade))
        p.push(`fx.grade: one of ${GRADES.join(", ")}`);
      for (const k of ["grain", "vignette"])
        if (fx[k] !== undefined && typeof fx[k] !== "boolean") p.push(`fx.${k}: true or false`);
      for (const k of ["glitch", "flash", "shake"]) {
        const ts = fx[k];
        if (ts === undefined) continue;
        const ok =
          Array.isArray(ts) &&
          ts.length <= LIMITS.times &&
          ts.every((t) => num(t) && t >= 0 && (seconds === undefined || t < seconds));
        if (!ok) p.push(`fx.${k}: up to ${LIMITS.times} times (seconds) inside the scene`);
        else if (k === "flash") {
          const s = [...ts].sort((a, b) => a - b);
          if (s.some((t, i) => i && t - s[i - 1] < LIMITS.flashGap))
            p.push(
              `fx.flash: flashes at least ${LIMITS.flashGap} s apart (fast flashing is unsafe)`,
            );
        }
      }
    }
  }
  const enter = props.enter;
  if (enter !== undefined) {
    if (!enter || typeof enter !== "object" || !ENTERS.includes(enter.style))
      p.push(`enter.style: one of ${ENTERS.join(", ")}`);
    else if (enter.dur !== undefined && !(num(enter.dur) && enter.dur >= 0.1 && enter.dur <= 0.8))
      p.push("enter.dur: 0.1 to 0.8 seconds");
  }
  return p;
}

/**
 * The camera at progress `u` (0 to 1) as { s: scale, x, y: percent shifts, r: degrees }. `ramp` is
 * [start, end, speed]: inside it the camera moves `speed` times as fast (a speed ramp). Pure.
 */
export function camState(cam, u) {
  const move = cam?.move ?? "push";
  const ease = EASE_FN[cam?.ease] ?? EASE_FN.out;
  let p = u;
  if (cam?.ramp) {
    const [a, b, m] = cam.ramp;
    const cum = (v) => v + (m - 1) * Math.max(0, Math.min(v, b) - a);
    p = cum(u) / cum(1);
  }
  const e = ease(Math.max(0, Math.min(1, p)));
  const lerp = (a, b) => a + (b - a) * e;
  switch (move) {
    case "push":
      return { s: lerp(cam.from ?? 1, cam.to ?? 1.2), x: 0, y: 0, r: 0 };
    case "pull":
      return { s: lerp(cam.from ?? 1.22, cam.to ?? 1.02), x: 0, y: 0, r: 0 };
    case "pan-l":
      return { s: cam.from ?? 1.14, x: lerp(4, -4), y: 0, r: 0 };
    case "pan-r":
      return { s: cam.from ?? 1.14, x: lerp(-4, 4), y: 0, r: 0 };
    case "tilt-up":
      return { s: cam.from ?? 1.14, x: 0, y: lerp(4, -4), r: 0 };
    case "tilt-down":
      return { s: cam.from ?? 1.14, x: 0, y: lerp(-4, 4), r: 0 };
    case "whip-l":
    case "whip-r":
      return { s: lerp(cam.from ?? 1.05, cam.to ?? 1.18), x: 0, y: 0, r: 0 };
    case "orbit":
      return { s: cam.from ?? 1.14, x: 0, y: 0, r: lerp(-2.2, 2.2) };
    default:
      return { s: cam?.from ?? 1, x: 0, y: 0, r: 0 };
  }
}

/** Shake and glitch offsets at time `t`: { x, y (percent), skew (degrees) }. Pure and repeatable. */
export function jitterAt(t, shakes, glitches) {
  let x = 0;
  let y = 0;
  let skew = 0;
  for (const [i, s] of shakes.entries()) {
    const d = t - s;
    if (d < 0 || d > 0.28) continue;
    const a = 0.9 * (1 - d / 0.28) ** 2;
    const k = Math.floor(t * 30) + i * 101;
    x += (rnd(k) - 0.5) * 2 * a;
    y += (rnd(k + 57) - 0.5) * 2 * a;
  }
  for (const [i, g] of glitches.entries()) {
    const d = t - g;
    if (d < 0 || d > 0.2) continue;
    const k = Math.floor(t * 15) + i * 211;
    x += (rnd(k) - 0.5) * 3.2;
    skew += (rnd(k + 9) - 0.5) * 8;
  }
  return { x, y, skew };
}

/** Evenly spaced samples of [0, seconds] with a hard cap, always including both ends. */
const samples = (seconds, perSecond = 24, max = 120) => {
  const n = Math.min(max, Math.max(2, Math.ceil(seconds * perSecond) + 1));
  return Array.from({ length: n }, (_, i) => i / (n - 1));
};

const GRAIN_SVG = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>",
);

/** The scene's markup and its animation plan. */
export function shot(s, ctx) {
  const props = s.props;
  const bad = shotProblems(props, ctx.seconds);
  if (bad.length) throw new Error(`Shot scene cannot be drawn: ${bad[0]}`);
  const P = ctx.prefix;
  const T = ctx.seconds;
  const plan = [];
  const cam = props.camera ?? { move: "push" };
  const fx = props.fx ?? {};
  const flashes = times(fx.flash);
  const shakes = times(fx.shake);
  const enter = props.enter ?? { style: "cut" };
  // A glitch entrance is a burst at time zero.
  const glitches = [...times(fx.glitch), ...(enter.style === "glitch" ? [0] : [])];
  const eDur = enter.dur ?? (enter.style === "zoom" ? 0.35 : 0.28);
  const grade = GRADE_CSS[fx.grade ?? "none"];
  const us = samples(T);

  // Layers: each moves with its own share of the camera, so nearer layers travel further (parallax).
  let layersHtml = "";
  props.layers.forEach((l, i) => {
    const a = ctx.assets.get(l.asset);
    if (!a) throw new Error(`Shot scene: asset "${l.asset}" is not listed in assets`);
    const id = `${P}-L${i}`;
    const depth = l.depth ?? DEFAULT_DEPTH[l.role ?? "bg"];
    const f = 0.75 + 0.5 * depth;
    layersHtml += `<div id="${id}" class="shot-layer"><img class="shot-img" src="assets/media/${esc(a.file)}" alt=""></div>`;
    plan.push({
      id,
      frames: us.map((u) => {
        const c = camState(cam, u);
        const sc = 1 + (c.s - 1) * f;
        return {
          offset: r3(u),
          transform: `translate(${r3(c.x * f)}%, ${r3(c.y * f)}%) rotate(${r3(c.r * f)}deg) scale(${r3(sc)})`,
        };
      }),
      at: ctx.at,
      dur: T,
      ease: "linear",
    });
  });

  // RGB-ghost copies of the first layer, flickering at each glitch time.
  let ghosts = "";
  if (glitches.length) {
    const a0 = ctx.assets.get(props.layers[0].asset);
    for (const [k, filt] of [
      ["r", "sepia(1) saturate(7) hue-rotate(-40deg)"],
      ["b", "sepia(1) saturate(7) hue-rotate(150deg)"],
    ]) {
      const id = `${P}-g${k}`;
      ghosts += `<div id="${id}" class="shot-ghost" style="filter:${filt}"><img class="shot-img" src="assets/media/${esc(a0.file)}" alt=""></div>`;
      const dir = k === "r" ? 1 : -1;
      const frames = [{ offset: 0, opacity: 0, transform: "translateX(0%)" }];
      for (const g of [...glitches].sort((x, y) => x - y)) {
        const o = (t) => r3(Math.min(1, Math.max(0, t / T)));
        frames.push(
          { offset: o(g - 0.001), opacity: 0, transform: "translateX(0%)" },
          { offset: o(g), opacity: 0.7, transform: `translateX(${1.4 * dir}%)` },
          { offset: o(g + 0.06), opacity: 0, transform: "translateX(0%)" },
          { offset: o(g + 0.09), opacity: 0.55, transform: `translateX(${-1.1 * dir}%)` },
          { offset: o(g + 0.16), opacity: 0, transform: "translateX(0%)" },
        );
      }
      frames.push({ offset: 1, opacity: 0, transform: "translateX(0%)" });
      plan.push({ id, frames, at: ctx.at, dur: T, ease: "linear" });
    }
  }

  // Wrappers: enter (whip, zoom) outside, shake and glitch jitter inside, grade on the outside.
  const jittery = shakes.length || glitches.length;
  const camId = `${P}-cam`;
  const shakeId = `${P}-sh`;
  let inner = layersHtml + ghosts;
  if (jittery) {
    inner = `<div id="${shakeId}" class="shot-fill">${inner}</div>`;
    plan.push({
      id: shakeId,
      frames: us.map((u) => {
        const j = jitterAt(u * T, shakes, glitches);
        return {
          offset: r3(u),
          transform: `translate(${r3(j.x)}%, ${r3(j.y)}%) skewX(${r3(j.skew)}deg)`,
        };
      }),
      at: ctx.at,
      dur: T,
      ease: "linear",
    });
  }
  const enterFrames = {
    "whip-l": [
      { transform: "translateX(-38%)", filter: "blur(22px)" },
      { transform: "translateX(0%)", filter: "blur(0px)" },
    ],
    "whip-r": [
      { transform: "translateX(38%)", filter: "blur(22px)" },
      { transform: "translateX(0%)", filter: "blur(0px)" },
    ],
    zoom: [
      { transform: "scale(1.7)", filter: "blur(16px)" },
      { transform: "scale(1)", filter: "blur(0px)" },
    ],
  }[enter.style];
  if (enterFrames) {
    plan.push({ id: camId, frames: enterFrames, at: ctx.at, dur: Math.min(eDur, T), ease: "out" });
  }
  let html = `<div class="shot-root"><div id="${camId}" class="shot-fill" style="filter:${grade}">${inner}</div>`;

  // Overlays: grain, vignette, flashes.
  if (fx.vignette) html += `<div class="shot-vignette"></div>`;
  if (fx.grain) {
    const id = `${P}-gr`;
    html += `<div id="${id}" class="shot-grain" style="background-image:url(&quot;data:image/svg+xml,${GRAIN_SVG}&quot;)"></div>`;
    const steps = Math.max(2, Math.ceil(T * 12));
    const frames = [];
    for (let k = 0; k < steps; k++) {
      const x = r3((rnd(k * 3 + 1) - 0.5) * 8);
      const y = r3((rnd(k * 3 + 2) - 0.5) * 8);
      const tr = `translate(${x}%, ${y}%)`;
      frames.push(
        { offset: r3(k / steps), transform: tr },
        { offset: r3((k + 0.999) / steps), transform: tr },
      );
    }
    frames.push({ offset: 1, transform: frames[frames.length - 1].transform });
    plan.push({ id, frames, at: ctx.at, dur: T, ease: "linear" });
  }
  const flashAt = [...flashes];
  if (enter.style === "flash") flashAt.push(0);
  if (flashAt.length) {
    const id = `${P}-fl`;
    html += `<div id="${id}" class="shot-flash"></div>`;
    const o = (t) => r3(Math.min(1, Math.max(0, t / T)));
    const frames = [{ offset: 0, opacity: 0 }];
    for (const t of [...flashAt].sort((a, b) => a - b))
      frames.push(
        { offset: o(Math.max(0, t - 0.001)), opacity: 0 },
        { offset: o(t + 0.04), opacity: 0.85 },
        { offset: o(t + 0.22), opacity: 0 },
      );
    frames.push({ offset: 1, opacity: 0 });
    plan.push({ id, frames, at: ctx.at, dur: T, ease: "linear" });
  }

  // Type: one idea at a time; each style has its own entrance.
  const anchorTop = { top: "13%", center: "44%", bottom: "64%" };
  (props.type ?? []).forEach((t, i) => {
    const id = `${P}-t${i}`;
    const top = anchorTop[t.anchor ?? "center"];
    const size = t.size ?? { slam: 13, stagger: 9, glitch: 11, tag: 5.2, price: 18 }[t.style];
    const at = ctx.at + t.at;
    if (t.style === "stagger") {
      const words = t.text.trim().split(/\s+/);
      html += `<div class="shot-type" style="top:${top};font-size:calc(var(--u)*${size})"><div id="${id}" class="shot-line">${words
        .map((w, k) => `<span id="${id}-w${k}" class="shot-word">${esc(w)}</span>`)
        .join(" ")}</div></div>`;
      words.forEach((_, k) =>
        plan.push({
          id: `${id}-w${k}`,
          frames: [
            { opacity: 0, transform: "translateY(55%)" },
            { opacity: 1, transform: "translateY(0%)" },
          ],
          at: at + k * 0.09,
          dur: 0.32,
          ease: "out",
        }),
      );
      return;
    }
    const cls = { slam: "shot-slam", glitch: "shot-glitch", tag: "shot-tag", price: "shot-price" }[
      t.style
    ];
    html += `<div class="shot-type" style="top:${top};font-size:calc(var(--u)*${size})"><div id="${id}" class="${cls}">${esc(t.text)}</div></div>`;
    if (t.style === "glitch") {
      const hold = [-3, 2.5, -1.5, 1, 0].map((x, k, a) => ({
        offset: r3(k / (a.length - 1)),
        opacity: k % 2 === 0 ? 0.4 : 1,
        transform: `translateX(${x}%)`,
      }));
      plan.push({ id, frames: hold, at, dur: 0.3, ease: "linear" });
    } else {
      const from = t.style === "slam" ? 1.7 : t.style === "price" ? 1.35 : 0.6;
      plan.push({
        id,
        frames: [
          { opacity: 0, transform: `scale(${from})` },
          { opacity: 1, transform: "scale(1)" },
        ],
        at,
        dur: t.style === "tag" ? 0.28 : 0.22,
        ease: "out",
      });
    }
  });

  // Cards: small pills and cards that pop in at a point of the frame.
  (props.cards ?? []).forEach((c, i) => {
    const id = `${P}-c${i}`;
    const sub = c.sub ? `<small>${esc(c.sub)}</small>` : "";
    html += `<div class="shot-pos" style="left:${c.x}%;top:${c.y}%"><div id="${id}" class="shot-card-${c.style ?? "pill"}">${esc(c.text)}${sub}</div></div>`;
    plan.push({
      id,
      frames: [
        { opacity: 0, transform: "translateY(26%) scale(0.85)" },
        { opacity: 1, transform: "translateY(0%) scale(1)" },
      ],
      at: ctx.at + c.at,
      dur: 0.3,
      ease: "out",
    });
  });
  html += "</div>";
  return { html, plan };
}

/** Styles for the shot scene. The scene fills the whole frame; text keeps to the library's brand colours. */
export const shotCss = (brand) => `
.scene-shot{padding:0}
.shot-root{position:absolute;inset:0;overflow:hidden;background:#000}
.shot-fill{position:absolute;inset:0}
.shot-layer,.shot-ghost{position:absolute;inset:0;will-change:transform}
.shot-ghost{mix-blend-mode:screen;opacity:0}
.shot-img{width:100%;height:100%;object-fit:cover;display:block}
.shot-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 52%,rgba(0,0,0,.6) 100%)}
.shot-grain{position:absolute;inset:-12%;opacity:.14;mix-blend-mode:overlay;background-size:256px 256px}
.shot-flash{position:absolute;inset:0;background:#fff;opacity:0}
.shot-type{position:absolute;left:calc(var(--u)*7);right:calc(var(--u)*7);text-align:center;color:#fff;font-weight:800;line-height:1.02;letter-spacing:-.01em;text-shadow:0 calc(var(--u)*.5) calc(var(--u)*2.6) rgba(0,0,0,.6)}
.shot-slam,.shot-glitch,.shot-price,.shot-line{text-transform:uppercase;overflow-wrap:anywhere}
.shot-word{display:inline-block}
.shot-glitch{text-shadow:calc(var(--u)*.45) 0 ${brand.colors.accent},calc(var(--u)*-.45) 0 #29d9ff,0 calc(var(--u)*.5) calc(var(--u)*2.6) rgba(0,0,0,.6)}
.shot-tag{display:inline-block;padding:.35em .9em;background:${brand.colors.accent};color:#fff;letter-spacing:.08em;text-transform:uppercase;text-shadow:none}
.shot-price{color:#fff}
.shot-pos{position:absolute;transform:translate(-50%,-50%)}
.shot-card-pill{display:inline-block;padding:calc(var(--u)*1.2) calc(var(--u)*3);border-radius:999px;background:${brand.colors.accent};color:#fff;font-weight:700;font-size:calc(var(--u)*3.6);white-space:nowrap}
.shot-card-card{display:flex;flex-direction:column;gap:calc(var(--u)*.4);padding:calc(var(--u)*2.4) calc(var(--u)*3.4);border-radius:calc(var(--u)*2);background:rgba(255,255,255,.94);color:#111;font-weight:700;font-size:calc(var(--u)*3.8);box-shadow:0 calc(var(--u)*1.2) calc(var(--u)*4) rgba(0,0,0,.35)}
.shot-card-card small{font-weight:500;font-size:.72em;color:#555}
`;
