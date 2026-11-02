// Original flat backdrops for the puppet scene: a few layers of plain SVG that drift at different speeds
// (parallax). They are drawn here in code, with fixed colours, so they are ours and never copied from anyone.
// The picture is 1600 x 900 and layers are drawn wider than that, so a drift never shows an edge. A tall (9:16)
// film shows only the middle 500 units, so the main shapes sit around x = 550 to 1050 and the rest is spread out.

export const PRESETS = ["meadow", "room", "night"];

const W0 = -400;
const W1 = 2000;
const rect = (x, y, w, h, fill) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const blob = (cx, cy, rx, ry, fill) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
const hills = (base, amp, step, fill, phase = 0) => {
  let d = `M${W0} 900 L${W0} ${base}`;
  for (let x = W0; x < W1; x += step) {
    const h = Math.round(base - amp * Math.sin((x + phase) / step));
    d += ` Q${x + step / 2} ${h} ${x + step} ${base}`;
  }
  return `<path d="${d} L${W1} 900 Z" fill="${fill}"/>`;
};

const meadow = () => [
  { drift: 0, svg: rect(W0, 0, W1 - W0, 900, "#8fd3ff") },
  { drift: 0, svg: `<circle cx="900" cy="170" r="85" fill="#ffd84d"/>` },
  {
    drift: 160,
    svg: [
      blob(260, 190, 140, 44, "#ffffff"),
      blob(520, 110, 100, 32, "#ffffff"),
      blob(700, 280, 120, 38, "#ffffff"),
      blob(1010, 140, 130, 40, "#ffffff"),
      blob(1260, 260, 140, 44, "#ffffff"),
      blob(1500, 120, 100, 32, "#ffffff"),
    ].join(""),
  },
  { drift: 40, svg: hills(560, 70, 300, "#9be39b", 40) },
  { drift: 80, svg: hills(650, 55, 260, "#6ccb73", 0) },
  { drift: 0, svg: rect(W0, 730, W1 - W0, 170, "#43b05a") },
  {
    drift: 220,
    svg: [200, 380, 560, 740, 900, 1060, 1240, 1420, 1600]
      .map(
        (x, i) =>
          `<circle cx="${x}" cy="${840 + (i % 2) * 20}" r="16" fill="${["#ff7aa2", "#ffe066", "#ffffff"][i % 3]}"/>`,
      )
      .join(""),
  },
];

const room = () => [
  { drift: 0, svg: rect(W0, 0, W1 - W0, 900, "#ffe3b8") },
  {
    drift: 20,
    svg: [
      rect(700, 130, 360, 300, "#8fd3ff"),
      rect(875, 130, 10, 300, "#ffffff"),
      rect(700, 275, 360, 10, "#ffffff"),
      `<rect x="690" y="120" width="380" height="320" fill="none" stroke="#c98b4a" stroke-width="20"/>`,
    ].join(""),
  },
  { drift: 0, svg: rect(W0, 690, W1 - W0, 210, "#d9a066") },
  { drift: 30, svg: blob(760, 800, 420, 70, "#e86a5f") },
  {
    drift: 60,
    svg: [
      rect(560, 560, 300, 14, "#a8703a"),
      rect(590, 480, 70, 80, "#5aa9e6"),
      rect(680, 500, 60, 60, "#ffd166"),
      rect(760, 470, 70, 90, "#7bd389"),
    ].join(""),
  },
];

const night = () => [
  { drift: 0, svg: rect(W0, 0, W1 - W0, 900, "#1b2a5c") },
  {
    drift: 12,
    svg: [100, 240, 380, 520, 640, 760, 880, 1000, 1120, 1260, 1400, 1540]
      .map(
        (x, i) =>
          `<circle cx="${x}" cy="${60 + ((i * 97) % 300)}" r="${3 + (i % 3)}" fill="#fff6c9"/>`,
      )
      .join(""),
  },
  {
    drift: 20,
    svg: `<circle cx="880" cy="200" r="80" fill="#f4f0d2"/><circle cx="915" cy="178" r="66" fill="#1b2a5c"/>`,
  },
  { drift: 40, svg: hills(580, 70, 300, "#2e4a7d", 90) },
  { drift: 80, svg: hills(660, 55, 260, "#233a66", 0) },
  { drift: 0, svg: rect(W0, 740, W1 - W0, 160, "#1d2f55") },
];

const BUILD = { meadow, room, night };

/** Layers of a preset, back to front: [{ svg, drift }]. `drift` is how far the layer slides over the scene. */
export function backdropLayers(preset) {
  const build = BUILD[preset];
  if (!build) throw new Error(`Backdrop "${preset}" does not exist (have: ${PRESETS.join(", ")}).`);
  return build();
}
