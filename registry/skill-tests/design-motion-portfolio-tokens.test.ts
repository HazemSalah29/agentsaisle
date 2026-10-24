import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { duration, ease, stagger } from "../official/design-motion-portfolio/assets/kit/tokens";

const css = readFileSync(
  path.join(__dirname, "..", "official", "design-motion-portfolio", "assets", "kit", "tokens.css"),
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
  ["ink", "raised", 4.5],
  ["muted", "ground", 4.5],
  ["muted", "raised", 4.5],
  ["accent", "ground", 4.5], // accent used as text
  ["accent", "raised", 3],
  ["on-accent", "accent", 4.5],
  ["line", "ground", 1.3], // hairline: decoration
];

describe("color tokens", () => {
  it.each(pairs)("%s on %s is at least %d:1", (fg, bg, min) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(min);
  });
});

describe("motion tokens", () => {
  const ms = (name: string) => {
    const m = new RegExp(`--${name}:\\s*(\\d+)ms`).exec(css);
    if (!m) throw new Error(`no --${name} in tokens.css`);
    return Number(m[1]) / 1000;
  };
  it("durations in tokens.ts match tokens.css", () => {
    expect(duration.fast).toBe(ms("duration-fast"));
    expect(duration.base).toBe(ms("duration-base"));
    expect(duration.slow).toBe(ms("duration-slow"));
    expect(duration.epic).toBe(ms("duration-epic"));
  });
  it("staggers match tokens.css", () => {
    expect(stagger.word).toBe(ms("stagger-word"));
    expect(stagger.item).toBe(ms("stagger-item"));
  });
  it("easings match tokens.css", () => {
    const bezier = (name: string) => {
      const m = new RegExp(`--ease-${name}:\\s*cubic-bezier\\(([^)]+)\\)`).exec(css);
      if (!m) throw new Error(`no --ease-${name} in tokens.css`);
      return m[1]!.split(",").map(Number);
    };
    expect([...ease.outExpo]).toEqual(bezier("out-expo"));
    expect([...ease.inOutQuart]).toEqual(bezier("in-out-quart"));
  });
});
