#!/usr/bin/env node
// Checks that a project's pages follow the clean SaaS design system: tokens only, kit components only, minimal.
// It reads source files as TEXT. It never imports or runs them.
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_LINES = 40;
const SOURCE = /\.(tsx?|jsx?|css|mdx?)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "coverage", ".turbo"]);
const IGNORE = "design-lint-ignore";

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const ICON_PACKAGES =
  /from\s+["'](react-icons|@heroicons|@radix-ui\/react-icons|@phosphor-icons|@tabler\/icons|@fortawesome|feather-icons|react-feather|@mui\/icons-material|@iconify|@remixicon)[^"']*["']/;
const ANIMATION_PACKAGES =
  /from\s+["'](framer-motion|motion|motion\/react|gsap|animejs|react-spring|@react-spring\/web|lenis|locomotive-scroll|aos)(\/[^"']*)?["']/;

/** [rule, test(line) -> hint | null] */
const LINE_RULES = [
  [
    "raw-color",
    (line) => {
      const hex = /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
      for (const m of line.matchAll(hex)) {
        const before = line.slice(0, m.index);
        if (/(?:href|to|src|id)\s*=\s*\{?["'`]$/.test(before)) continue; // an anchor, not a color
        return `raw color ${m[0]}. Use a token: text-ink, bg-subtle, bg-brand-700, border-border.`;
      }
      if (/\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/.test(line))
        return "raw color function. Use a color token (text-muted, border-border, var(--color-...)).";
      const palette = new RegExp(
        `(?<![\\w-])(?:bg|text|border|ring|fill|stroke|divide|outline|decoration|accent|caret|placeholder)-(?:${PALETTE})-\\d{2,3}\\b`,
      ).exec(line);
      if (palette)
        return `default palette color ${palette[0]}. Use the brand scale (brand-50 to brand-900) or a neutral token.`;
      return null;
    },
  ],
  [
    "arbitrary-value",
    (line) => {
      for (const m of line.matchAll(/(?<=[\s"'`:])(-?[a-z][\w-]*)-\[([^\]\s]+)\]/g)) {
        const [, prefix, value] = m;
        if (/^(data|aria|group|peer|has|supports|nth)(-|$)/.test(prefix)) continue;
        if (value.startsWith("var(--")) continue;
        return `arbitrary Tailwind value ${m[0]}. Use the scale or a theme token.`;
      }
      return null;
    },
  ],
  [
    "inline-style",
    (line) =>
      /\bstyle\s*=\s*(\{\{|["'])/.test(line)
        ? "inline style attribute. Use token classes, or add a kit component."
        : null,
  ],
  [
    "font",
    (line) => {
      if (/\bfont-(serif|mono)\b/.test(line))
        return "second font family. This kit uses one sans (font-sans, the default).";
      if (/font-family\s*:/.test(line) && !/var\(--(font|f)-/.test(line))
        return "font-family not from tokens. Use var(--font-sans).";
      if (/\bfontFamily\s*:/.test(line))
        return "fontFamily not from tokens. Use the default font-sans.";
      return null;
    },
  ],
  [
    "motion",
    (line) => {
      if (/\b(?:duration|delay)-\d+\b/.test(line))
        return "raw duration class. Use duration-(--duration-enter) or duration-(--duration-hover).";
      if (/\bease-(linear|in|out|in-out)(?![\w-])/.test(line))
        return "default easing class. Use ease-standard.";
      if (/\banimate-(bounce|ping|pulse)\b/.test(line))
        return "decorative animation. This kit only fades up on enter and has 150 ms hovers.";
      if (/\bduration\s*:\s*[\d.]+/.test(line) || /\bease\s*:\s*(\[|["'])/.test(line))
        return "raw motion value. The only motion is FadeUp and the 150 ms hover transition.";
      if (/\b(?:transition|animation)(-duration)?\s*:[^;]*\b\d*\.?\d+m?s\b/.test(line))
        return "raw time in CSS. Use var(--duration-enter) or var(--duration-hover).";
      return null;
    },
  ],
  [
    "motion-lib",
    (line) =>
      ANIMATION_PACKAGES.test(line)
        ? "animation or smooth-scroll library. This kit uses none; use FadeUp and CSS transitions."
        : null,
  ],
  [
    "gradient",
    (line) =>
      /\bbg-(gradient|linear|radial|conic)-|\b(?:from|via|to)-(?:brand|ink|ground|subtle|muted|border)\b|(?:linear|radial|conic)-gradient\(/.test(
        line,
      )
        ? "gradient. Minimal means flat color: use bg-ground, bg-subtle or a brand step."
        : null,
  ],
  [
    "glass",
    (line) =>
      /\bbackdrop-(blur|filter|saturate|brightness)\b|backdrop-filter\s*:/.test(line)
        ? "glass effect (backdrop blur). Use a solid background."
        : null,
  ],
  [
    "blob",
    (line) =>
      /(?<![\w-])blur-(?:\w|\()/.test(line) || /\bfilter\s*:\s*blur\(/.test(line)
        ? "blur used as a decorative blob. Remove it; whitespace is the decoration."
        : null,
  ],
  [
    "icons",
    (line) =>
      ICON_PACKAGES.test(line)
        ? "icon package other than lucide-react. Use lucide-react only."
        : null,
  ],
  [
    "shadow",
    (line) =>
      /\bshadow-(?:xs|sm|md|lg|xl|2xl|inner)\b/.test(line)
        ? "shadow level. This kit has one: shadow-soft."
        : null,
  ],
  [
    "radius",
    (line) =>
      /\brounded(?:-[a-z]{1,2})?-(?:sm|md|xl|3xl)\b/.test(line)
        ? "radius outside the scale. Use rounded-lg (12 px) or rounded-2xl (20 px), or rounded-full for pills and avatars."
        : null,
  ],
];

const isCommentLine = (line) => /^\s*(\/\/|\/\*|\*)/.test(line);
const importsKit = (text) => /from\s+["'][^"']*\/kit(\/[^"']*)?["']/.test(text);

/** Findings for one file. `rel` is its path relative to the project. */
export function lintFile(rel, text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (isCommentLine(line)) return;
    if (line.includes(IGNORE) || (lines[i - 1] ?? "").includes(IGNORE)) return;
    for (const [rule, test] of LINE_RULES) {
      const hint = test(line);
      if (hint) findings.push({ file: rel, line: i + 1, rule, hint });
    }
  });
  if (/\.(tsx|jsx)$/.test(rel) && !importsKit(text)) {
    const at = lines.findIndex((l) => /<(section|header|footer|nav)[\s>]/.test(l));
    if (at !== -1)
      findings.push({
        file: rel,
        line: at + 1,
        rule: "no-kit",
        hint: "section-level markup without kit components. Import Section, Container, etc. from the kit.",
      });
    else if (/(^|\/)page\.(tsx|jsx)$/.test(rel))
      findings.push({
        file: rel,
        line: 1,
        rule: "no-kit",
        hint: "page does not import from the kit. Build it from kit components.",
      });
  }
  return findings;
}

export function format(findings, checked) {
  if (findings.length === 0) return `design-lint: ${checked} files checked, no problems.`;
  const rows = findings.map((f) => `${f.file}:${f.line}  ${f.rule}  ${f.hint}`);
  const head = `design-lint: ${findings.length} problem${findings.length === 1 ? "" : "s"} in ${checked} files.`;
  if (rows.length + 1 <= MAX_LINES) return [head, ...rows].join("\n");
  return [
    head,
    ...rows.slice(0, MAX_LINES - 2),
    `... and ${rows.length - (MAX_LINES - 2)} more.`,
  ].join("\n");
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (SOURCE.test(e.name)) out.push(full);
  }
  return out;
}

/** Source files to check: everything under src/ (or app/ and components/ when there is no src) except the kit. */
export function listSources(cwd) {
  const roots = existsSync(path.join(cwd, "src"))
    ? ["src", "app", "pages"]
    : ["app", "components", "pages"];
  const files = roots.flatMap((r) =>
    existsSync(path.join(cwd, r)) ? walk(path.join(cwd, r)) : [],
  );
  return files.filter((f) => !path.relative(cwd, f).split(path.sep).includes("kit"));
}

function main(argv) {
  const cwd = path.resolve(
    argv.includes("--cwd") ? argv[argv.indexOf("--cwd") + 1] : process.cwd(),
  );
  const files = listSources(cwd);
  const findings = files.flatMap((f) =>
    lintFile(path.relative(cwd, f).split(path.sep).join("/"), readFileSync(f, "utf8")),
  );
  console.log(format(findings, files.length));
  process.exit(findings.length ? 1 : 0);
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
