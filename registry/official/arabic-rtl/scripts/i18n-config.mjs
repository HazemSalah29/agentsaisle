#!/usr/bin/env node
// Reads, validates and writes i18n.config.json, the file that remembers the decisions made once for an
// Arabic/RTL conversion. `--check` prints it; `--init` writes it (never overwrites without --force).
// No network. Read-only unless --init.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isEntry, parseArgs } from "./_lib.mjs";

export const FILE = "i18n.config.json";

export const DEFAULTS = {
  locales: ["en", "ar"],
  defaultLocale: "en",
  urlStrategy: "prefix",
  arabicVariety: "msa",
  digits: "latn",
  calendar: "gregorian",
  addressing: "neutral",
  arabicFont: "IBM Plex Sans Arabic",
};

export const CHOICES = {
  urlStrategy: ["prefix", "domain", "cookie"],
  arabicVariety: ["msa", "egyptian", "gulf", "levantine"],
  digits: ["latn", "arab"],
  calendar: ["gregorian", "gregorian+hijri"],
  addressing: ["neutral", "masculine", "variants"],
  arabicFont: [
    "IBM Plex Sans Arabic",
    "Noto Sans Arabic",
    "Noto Naskh Arabic",
    "Cairo",
    "Tajawal",
    "Readex Pro",
    "Almarai",
  ],
};

/** Merge over the defaults and validate. Returns { config, errors }. Unknown keys are errors. */
export function normalize(input) {
  const errors = [];
  const config = { ...DEFAULTS, ...input };
  for (const k of Object.keys(config)) if (!(k in DEFAULTS)) errors.push(`unknown key "${k}"`);
  const loc = config.locales;
  if (
    !Array.isArray(loc) ||
    loc.length < 1 ||
    !loc.every((l) => /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(l))
  )
    errors.push('locales must be a list of language tags such as ["en", "ar"]');
  else if (!loc.some((l) => l.split("-")[0] === "ar"))
    errors.push("locales must include an Arabic locale (ar)");
  else if (new Set(loc).size !== loc.length) errors.push("locales has duplicates");
  if (Array.isArray(loc) && !loc.includes(config.defaultLocale))
    errors.push(`defaultLocale "${config.defaultLocale}" is not in locales`);
  for (const [k, allowed] of Object.entries(CHOICES))
    if (!allowed.includes(config[k])) errors.push(`${k} must be one of: ${allowed.join(", ")}`);
  return { config, errors };
}

export function read(dir) {
  const file = path.join(dir, FILE);
  if (!existsSync(file)) return { exists: false, file };
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { exists: true, file, errors: [`not valid JSON (${e.message})`] };
  }
  return { exists: true, file, ...normalize(raw) };
}

/** Keys the file already answers, so the skill only asks the rest. */
export const answered = (raw) => Object.keys(DEFAULTS).filter((k) => k in raw);

function main(argv) {
  const { flags, positional } = parseArgs(argv, {
    booleans: ["init", "check", "force", "json"],
    strings: [
      "locales",
      "default-locale",
      "url-strategy",
      "arabic-variety",
      "digits",
      "calendar",
      "addressing",
      "arabic-font",
    ],
  });
  const dir = path.resolve(positional[0] ?? ".");
  if (flags.init) {
    const file = path.join(dir, FILE);
    if (existsSync(file) && !flags.force) {
      console.error(`${FILE} already exists. Use --force to overwrite, or --check to read it.`);
      process.exit(2);
    }
    const input = {};
    if (flags.locales) input.locales = flags.locales.split(",").map((s) => s.trim());
    const map = {
      "default-locale": "defaultLocale",
      "url-strategy": "urlStrategy",
      "arabic-variety": "arabicVariety",
      digits: "digits",
      calendar: "calendar",
      addressing: "addressing",
      "arabic-font": "arabicFont",
    };
    for (const [flag, key] of Object.entries(map)) if (flags[flag]) input[key] = flags[flag];
    const { config, errors } = normalize(input);
    if (errors.length) {
      console.error(errors.map((e) => `error: ${e}`).join("\n"));
      process.exit(1);
    }
    writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
    console.log(`wrote ${FILE}`);
    return;
  }
  const r = read(dir);
  if (!r.exists) {
    console.log(
      `${FILE} not found. Ask the decisions in references/decisions.md, then run with --init.`,
    );
    process.exit(2);
  }
  if (r.errors?.length) {
    console.error(r.errors.map((e) => `error: ${e}`).join("\n"));
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(r.file, "utf8"));
  const missing = Object.keys(DEFAULTS).filter((k) => !(k in raw));
  console.log(
    flags.json
      ? JSON.stringify(r.config, null, 2)
      : Object.entries(r.config)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join("\n"),
  );
  if (missing.length && !flags.json) console.log(`(defaults used for: ${missing.join(", ")})`);
}

if (isEntry(import.meta.url)) main(process.argv.slice(2));
