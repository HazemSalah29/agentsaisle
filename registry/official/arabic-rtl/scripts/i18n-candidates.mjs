#!/usr/bin/env node
// Lists hardcoded user-facing strings (JSX text, alt, title, placeholder, aria-label, label) with a suggested
// message key (page.section.element). Read-only: it never rewrites code; the agent does that file by file.
import { readFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, lineIndex, parseArgs, walk } from "./_lib.mjs";

const ATTRS = ["alt", "title", "placeholder", "aria-label", "label", "aria-description"];
const camel = (words) => words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join("");

/** Words of a string, lowercased, without punctuation or placeholders. */
const words = (text) =>
  text
    .replace(/\{[^}]*\}/g, " ")
    .toLowerCase()
    .match(/[a-z0-9؀-ۿ]+/g) ?? [];

/** Route or component name for a file: app/(shop)/cart/page.tsx -> cart, components/NavBar.tsx -> navBar. */
export function pageName(rel) {
  const parts = rel
    .split(path.sep)
    .join("/")
    .replace(/\.[jt]sx?$/, "")
    .split("/");
  let stem = parts.pop();
  if (/^(page|layout|index|template)$/.test(stem)) {
    while (parts.length && /^(\[.*\]|\(.*\)|app|src|pages)$/.test(parts[parts.length - 1]))
      parts.pop();
    stem = parts.pop() ?? "home";
  }
  const w = stem
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? ["home"];
  return camel(w);
}

export function suggestKey(rel, element, text) {
  const w = words(text).slice(0, 4);
  return [pageName(rel), element, camel(w.length ? w : ["text"])].join(".");
}

const looksLikeText = (t) => /[A-Za-z؀-ۿ]{2,}/.test(t) && !/[;]|=>|^[\w.-]+\(.*\)$/.test(t);

/** Candidate strings in one file's text. */
export function findCandidates(src, rel) {
  const lineOf = lineIndex(src);
  const out = [];
  const seen = new Set();
  const push = (offset, element, text) => {
    const t = text.replace(/\s+/g, " ").trim();
    if (!looksLikeText(t) || seen.has(offset)) return;
    seen.add(offset);
    out.push({ line: lineOf(offset), element, text: t, key: suggestKey(rel, element, t) });
  };
  for (const attr of ATTRS) {
    const re = new RegExp(
      `(?<![-\\w])${attr}=(?:"([^"{}]+)"|'([^'{}]+)'|\\{\\s*["']([^"'{}]+)["']\\s*\\})`,
      "g",
    );
    let m;
    while ((m = re.exec(src))) push(m.index, attr.replace(/^aria-/, ""), m[1] ?? m[2] ?? m[3]);
  }
  // JSX text: between a tag's closing > and the next < or {, not after => or inside generics.
  const text = /(?<![=-])>([^<>{}]+)(?=[<{])/g;
  let m;
  while ((m = text.exec(src))) {
    const before = src.slice(Math.max(0, m.index - 400), m.index);
    const tag = /<([A-Za-z][\w.]*)[^<>]*$/.exec(before);
    if (!tag) continue;
    push(m.index + 1, tag[1].toLowerCase().replace(/^.*\./, ""), m[1]);
  }
  return out.sort((a, b) => a.line - b.line);
}

export function candidates(root) {
  const res = [];
  for (const file of walk(root, { exts: [".jsx", ".tsx"] })) {
    const rel = path.relative(root, file) || path.basename(file);
    for (const c of findCandidates(readFileSync(file, "utf8"), rel)) res.push({ file: rel, ...c });
  }
  return res;
}

function main(argv) {
  const { flags, positional } = parseArgs(argv, { booleans: ["json"] });
  const root = path.resolve(positional[0] ?? ".");
  const all = candidates(root);
  if (flags.json) return console.log(JSON.stringify(all, null, 2));
  const lines = all.map((c) => `${c.file}:${c.line} "${c.text.slice(0, 60)}" -> ${c.key}`);
  console.log(
    capLines(
      lines,
      `${all.length} candidate string(s) in ${new Set(all.map((c) => c.file)).size} file(s)`,
    ),
  );
}

if (isEntry(import.meta.url)) main(process.argv.slice(2));
