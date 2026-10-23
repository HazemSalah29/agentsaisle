// Generates the demo's original placeholder art: abstract SVG plates, no third-party imagery.
// Deterministic (seeded), so rerunning produces identical files. Run: pnpm tsx scripts/make-art.mts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../public/art");
const W = 1200;
const H = 900;
const INK = "#ede8de";
const ACCENT = "#8b6cff";
const GROUND = "#171513";

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

const defs = (tint: string) => `<defs>
  <radialGradient id="g" cx="50%" cy="90%" r="80%"><stop offset="0" stop-color="${tint}" stop-opacity="0.8"/><stop offset="1" stop-color="${GROUND}" stop-opacity="0"/></radialGradient>
  <filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.08 0"/></filter>
</defs>`;
const wrap = (body: string, tint = ACCENT) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img"><title>Abstract plate</title>${defs(tint)}<rect width="${W}" height="${H}" fill="${GROUND}"/><rect width="${W}" height="${H}" fill="url(#g)"/>${body}<rect width="${W}" height="${H}" filter="url(#n)"/></svg>\n`;

const plates: Record<string, string> = {
  // concentric arcs rising from a horizon (also the hero plate)
  "plate-tide": wrap(
    `<g fill="none" stroke="${INK}" stroke-opacity="0.55" stroke-width="1.5">${[120, 210, 310, 430, 570, 740].map((r) => `<circle cx="600" cy="820" r="${r}"/>`).join("")}</g><rect y="820" width="${W}" height="80" fill="#0d0c0b"/><line x1="0" y1="820" x2="${W}" y2="820" stroke="${INK}" stroke-opacity="0.7" stroke-width="2"/>`,
  ),
  // a field of dots that swell toward the centre
  "plate-dots": (() => {
    const dots: string[] = [];
    for (let row = 0; row < 15; row++)
      for (let col = 0; col < 20; col++) {
        const dx = (col - 9.5) / 10;
        const dy = (row - 7) / 8;
        const r = Math.max(1.5, 16 * (1 - Math.min(1, Math.hypot(dx, dy))));
        dots.push(
          `<circle cx="${70 + col * 58}" cy="${60 + row * 58}" r="${r.toFixed(1)}" fill="${INK}" fill-opacity="0.8"/>`,
        );
      }
    return wrap(dots.join(""), "#4a35b8");
  })(),
  // diagonal bars
  "plate-bars": wrap(
    Array.from(
      { length: 11 },
      (_, i) =>
        `<rect x="${i * 120 - 80}" y="-100" width="46" height="1200" fill="${i % 4 === 0 ? ACCENT : INK}" fill-opacity="${i % 4 === 0 ? 0.9 : 0.16}" transform="rotate(24 600 450)"/>`,
    ).join(""),
    "#2b2160",
  ),
  // one large ring with an orbiting dot
  "plate-orbit": wrap(
    `<circle cx="600" cy="450" r="300" fill="none" stroke="${INK}" stroke-opacity="0.6" stroke-width="2"/><circle cx="600" cy="450" r="190" fill="none" stroke="${INK}" stroke-opacity="0.25" stroke-width="1.5"/><circle cx="868" cy="316" r="34" fill="${ACCENT}"/><circle cx="600" cy="450" r="8" fill="${INK}"/>`,
  ),
  // layered waves
  "plate-waves": (() => {
    const r = rng(7);
    const waves = Array.from({ length: 9 }, (_, i) => {
      const y = 300 + i * 60;
      const a = 20 + r() * 40;
      return `<path d="M0 ${y} C 300 ${y - a}, 600 ${y + a}, 900 ${y - a / 2} S 1200 ${y}, 1200 ${y}" fill="none" stroke="${INK}" stroke-opacity="${(0.15 + i * 0.07).toFixed(2)}" stroke-width="2"/>`;
    });
    return wrap(waves.join(""), "#5a3fd6");
  })(),
  // a grid of squares, a few filled
  "plate-grid": (() => {
    const r = rng(21);
    const cells: string[] = [];
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 8; col++) {
        const filled = r() > 0.78;
        cells.push(
          `<rect x="${100 + col * 125}" y="${75 + row * 125}" width="100" height="100" fill="${filled ? ACCENT : "none"}" fill-opacity="0.9" stroke="${INK}" stroke-opacity="${filled ? 0 : 0.35}" stroke-width="1.5"/>`,
        );
      }
    return wrap(cells.join(""), "#2b2160");
  })(),
};

await mkdir(out, { recursive: true });
for (const [name, svg] of Object.entries(plates))
  await writeFile(path.join(out, `${name}.svg`), svg);
console.log(`demo: wrote ${Object.keys(plates).length} plates to public/art/`);
