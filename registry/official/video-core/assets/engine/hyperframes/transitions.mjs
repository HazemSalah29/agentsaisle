// Scene transitions that overlap two scenes. The incoming scene is untouched underneath; the outgoing scene is drawn
// again as copies in its final state, on top, for a short window (0.25 to 0.8 s), and the copies are cut and moved
// away: `slash` (a glowing line sweeps the frame, two clipped halves slide apart along its normal), `shatter` (wedge
// shaped shards fly out), `whip` (the copy slides out blurred) and `zoom-through` (the copy scales up and fades).
// Geometry and motion are pure functions of the frame size, the style and a seed, so a frame depends on the clock alone.
import { EASE_FN, r3, rnd, samples } from "./motion.mjs";

export const TRANSITIONS = ["slash", "shatter", "whip", "zoom-through"];
export const MIN_SECONDS = 0.25;
export const MAX_SECONDS = 0.8;
export const DEFAULT_SECONDS = { slash: 0.5, shatter: 0.55, whip: 0.35, "zoom-through": 0.45 };
/** The fewest seconds between two slashes (a slash every scene would be a strobe). */
export const MIN_SLASH_GAP = 2.5;

/**
 * Clip a convex polygon to a half plane (Sutherland-Hodgman): keep the points p where (p - c) . n >= 0.
 * `poly` and the result are arrays of [x, y]. Pure.
 */
export function clipHalfPlane(poly, c, n) {
  const side = (p) => (p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1];
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if (sa >= 0 !== sb >= 0) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

const rect = (w, h) => [
  [0, 0],
  [w, 0],
  [w, h],
  [0, h],
];

/** A CSS `polygon()` in percent of the frame for points in pixels. */
export const polygonCss = (pts, w, h) =>
  `polygon(${pts.map(([x, y]) => `${r3((x / w) * 100)}% ${r3((y / h) * 100)}%`).join(", ")})`;

/** Area of a polygon (shoelace). */
export const area = (p) =>
  Math.abs(
    p.reduce(
      (s, a, i) => s + (a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1]),
      0,
    ),
  ) / 2;

/** The two halves of the frame on either side of a line through (cx, cy) at `deg` degrees: [{ poly, n }, { poly, n }]. Pure. */
export function slashHalves(w, h, deg, cx = w / 2, cy = h / 2) {
  const a = (deg * Math.PI) / 180;
  const n = [-Math.sin(a), Math.cos(a)];
  const minus = [-n[0], -n[1]];
  return [
    { poly: clipHalfPlane(rect(w, h), [cx, cy], n), n },
    { poly: clipHalfPlane(rect(w, h), [cx, cy], minus), n: minus },
  ];
}

/** How far to slide a half along its normal so it clears the frame: the farthest corner's distance from the line. */
export const clearance = (w, h, n, cx = w / 2, cy = h / 2) =>
  Math.max(...rect(w, h).map(([x, y]) => Math.abs((x - cx) * n[0] + (y - cy) * n[1])));

/** `count` wedge-shaped shards that tile the frame around a centre, with their mid angles (radians). Pure. */
export function wedges(w, h, count, seed = 1, cx = w / 2, cy = h / 2) {
  const out = [];
  const start = rnd(seed) * Math.PI * 2;
  const cuts = Array.from(
    { length: count },
    (_, i) => start + (i * 2 * Math.PI) / count + (rnd(seed + i + 1) - 0.5) * 0.35,
  );
  for (let i = 0; i < count; i++) {
    const a0 = cuts[i];
    const a1 = i + 1 < count ? cuts[i + 1] : cuts[0] + 2 * Math.PI;
    const n0 = [-Math.sin(a0), Math.cos(a0)]; // keep the side counter-clockwise of a0
    const n1 = [Math.sin(a1), -Math.cos(a1)]; // and clockwise of a1
    let poly = clipHalfPlane(rect(w, h), [cx, cy], n0);
    poly = clipHalfPlane(poly, [cx, cy], n1);
    // The wedge is only the part in the half plane facing its mid direction (the two half planes meet in two cones).
    const mid = (a0 + a1) / 2;
    poly = clipHalfPlane(poly, [cx, cy], [Math.cos(mid), Math.sin(mid)]);
    if (poly.length >= 3 && area(poly) > 1) out.push({ poly, mid });
  }
  return out;
}

const frames = (n, fn, ease = "linear") =>
  samples(1, n, n).map((u) => ({ offset: r3(u), ...fn(EASE_FN[ease](u), u) }));

/**
 * Markup and animations for a transition at time `at` (seconds in the film) lasting `dur` seconds.
 * `copy(tag)` returns { html, plan } of the outgoing scene drawn again with ids made unique by `tag`.
 * Returns { html, plan } to add after the scenes. Pure.
 */
export function transitionParts({
  style,
  id,
  kind = "title",
  copy,
  size,
  at,
  dur,
  seed = 1,
  angle = -62,
}) {
  const [w, h] = size;
  const d = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, dur ?? DEFAULT_SECONDS[style] ?? 0.45));
  const sec = (tag, extra = "") => {
    const c = copy(tag);
    return {
      c,
      html: `<section id="${id}-${tag}" class="clip scene scene-${kind} tr-copy" ${extra} data-start="${at}" data-duration="${r3(d)}">${c.html}</section>\n`,
    };
  };
  const plan = [];
  let html = "";
  const add = (tag, anim, style_ = "") => {
    const s = sec(tag, style_ ? `style="${style_}"` : "");
    html += s.html;
    plan.push(...s.c.plan);
    plan.push({ id: `${id}-${tag}`, at, dur: d, ease: "linear", frames: anim });
  };
  if (style === "slash") {
    const halves = slashHalves(w, h, angle);
    const slide = 0.8 * d;
    halves.forEach((half, k) => {
      const R = clearance(w, h, half.n) * 1.05;
      const dir = k === 0 ? 1 : -1;
      add(
        `h${k}`,
        frames(14, (e, u) => {
          const m = EASE_FN.snap(Math.max(0, Math.min(1, (u * d - 0.08) / slide)));
          return {
            transform: `translate(${r3(half.n[0] * R * m)}px, ${r3(half.n[1] * R * m)}px) rotate(${r3(dir * 3.5 * m)}deg)`,
          };
        }),
        `clip-path:${polygonCss(half.poly, w, h)};z-index:10`,
      );
    });
    // The glowing line draws across, holds, and fades; a spark ring opens at the cut.
    const len = Math.hypot(w, h) * 1.15;
    // The line grows from its start point, so it is placed at the start of the diagonal and rotated about that end.
    const rad = (angle * Math.PI) / 180;
    const sx = w / 2 - (len / 2) * Math.cos(rad);
    const sy = h / 2 - (len / 2) * Math.sin(rad);
    html += `<div id="${id}-line" class="clip tr-line" data-start="${at}" data-duration="${r3(d)}" style="width:${r3(len)}px;left:${r3(sx)}px;top:${r3(sy)}px;transform:rotate(${angle}deg)"></div>\n`;
    plan.push({
      id: `${id}-line`,
      at,
      dur: d,
      ease: "linear",
      frames: frames(14, (_, u) => {
        const draw = Math.min(1, u / 0.3);
        return {
          opacity: r3(u > 0.65 ? Math.max(0, 1 - (u - 0.65) / 0.35) : 1),
          transform: `rotate(${angle}deg) scaleX(${r3(EASE_FN.out(draw))})`,
          transformOrigin: "0% 50%",
        };
      }),
    });
    html += `<div id="${id}-burst" class="clip tr-burst" data-start="${at}" data-duration="${r3(d)}"></div>\n`;
    plan.push({
      id: `${id}-burst`,
      at: at + 0.1,
      dur: Math.max(0.2, d - 0.1),
      ease: "out",
      frames: [
        { opacity: 0.95, transform: "translate(-50%, -50%) scale(0.15)" },
        { opacity: 0, transform: "translate(-50%, -50%) scale(2.4)" },
      ],
    });
  } else if (style === "shatter") {
    const shards = wedges(w, h, 9, seed);
    const R = Math.hypot(w, h) * 0.75;
    shards.forEach((s, k) => {
      const spin = (rnd(seed + k * 5 + 3) - 0.5) * 70;
      add(
        `s${k}`,
        frames(12, (_, u) => {
          const m = EASE_FN.in(u);
          return {
            opacity: r3(Math.max(0, 1 - m * 1.15)),
            transform: `translate(${r3(Math.cos(s.mid) * R * m)}px, ${r3(Math.sin(s.mid) * R * m)}px) rotate(${r3(spin * m)}deg) scale(${r3(1 - 0.25 * m)})`,
          };
        }),
        `clip-path:${polygonCss(s.poly, w, h)};z-index:10`,
      );
    });
  } else if (style === "whip") {
    const dir = rnd(seed) > 0.5 ? 1 : -1;
    add(
      "w",
      [
        { transform: "translateX(0%)", filter: "blur(0px)", opacity: 1 },
        { transform: `translateX(${110 * dir}%)`, filter: "blur(26px)", opacity: 1 },
      ],
      "z-index:10",
    );
    plan[plan.length - 1].ease = "in";
  } else if (style === "zoom-through") {
    add(
      "z",
      [
        { transform: "scale(1)", filter: "blur(0px)", opacity: 1 },
        { transform: "scale(2.6)", filter: "blur(18px)", opacity: 0 },
      ],
      "z-index:10",
    );
    plan[plan.length - 1].ease = "in";
  } else throw new Error(`Transition "${style}" is not built (have: ${TRANSITIONS.join(", ")}).`);
  return { html, plan };
}

/** Styles for transitions: the glowing line and the spark ring. */
export const transitionCss = (brand) => {
  const a = brand.colors.accent;
  return `
.tr-copy{pointer-events:none;overflow:hidden}
.tr-line{position:absolute;z-index:11;height:calc(var(--u)*.55);transform-origin:0% 50%;background:linear-gradient(90deg,transparent,#fff 12%,#fff 88%,transparent);box-shadow:0 0 calc(var(--u)*2.4) ${a},0 0 calc(var(--u)*6) ${a},0 0 calc(var(--u)*12) ${a}88;margin-top:calc(var(--u)*-.28)}
.tr-burst{position:absolute;z-index:11;left:50%;top:50%;width:calc(var(--u)*30);height:calc(var(--u)*30);border-radius:50%;opacity:0;pointer-events:none;background:repeating-conic-gradient(${a} 0 4deg,transparent 4deg 24deg);-webkit-mask:radial-gradient(circle,transparent 26%,#000 28%,#000 64%,transparent 66%);mask:radial-gradient(circle,transparent 26%,#000 28%,#000 64%,transparent 66%)}
`;
};
