import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { duration, ease } from "../official/design-clean-saas/assets/kit/tokens";

const css = readFileSync(
  path.join(__dirname, "..", "official", "design-clean-saas", "assets", "kit", "tokens.css"),
  "utf8",
);

const color = (name: string): string => {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css);
  if (!m) throw new Error(`no --color-${name} in tokens.css`);
  return m[1]!;
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio]: 4.5 for text, 3 for UI parts and focus rings
const pairs: Array<[string, string, number]> = [
  ["ink", "ground", 4.5],
  ["ink", "subtle", 4.5],
  ["muted", "ground", 4.5],
  ["muted", "subtle", 4.5],
  ["ground", "brand-700", 4.5], // button text
  ["ground", "brand-800", 4.5], // button text on hover
  ["brand-700", "ground", 4.5], // brand as link text
  ["brand-700", "subtle", 4.5], // icons on the subtle tile
  ["brand-600", "ground", 3], // focus ring
  ["success", "ground", 4.5],
  ["warning", "ground", 4.5],
  ["border", "ground", 1.1], // hairline: decoration
];

describe("color tokens", () => {
  it.each(pairs)("%s on %s is at least %d:1", (fg, bg, min) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(min);
  });

  it("has the full brand scale from 50 to 900", () => {
    for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      expect(color(`brand-${step}`)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("brand steps get steadily darker", () => {
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) =>
      luminance(color(`brand-${s}`)),
    );
    for (let i = 1; i < steps.length; i++) expect(steps[i]!).toBeLessThan(steps[i - 1]!);
  });
});

describe("motion tokens", () => {
  const ms = (name: string) => {
    const m = new RegExp(`--${name}:\\s*(\\d+)ms`).exec(css);
    if (!m) throw new Error(`no --${name} in tokens.css`);
    return Number(m[1]) / 1000;
  };
  it("durations in tokens.ts match tokens.css, and there are only two", () => {
    expect(duration.enter).toBe(ms("duration-enter"));
    expect(duration.hover).toBe(ms("duration-hover"));
    expect(Object.keys(duration)).toHaveLength(2);
    expect(duration.enter).toBe(0.3);
    expect(duration.hover).toBe(0.15);
  });
  it("easing matches tokens.css", () => {
    const m = /--ease-standard:\s*cubic-bezier\(([^)]+)\)/.exec(css)!;
    expect([...ease.standard]).toEqual(m[1]!.split(",").map(Number));
  });
});

describe("design rules in the tokens", () => {
  it("uses the brief's radii and one shadow", () => {
    expect(css).toMatch(/--radius-lg:\s*12px/);
    expect(css).toMatch(/--radius-2xl:\s*20px/);
    expect(css.match(/--shadow-/g)).toHaveLength(1);
  });
  it("defines the 14/16/18/24/32 type steps and a 48 to 64 headline range", () => {
    for (const rem of ["0.875rem", "1rem", "1.125rem", "1.5rem", "2rem"])
      expect(css).toContain(`: ${rem};`);
    expect(css).toMatch(/--text-h1:\s*clamp\(2\.5rem, 6vw, 4rem\)/);
    expect(css).toMatch(/--text-h2:\s*clamp\(2rem, 4vw, 3rem\)/);
  });
  it("keeps content visible for reduced motion and without JavaScript", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*data-fade/);
    expect(css).toMatch(/scripting: none[\s\S]*data-fade/);
  });
});
