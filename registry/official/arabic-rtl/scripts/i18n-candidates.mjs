#!/usr/bin/env node
// Lists hardcoded user-facing strings (JSX text, alt, title, placeholder, aria-label, label) with a suggested
// message key (page.section.element). Read-only: it never rewrites code; the agent does that file by file.
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  capLines,
  findKitDirs,
  isEntry,
  kitNote,
  lineIndex,
  parseArgs,
  stringSegments,
  walk,
} from "./_lib.mjs";

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

// Props and object keys that hold code, not text.
const NON_TEXT_KEYS = new Set([
  "classname",
  "class",
  "href",
  "src",
  "srcset",
  "id",
  "key",
  "type",
  "name",
  "value",
  "variant",
  "tone",
  "size",
  "rel",
  "target",
  "method",
  "action",
  "htmlfor",
  "role",
  "style",
  "as",
  "lang",
  "dir",
  "locale",
  "width",
  "height",
  "icon",
  "color",
  "font",
  "path",
  "slug",
  "to",
  "from",
  "import",
  "ref",
  "fill",
  "stroke",
  "viewbox",
  "d",
  "points",
  "cols",
  "rows",
  "autocomplete",
  "inputmode",
  "pattern",
  "step",
]);
const CLASS_CONTEXT = /(?:className|class)\s*[=:]|\b(?:cn|clsx|cva|twMerge|classNames)\(/;
const looksLikeClasses = (t) => {
  const tokens = t.split(/\s+/);
  return (
    tokens.every((x) => /^[a-z0-9:/[\]!.%#_()-]+$/.test(x)) &&
    (tokens.some((x) => /[-:]/.test(x)) || tokens.length === 1)
  );
};

/**
 * Strings in props, object literals, arrays and ternaries that read like user-facing text:
 * headline="Write the day up", { title: "Notes in seconds" }, ["Reusable templates"], open ? "Close" : "Open".
 * A heuristic: capitalised words or several words, no class names, no code-like keys.
 */
export function findPropStrings(src, rel) {
  const lineOf = lineIndex(src);
  const out = [];
  for (const seg of stringSegments(src)) {
    if (seg.glueStart || seg.glueEnd) continue;
    const t = seg.text.replace(/\s+/g, " ").trim();
    if (t.length < 3 || t.length > 300 || !/[A-Za-z\u0600-\u06ff]{2,}/.test(t)) continue;
    if (/:\/\/|^[/#.]|@|\\/.test(t) || looksLikeClasses(t)) continue;
    const humanish = /\s/.test(t) || /^[A-Z\u0600-\u06ff][A-Za-z\u0600-\u06ff]{2,}$/.test(t);
    if (!humanish) continue;
    const ctx =
      src
        .slice(Math.max(0, seg.start - 120), seg.start - 1)
        .split("\n")
        .pop() ?? "";
    if (
      /(?:\bimport\b|\bfrom\b|\brequire\()[^\n]*$/.test(ctx) ||
      CLASS_CONTEXT.test(ctx.slice(-100))
    )
      continue;
    if (/[=!]==?\s*$/.test(ctx) || /\bcase\s*$/.test(ctx)) continue;
    const prop = /([A-Za-z_][\w-]*)\s*(?:=\s*\{?|:)\s*$/.exec(ctx);
    const listy = /[[(,?:]\s*$/.test(ctx);
    if (!prop && !listy) continue;
    const key = prop?.[1] ?? "text";
    if (NON_TEXT_KEYS.has(key.toLowerCase())) continue;
    // A bare capitalised word is only text when it has a text-like key (label, title ...).
    if (!/\s/.test(t) && !prop && !listy) continue;
    out.push({
      line: lineOf(seg.start),
      element: key.replace(/^aria-/, ""),
      text: t,
      key: suggestKey(rel, key.replace(/^aria-/, ""), t),
      prop: true,
    });
  }
  return out;
}

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
  // Strings in props and expressions that the patterns above do not reach.
  for (const c of findPropStrings(src, rel)) {
    if (!out.some((o) => o.line === c.line && o.text === c.text)) out.push(c);
  }
  return out.sort((a, b) => a.line - b.line);
}

export function candidates(root, { includeKit = false } = {}) {
  const res = [];
  for (const file of walk(root, { exts: [".jsx", ".tsx"], includeKit })) {
    const rel = path.relative(root, file) || path.basename(file);
    for (const c of findCandidates(readFileSync(file, "utf8"), rel)) res.push({ file: rel, ...c });
  }
  return res;
}

function main(argv) {
  const { flags, positional } = parseArgs(argv, { booleans: ["json", "include-kit"] });
  const root = path.resolve(positional[0] ?? ".");
  const all = candidates(root, { includeKit: Boolean(flags["include-kit"]) });
  if (flags.json) return console.log(JSON.stringify(all, null, 2));
  const lines = all.map((c) => `${c.file}:${c.line} "${c.text.slice(0, 60)}" -> ${c.key}`);
  // Say so when a design-kit folder was stepped over, and how many strings are in it.
  let note = "";
  const kitDirs = flags["include-kit"] ? [] : findKitDirs(root).map((d) => path.join(root, d));
  if (kitDirs.length) {
    const inside = kitDirs.reduce((n, d) => n + candidates(d, { includeKit: true }).length, 0);
    note = `\n${kitNote(
      kitDirs.map((d) => path.relative(process.cwd(), d)),
      ` (${inside} string(s) inside)`,
    )}`;
  }
  console.log(
    capLines(
      lines,
      `${all.length} candidate string(s) in ${new Set(all.map((c) => c.file)).size} file(s)${note}`,
    ),
  );
}

if (isEntry(import.meta.url)) main(process.argv.slice(2));
