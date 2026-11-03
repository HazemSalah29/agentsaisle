#!/usr/bin/env node
// /video-brand: writes and checks brand/brand.json, which every video skill reads so a series looks the same.
// Checks hex colours, WCAG contrast, that fonts exist (bundled with HyperFrames, or a file in brand/fonts),
// the logo path and the caption style. Writes only brand/brand.json (never overwrites without --force).
// Usage: node brand.mjs init <studio-dir> [--bg #hex] [--fg #hex] [--accent #hex] [--font Name] [--force]
//        node brand.mjs check <studio-dir | brand.json> [--lang ar]
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, isInside, parseArgs } from "./_lib.mjs";

export const DEFAULT_BRAND = Object.freeze({
  colors: { bg: "#0F1115", fg: "#F5F5F2", accent: "#FF5A1F", muted: "#A3A9B0" },
  font: "Inter",
  captions: { style: "clean", maxWordsPerLine: 4 },
});
/** Fonts HyperFrames resolves by name (checked 2026-11-01, `TODO(verify)` per HyperFrames release). */
export const BUNDLED_FONTS = [
  "Inter",
  "Montserrat",
  "Outfit",
  "Nunito",
  "Oswald",
  "League Gothic",
  "Archivo Black",
  "Space Mono",
  "IBM Plex Mono",
  "JetBrains Mono",
  "EB Garamond",
  "Playfair Display",
  "Source Code Pro",
  "Noto Sans JP",
  "Roboto",
  "Open Sans",
  "Lato",
  "Poppins",
];
const COLOR_KEYS = ["bg", "fg", "accent", "muted"];
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/;
const FONT_FILE = /\.(woff2?|ttf|otf)$/i;
const LOGO_FILE = /\.(png|svg|jpe?g|webp)$/i;
const STYLES = ["karaoke", "pop", "clean"];
const KNOWN = ["colors", "font", "logo", "captions"];
const NOT_BUILT = ["intro", "outro", "stingers", "lowerThirds"];

/** WCAG relative luminance of a #rgb/#rgba/#rrggbb/#rrggbbaa colour (alpha ignored). */
export function luminance(hex) {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Check a parsed brand.json. `fontFiles` are file names in brand/fonts; `logoExists(rel)` says whether the
 * logo file is there. Returns [{ level: "error"|"warn", message }].
 */
export function checkBrand(brand, { fontFiles = [], logoExists = () => true, lang = "en" } = {}) {
  const out = [];
  const err = (message) => out.push({ level: "error", message });
  const warn = (message) => out.push({ level: "warn", message });
  if (!brand || typeof brand !== "object" || Array.isArray(brand))
    return [{ level: "error", message: "brand.json must be an object" }];
  for (const k of Object.keys(brand)) {
    if (NOT_BUILT.includes(k)) warn(`"${k}" is not built yet and is ignored`);
    else if (!KNOWN.includes(k)) warn(`unknown key "${k}" is ignored`);
  }
  const c = brand.colors ?? {};
  for (const k of COLOR_KEYS) {
    if (c[k] === undefined)
      warn(`colors.${k} is not set; the default ${DEFAULT_BRAND.colors[k]} is used`);
    else if (typeof c[k] !== "string" || !HEX.test(c[k]))
      err(
        `colors.${k} must be a hex colour like #1A2B3C (got ${JSON.stringify(c[k])?.slice(0, 30)})`,
      );
    else if (c[k].length === 9 || c[k].length === 5)
      warn(`colors.${k} has an alpha channel; it is ignored`);
  }
  for (const k of Object.keys(c))
    if (!COLOR_KEYS.includes(k))
      warn(`colors.${k} is not a brand colour (${COLOR_KEYS.join(", ")}) and is ignored`);
  const ok = (k) => typeof c[k] === "string" && HEX.test(c[k]);
  const col = (k) => (ok(k) ? c[k] : DEFAULT_BRAND.colors[k]);
  const ratio = (a, b) => contrast(col(a), col(b));
  if (ok("fg") || ok("bg"))
    if (ratio("fg", "bg") < 4.5)
      err(`fg on bg has contrast ${ratio("fg", "bg").toFixed(2)}:1; text needs at least 4.5:1`);
  if (ok("muted") || ok("bg"))
    if (ratio("muted", "bg") < 4.5)
      warn(
        `muted on bg has contrast ${ratio("muted", "bg").toFixed(2)}:1; secondary text should reach 4.5:1`,
      );
  if (ok("accent") || ok("bg"))
    if (ratio("accent", "bg") < 3)
      err(
        `accent on bg has contrast ${ratio("accent", "bg").toFixed(2)}:1; highlights need at least 3:1`,
      );

  const stems = fontFiles.filter((f) => FONT_FILE.test(f)).map((f) => f.replace(/\.[^.]+$/, ""));
  const font = brand.font ?? DEFAULT_BRAND.font;
  if (typeof font !== "string" || !FAMILY.test(font))
    err(
      `font must be a plain family name (letters, digits, spaces), got ${JSON.stringify(font)?.slice(0, 30)}`,
    );
  else if (
    !BUNDLED_FONTS.includes(font) &&
    !stems.some((s) => s.toLowerCase() === font.toLowerCase())
  )
    err(
      `font "${font}" is not bundled with HyperFrames and there is no ${font}.woff2/.ttf/.otf in brand/fonts`,
    );
  for (const s of stems)
    if (!FAMILY.test(s)) warn(`font file "${s}" has characters a font name cannot use; rename it`);
  const families = new Set([...stems.map((s) => s.toLowerCase()), String(font).toLowerCase()]);
  if (families.size > 2 && lang !== "ar")
    warn(`${families.size} typefaces in use; the quality bar is at most 2`);
  if (lang.startsWith("ar") && !stems.length)
    warn(
      "Arabic needs an Arabic font in brand/fonts (for example Cairo, OFL licence); without one the system fallback is used",
    );

  if (brand.logo !== undefined) {
    if (typeof brand.logo !== "string" || !isInside(brand.logo) || !LOGO_FILE.test(brand.logo))
      err("logo must be a relative path to a png, svg, jpg or webp file inside brand/");
    else if (!logoExists(brand.logo)) err(`logo file "${brand.logo}" is missing`);
  }

  const cap = brand.captions;
  if (cap !== undefined) {
    if (!cap || typeof cap !== "object") err("captions must be an object");
    else {
      if (cap.style !== undefined && !STYLES.includes(cap.style))
        err(`captions.style must be one of ${STYLES.join(", ")}`);
      if (
        cap.maxWordsPerLine !== undefined &&
        !(
          Number.isInteger(cap.maxWordsPerLine) &&
          cap.maxWordsPerLine >= 2 &&
          cap.maxWordsPerLine <= 8
        )
      )
        err("captions.maxWordsPerLine must be a whole number from 2 to 8");
      if (
        cap.size !== undefined &&
        !(typeof cap.size === "number" && cap.size > 0.02 && cap.size <= 0.12)
      )
        err("captions.size must be a fraction of the frame height between 0.02 and 0.12");
      else if (typeof cap.size === "number" && cap.size < 0.045)
        warn("captions.size is below 0.045 of the frame height; on 9:16 it is raised to 0.045");
      if (
        cap.weight !== undefined &&
        !(Number.isInteger(cap.weight) && cap.weight >= 100 && cap.weight <= 900)
      )
        err("captions.weight must be a whole number from 100 to 900");
    }
  }
  return out;
}

const readFontFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => FONT_FILE.test(f))
        .sort()
    : [];

/** Locate brand.json from a studio folder or a file path: { file, root }. */
export function locate(arg) {
  const p = path.resolve(arg);
  if (existsSync(p) && statSync(p).isDirectory())
    return { file: path.join(p, "brand", "brand.json"), root: path.join(p, "brand") };
  return { file: p, root: path.dirname(p) };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      booleans: ["force"],
      strings: ["bg", "fg", "accent", "font", "lang"],
    });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const [cmd, target] = parsed.positional;
  const { flags } = parsed;
  if (!["init", "check"].includes(cmd) || !target) {
    console.error(
      "Usage: node brand.mjs init <studio-dir> [--bg #hex] [--fg #hex] [--accent #hex] [--font Name] [--force]\n       node brand.mjs check <studio-dir | brand.json> [--lang ar]",
    );
    process.exit(2);
  }
  const { file, root } = locate(target);
  if (cmd === "init") {
    if (existsSync(file) && !flags.force) {
      console.error(`${file} already exists. Edit it, or pass --force to replace it.`);
      process.exit(2);
    }
    const brand = JSON.parse(JSON.stringify(DEFAULT_BRAND));
    for (const k of ["bg", "fg", "accent"]) if (flags[k]) brand.colors[k] = flags[k];
    if (flags.font) brand.font = flags.font;
    const found = checkBrand(brand, { fontFiles: readFontFiles(path.join(root, "fonts")) }).filter(
      (f) => f.level === "error",
    );
    if (found.length) {
      console.error(
        capLines(
          found.map((f) => `ERROR ${f.message}`),
          "brand.json not written.",
        ),
      );
      process.exit(1);
    }
    mkdirSync(path.join(root, "fonts"), { recursive: true });
    writeFileSync(file, `${JSON.stringify(brand, null, 2)}\n`);
    console.log(
      `Wrote ${file}.\nNext: put fonts in ${path.join(root, "fonts")} and a logo in ${root}, then run: node brand.mjs check ${target}`,
    );
    return;
  }
  if (!existsSync(file)) {
    console.error(`No brand.json at ${file}. Run: node brand.mjs init <studio-dir>`);
    process.exit(2);
  }
  let brand;
  try {
    brand = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`brand.json is not valid JSON: ${e.message}`);
    process.exit(1);
  }
  const found = checkBrand(brand, {
    fontFiles: readFontFiles(path.join(root, "fonts")),
    logoExists: (rel) => existsSync(path.join(root, rel)),
    lang: flags.lang ?? "en",
  });
  const errors = found.filter((f) => f.level === "error").length;
  console.log(
    capLines(
      found.map((f) => `${f.level === "error" ? "ERROR" : "warn "} ${f.message}`),
      errors
        ? `${errors} error(s), ${found.length - errors} warning(s).`
        : `OK: brand.json is valid (${found.length} warning(s)).`,
    ),
  );
  process.exit(errors ? 1 : 0);
}

if (isEntry(import.meta.url)) main();
