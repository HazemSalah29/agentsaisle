import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(__dirname, "app", "globals.css"), "utf8");

/** Variables declared in the first block that starts with `selector`. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector + " {");
  if (start === -1) throw new Error(`no block for ${selector}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]),
  );
}

const light = block(":root");
const dark = { ...light, ...block(':root[data-theme="dark"]') };
const media = { ...light, ...block(':root:not([data-theme="light"])') };

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

// [foreground, background, minimum ratio]: 4.5 for text, 3 for UI parts
const pairs: Array<[string, string, number]> = [
  ["ink", "bag", 4.5],
  ["ink-soft", "bag", 4.5],
  ["label-ink", "label", 4.5],
  ["label-ink-soft", "label", 4.5],
  ["label-rule", "label", 3],
  ["on-sticker", "sticker", 4.5],
  ["thermal-ink", "thermal", 4.5],
  ["thermal-ink-soft", "thermal", 4.5],
  ["bag", "ink", 4.5], // inverted controls (hover state)
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme meets WCAG AA", (_name, theme) => {
  it.each(pairs)("%s on %s is at least %d:1", (fg, bg, min) => {
    expect(contrast(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(min);
  });
});

it("a label is distinguishable from the page in each theme", () => {
  // light: the label has an ink border on kraft; dark: label stock is much lighter than the page
  expect(contrast(light["label-rule"]!, light.bag!)).toBeGreaterThanOrEqual(3);
  expect(contrast(dark.label!, dark.bag!)).toBeGreaterThanOrEqual(3);
  expect(contrast(dark.edge!, dark.bag!)).toBeGreaterThan(1);
});

it("the system-dark block matches the explicit dark block", () => {
  expect(media).toEqual(dark);
});
