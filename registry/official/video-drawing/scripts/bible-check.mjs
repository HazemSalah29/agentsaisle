#!/usr/bin/env node
// Checks a character bible (characters/<name>/bible.md): the parts that make a character original, readable on
// screen and safe for children. The bible is plain text with "Key: value" lines and a "Never" list. Read-only.
// Usage: node bible-check.mjs <project-dir> [--character <name>]
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

export const SHAPES = ["round", "square", "triangle"];
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const NAME = /^[a-z][a-z0-9-]{0,31}$/;

// Well-known children's characters and shows. A small guard, not a full list: the skill's rule is that a
// character must not resemble any known one, and a name here is refused outright.
export const KNOWN = [
  "peppa",
  "bluey",
  "bingo heeler",
  "mickey",
  "minnie",
  "donald duck",
  "goofy",
  "elsa",
  "anna",
  "olaf",
  "moana",
  "simba",
  "nemo",
  "dory",
  "woody",
  "buzz lightyear",
  "shrek",
  "dumbo",
  "bambi",
  "pooh",
  "winnie",
  "piglet",
  "tigger",
  "pikachu",
  "pokemon",
  "mario",
  "luigi",
  "sonic",
  "kirby",
  "spongebob",
  "patrick star",
  "dora",
  "paw patrol",
  "chase",
  "cocomelon",
  "baby shark",
  "hello kitty",
  "doraemon",
  "peter rabbit",
  "paddington",
  "thomas the tank",
  "elmo",
  "big bird",
  "cookie monster",
  "sesame street",
  "barney",
  "teletubbies",
  "minions",
  "gru",
  "masha",
  "bugs bunny",
  "tom and jerry",
  "scooby",
  "snoopy",
  "garfield",
  "curious george",
  "clifford",
  "arthur",
  "caillou",
  "ben and holly",
  "peppa pig",
  "pj masks",
  "octonauts",
  "daniel tiger",
  "mickey mouse",
  "lightning mcqueen",
  "hulk",
  "spider-man",
  "spiderman",
  "batman",
  "superman",
  "harry potter",
  "gumball",
  "finn and jake",
];

/** The bible as data: "Key: value" lines (keys in any case) and the bullets under a "Never" heading. */
export function parseBible(text) {
  const out = { never: [] };
  let inNever = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      inNever = /^never\b/i.test(heading[1].trim());
      if (!inNever && !out.title) out.title = heading[1].trim();
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (inNever && bullet) {
      out.never.push(bullet[1].trim());
      continue;
    }
    const kv = /^(?:[-*]\s+)?([A-Za-z][A-Za-z ]{1,24}):\s*(.+)$/.exec(line);
    if (kv) out[kv[1].trim().toLowerCase().replace(/\s+/g, "-")] = kv[2].trim();
  }
  if (out.palette) out.colours = out.palette.split(/[\s,;]+/).filter(Boolean);
  return out;
}

const lum = (hex) => {
  const h = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join("") : hex.slice(1);
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = v.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Problems with a bible and the folder name it lives in, as readable strings. */
export function bibleProblems(bible, folder, rawText = "") {
  const out = [];
  if (!NAME.test(folder)) out.push("folder name: lower-case letters, digits and hyphens");
  if (!bible.name) out.push("Name: the character's name");
  for (const key of ["species", "personality", "catchphrase", "outfits"])
    if (!bible[key]) out.push(`${key[0].toUpperCase()}${key.slice(1)}: needed`);
  if (!SHAPES.includes((bible["shape-language"] ?? "").toLowerCase()))
    out.push(`Shape language: one of ${SHAPES.join(", ")}`);
  const c = bible.colours ?? [];
  if (c.length < 3 || c.length > 5 || !c.every((x) => HEX.test(x)))
    out.push("Palette: 3 to 5 colours written as #hex");
  else {
    if (new Set(c.map((x) => x.toLowerCase())).size !== c.length)
      out.push("Palette: colours must differ");
    const best = Math.max(...c.flatMap((a, i) => c.slice(i + 1).map((b) => contrast(a, b))));
    if (best < 3)
      out.push("Palette: no two colours differ enough to read on screen (contrast 3:1)");
  }
  if (bible.never.length < 2)
    out.push('Never: list at least 2 things the character never does (a "## Never" list)');
  // The "Never" list may name what to avoid, so it is not searched.
  const body = (rawText || JSON.stringify(bible)).replace(
    /^#{1,6}\s+never\b[\s\S]*?(?=^#{1,6}\s|$(?![\s\S]))/gim,
    "",
  );
  const hay = ` ${body.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ")} `;
  const hit = KNOWN.find((k) => hay.includes(` ${k} `));
  if (hit)
    out.push(
      `"${hit}" is a known character: make an original one (new name, new shape, new colours). Do not use or imitate it`,
    );
  return out;
}

export function loadBible(dir, name) {
  const file = path.join(dir, "characters", name, "bible.md");
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  return { text, bible: parseBible(text) };
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2), { strings: ["character"] });
  const dir = path.resolve(positional[0] ?? ".");
  const root = path.join(dir, "characters");
  const names = flags.character
    ? [flags.character]
    : existsSync(root)
      ? readdirSync(root).filter((n) => existsSync(path.join(root, n, "bible.md")))
      : [];
  if (!names.length) {
    console.error(
      "No character bible found: write characters/<name>/bible.md (references/character-bible.md).",
    );
    process.exit(1);
  }
  const lines = [];
  let bad = 0;
  for (const n of names) {
    const found = loadBible(dir, n);
    if (!found) {
      lines.push(`ERROR ${n}: characters/${n}/bible.md is missing`);
      bad++;
      continue;
    }
    const problems = bibleProblems(found.bible, n, found.text);
    bad += problems.length;
    lines.push(...problems.map((p) => `ERROR ${n}: ${p}`));
    if (!problems.length) lines.push(`ok ${n}`);
  }
  console.log(capLines(lines, bad ? `${bad} problem(s).` : "Every bible is ready."));
  process.exit(bad ? 1 : 0);
}

if (isEntry(import.meta.url)) main();
