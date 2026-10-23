import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(__dirname, "app", "globals.css"), "utf8");

/** Variables declared in the first block whose selector line matches `selector`. */
function block(selector: RegExp): Record<string, string> {
  const m = selector.exec(css);
  if (!m) throw new Error(`no block for ${selector}`);
  const open = css.indexOf("{", m.index);
  const body = css.slice(open + 1, css.indexOf("}", open));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((x) => [x[1]!, x[2]!]),
  );
}

const light = block(/^:root,\s*\[data-theme="light"\]\s*\{/m);
const dark = { ...light, ...block(/^\[data-theme="dark"\]\s*\{/m) };
const media = { ...light, ...block(/^\s*:root:not\(\[data-theme="light"\]\)\s*\{/m) };

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
const aisles = ["aisle-code", "aisle-design", "aisle-git", "aisle-writing", "aisle-video"];
const pairs: Array<[string, string, number]> = [
  ["ink", "bg", 4.5],
  ["ink", "bg-raised", 4.5],
  ["ink-strong", "bg", 4.5],
  ["muted", "bg", 4.5],
  ["muted", "bg-raised", 4.5],
  ["muted", "bg-sunken", 4.5],
  ["accent-ink", "bg", 4.5],
  ["accent-ink", "bg-raised", 4.5],
  ["on-accent", "accent", 4.5],
  ["invert-fg", "invert-bg", 4.5],
  ["accent", "bg", 3], // focus ring and accent UI parts
  ["line-strong", "bg", 1.8], // hairline is decoration; the strong line marks controls
  ...aisles.flatMap((a): Array<[string, string, number]> => [
    [a, "bg", 4.5],
    [a, "bg-raised", 4.5],
  ]),
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme meets WCAG AA", (_name, theme) => {
  it.each(pairs)("%s on %s is at least %d:1", (fg, bg, min) => {
    expect(contrast(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(min);
  });
});

it("the system-dark block matches the explicit dark block", () => {
  expect(media).toEqual(dark);
});
