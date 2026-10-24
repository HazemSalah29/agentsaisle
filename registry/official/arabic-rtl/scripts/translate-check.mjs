#!/usr/bin/env node
// Compares messages/en.json with messages/ar.json: missing and extra keys, untranslated values,
// placeholder mismatches, invalid ICU syntax, plural messages missing Arabic categories and glossary
// violations. Read-only. Exit 1 when there is any error.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

export const ARABIC_CATEGORIES = ["zero", "one", "two", "few", "many", "other"];
const SELECTOR = /^(?:zero|one|two|few|many|other|=\d+)$/;

/** Flatten nested message JSON to { "a.b.c": "text" }. */
export function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

/**
 * Parse an ICU MessageFormat string. Returns { args: Set<string>, tags: Set<string>,
 * plurals: [{ arg, kind, selectors }], error?: string }. Handles quoting ('{'), nested plural/select
 * and rich-text tags (<b>...</b>) as next-intl uses them.
 */
export function parseIcu(msg) {
  const args = new Set();
  const tags = new Set();
  const plurals = [];
  let i = 0;
  const fail = (m) => {
    throw new Error(m);
  };
  const skipWs = () => {
    while (/\s/.test(msg[i] ?? "")) i++;
  };
  // Parse message text until a closing brace (when nested) or end.
  const message = (nested) => {
    while (i < msg.length) {
      const c = msg[i];
      if (c === "'") {
        if (msg[i + 1] === "'") i += 2;
        else if (msg[i + 1] === "{" || msg[i + 1] === "}") {
          const end = msg.indexOf("'", i + 1);
          i = end < 0 ? msg.length : end + 1;
        } else i++;
      } else if (c === "{") {
        i++;
        argument();
      } else if (c === "}") {
        if (!nested) fail("unmatched }");
        return;
      } else if (c === "<") {
        const t = /^<\/?([A-Za-z][\w-]*)\s*\/?>/.exec(msg.slice(i));
        if (t) {
          tags.add(t[1]);
          i += t[0].length;
        } else i++;
      } else i++;
    }
    if (nested) fail("missing }");
  };
  const argument = () => {
    skipWs();
    const name = /^[\w.-]+/.exec(msg.slice(i));
    if (!name) fail("empty or invalid placeholder");
    args.add(name[0]);
    i += name[0].length;
    skipWs();
    if (i >= msg.length) fail("missing }");
    if (msg[i] === "}") return void i++;
    if (msg[i] !== ",") fail(`bad placeholder {${name[0]}`);
    i++;
    skipWs();
    const type = /^\w+/.exec(msg.slice(i));
    if (!type) fail(`missing type in {${name[0]}`);
    i += type[0].length;
    skipWs();
    const kind = type[0];
    if (kind === "plural" || kind === "select" || kind === "selectordinal") {
      if (msg[i] !== ",") fail(`missing options in {${name[0]}, ${kind}`);
      i++;
      const selectors = [];
      skipWs();
      if (kind !== "select") {
        const off = /^offset:\s*\d+/.exec(msg.slice(i));
        if (off) {
          i += off[0].length;
          skipWs();
        }
      }
      while (msg[i] !== "}") {
        const sel = /^[^\s{}]+/.exec(msg.slice(i));
        if (!sel) fail(`bad options in {${name[0]}, ${kind}`);
        i += sel[0].length;
        skipWs();
        if (kind !== "select" && !SELECTOR.test(sel[0]))
          fail(`unknown plural selector "${sel[0]}"`);
        if (msg[i] !== "{") fail(`selector "${sel[0]}" has no message`);
        i++;
        message(true);
        i++; // closing }
        selectors.push(sel[0]);
        skipWs();
        if (i >= msg.length) fail("missing }");
      }
      i++;
      if (!selectors.includes("other")) fail(`{${name[0]}, ${kind}} has no "other" option`);
      if (kind !== "select") plurals.push({ arg: name[0], kind, selectors });
      return;
    }
    // number/date/time with optional style
    if (msg[i] === ",") {
      const end = msg.indexOf("}", i);
      if (end < 0) fail("missing }");
      i = end;
    }
    if (msg[i] !== "}") fail(`bad placeholder {${name[0]}`);
    i++;
  };
  try {
    message(false);
  } catch (e) {
    return { args, tags, plurals, error: e.message };
  }
  return { args, tags, plurals };
}

/** Arabic categories a plural message still needs; =0, =1 and =2 count for zero, one and two. */
export function missingArabicCategories(selectors) {
  const explicit = { zero: "=0", one: "=1", two: "=2" };
  return ARABIC_CATEGORIES.filter(
    (c) => !selectors.includes(c) && !(explicit[c] && selectors.includes(explicit[c])),
  );
}

/** Parse the small glossary format: `brands:` list and `terms:` list of en/ar pairs. */
export function parseGlossary(text) {
  const brands = [];
  const terms = [];
  let section = "";
  let cur = null;
  const unq = (s) => s.trim().replace(/^(["'])(.*)\1$/, "$2");
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const head = /^(\w+):\s*$/.exec(line);
    if (head) {
      section = head[1];
      continue;
    }
    if (section === "brands") {
      const m = /^\s*-\s*(.+)$/.exec(line);
      if (m) brands.push(unq(m[1]));
    } else if (section === "terms") {
      const m = /^\s*(-\s*)?(en|ar):\s*(.+)$/.exec(line);
      if (!m) continue;
      if (m[2] === "en") {
        cur = { en: unq(m[3]), ar: "" };
        terms.push(cur);
      } else if (cur) cur.ar = unq(m[3]);
    }
  }
  return { brands, terms: terms.filter((t) => t.en && t.ar) };
}

const hasLatin = (s) => (s.replace(/\{[^}]*\}|<[^>]*>/g, "").match(/[A-Za-z]/g) ?? []).length >= 2;
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const wordRe = (w) =>
  new RegExp(`(?<![A-Za-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`, "i");

/** Compare two flattened message maps. Returns [{severity, rule, key, message}]. */
export function compare(en, ar, glossary = { brands: [], terms: [] }) {
  const out = [];
  const add = (severity, rule, key, message) => out.push({ severity, rule, key, message });
  for (const key of Object.keys(en))
    if (!(key in ar)) add("error", "missing", key, "missing in ar");
  for (const key of Object.keys(ar))
    if (!(key in en)) add("warn", "extra", key, "in ar but not in en");
  for (const [key, enText] of Object.entries(en)) {
    const arText = ar[key];
    if (arText === undefined) continue;
    const e = parseIcu(enText);
    const a = parseIcu(arText);
    if (e.error) add("error", "icu", key, `en: invalid ICU (${e.error})`);
    if (a.error) add("error", "icu", key, `ar: invalid ICU (${a.error})`);
    if (!e.error && !a.error) {
      if (!sameSet(e.args, a.args)) {
        const miss = [...e.args].filter((x) => !a.args.has(x));
        const more = [...a.args].filter((x) => !e.args.has(x));
        add(
          "error",
          "placeholder",
          key,
          `placeholders differ (missing: ${miss.join(",") || "-"}; unexpected: ${more.join(",") || "-"})`,
        );
      }
      if (!sameSet(e.tags, a.tags)) add("error", "placeholder", key, "rich-text tags differ");
      for (const p of a.plurals) {
        const miss = missingArabicCategories(p.selectors);
        if (miss.length)
          add(
            "error",
            "plural",
            key,
            `{${p.arg}} plural is missing Arabic categories: ${miss.join(", ")}`,
          );
      }
      if (e.plurals.length && !a.plurals.length)
        add("error", "plural", key, "en uses plural, ar does not");
    }
    if (arText === enText && hasLatin(enText))
      add("warn", "untranslated", key, "same as en (likely untranslated)");
    for (const b of glossary.brands)
      if (wordRe(b).test(enText) && !arText.includes(b))
        add("error", "glossary", key, `brand "${b}" must stay as written`);
    // Placeholder names such as {email} are not text, so they must not trigger a term.
    const enWords = enText.replace(/\{[^}]*\}|<\/?[A-Za-z][\w-]*>/g, " ");
    for (const t of glossary.terms) {
      // `ar` may list accepted forms separated by "|" (definite, indefinite, possessive ...).
      const forms = t.ar
        .split("|")
        .map((f) => f.trim())
        .filter(Boolean);
      if (wordRe(t.en).test(enWords) && !forms.some((f) => arText.includes(f)))
        add("error", "glossary", key, `"${t.en}" should be "${forms[0]}"`);
    }
  }
  return out;
}

function findFile(root, names) {
  for (const n of names) if (existsSync(path.join(root, n))) return path.join(root, n);
  return null;
}

function main(argv) {
  const { flags, positional } = parseArgs(argv, {
    booleans: ["json"],
    strings: ["en", "ar", "glossary"],
  });
  const root = path.resolve(positional[0] ?? ".");
  const enFile =
    flags.en ?? findFile(root, ["messages/en.json", "src/messages/en.json", "locales/en.json"]);
  const arFile =
    flags.ar ?? findFile(root, ["messages/ar.json", "src/messages/ar.json", "locales/ar.json"]);
  if (!enFile || !arFile || !existsSync(enFile) || !existsSync(arFile)) {
    console.error("Could not find messages/en.json and messages/ar.json. Pass --en and --ar.");
    process.exit(2);
  }
  const glossFile = flags.glossary ?? findFile(root, ["glossary.ar.yaml", "i18n/glossary.ar.yaml"]);
  let results;
  try {
    results = compare(
      flatten(JSON.parse(readFileSync(enFile, "utf8"))),
      flatten(JSON.parse(readFileSync(arFile, "utf8"))),
      glossFile ? parseGlossary(readFileSync(glossFile, "utf8")) : undefined,
    );
  } catch (e) {
    console.error(`Could not read messages: ${e.message}`);
    process.exit(2);
  }
  const errors = results.filter((r) => r.severity === "error").length;
  if (flags.json) console.log(JSON.stringify(results, null, 2));
  else {
    results.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
    const lines = results.map((r) => `${r.severity} ${r.rule} ${r.key}: ${r.message}`);
    console.log(
      capLines(
        lines,
        `${errors} error(s), ${results.length - errors} warning(s)${errors ? "" : ": passes"}`,
      ),
    );
  }
  process.exit(errors ? 1 : 0);
}

if (isEntry(import.meta.url)) main(process.argv.slice(2));
