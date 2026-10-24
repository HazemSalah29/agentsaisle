// Physical -> logical Tailwind class mapping, shared by rtl-scan (suggestions) and rtl-codemod (rewrites).
// Pure functions, no file access. The table is mirrored in references/logical-css.md.

/** Utilities whose value is a spacing number, fraction, keyword or arbitrary value. */
const SPACING = "spacing";
/** Utilities whose suffix is free-form (rounded sizes, border widths and colors). */
const FREE = "free";
/** Utilities that are complete words with no suffix. */
const EXACT = "exact";

/** [physical prefix, logical prefix, value kind]. Longest prefix wins, so keep rounded-tl before rounded-t. */
export const PREFIX_MAP = [
  ["scroll-ml", "scroll-ms", SPACING],
  ["scroll-mr", "scroll-me", SPACING],
  ["scroll-pl", "scroll-ps", SPACING],
  ["scroll-pr", "scroll-pe", SPACING],
  ["ml", "ms", SPACING],
  ["mr", "me", SPACING],
  ["pl", "ps", SPACING],
  ["pr", "pe", SPACING],
  ["left", "start", SPACING],
  ["right", "end", SPACING],
  ["rounded-tl", "rounded-ss", FREE],
  ["rounded-tr", "rounded-se", FREE],
  ["rounded-bl", "rounded-es", FREE],
  ["rounded-br", "rounded-ee", FREE],
  ["rounded-l", "rounded-s", FREE],
  ["rounded-r", "rounded-e", FREE],
  ["border-l", "border-s", FREE],
  ["border-r", "border-e", FREE],
  ["text-left", "text-start", EXACT],
  ["text-right", "text-end", EXACT],
  ["float-left", "float-start", EXACT],
  ["float-right", "float-end", EXACT],
  ["clear-left", "clear-start", EXACT],
  ["clear-right", "clear-end", EXACT],
];

const SPACING_VALUE = /^(?:\d+(?:\.\d+)?|\d+\/\d+|px|auto|full|0|\[[^\]\s]+\]|\([^)\s]+\))$/;
const FREE_VALUE = /^[\w./%#]+(?:-[\w./%#]+)*$|^\[[^\]\s]+\]$|^\([^)\s]+\)$/;

/** Utilities that have no logical form or need design judgment. Reported, never rewritten. */
export const MANUAL_RULES = [
  {
    id: "space-x",
    test: /^-?space-x(?:-|$)/,
    why: "space-x-* puts the gap on the left of each child, so it does not flip.",
    fix: "Use flex/grid with gap-*, or add rtl:space-x-reverse.",
  },
  {
    id: "translate-x",
    test: /^-?translate-x-(?!0$)/,
    why: "translate-x moves along the physical x axis, so it does not flip.",
    fix: "Use a logical inset, or add rtl:translate-x-* with the opposite sign (or rtl:-translate-x-*).",
  },
  {
    id: "gradient-direction",
    test: /^bg-(?:linear-)?(?:gradient-)?to-(?:r|l|tr|tl|br|bl)$/,
    why: "A gradient direction names a physical side.",
    fix: "Add the opposite direction under rtl: (for example bg-gradient-to-r rtl:bg-gradient-to-l).",
  },
  {
    id: "background-position",
    test: /^bg-(?:left|right)(?:-(?:top|bottom))?$/,
    why: "A background position names a physical side.",
    fix: "Add the opposite position under rtl:.",
  },
  {
    id: "transform-origin",
    test: /^origin-(?:left|right)$/,
    why: "A transform origin names a physical side.",
    fix: "Add the opposite origin under rtl:.",
  },
];

/** Split "md:hover:-ml-4!" style tokens: variants, important, negative and the base utility. */
export function parseToken(token) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of token) {
    if (ch === "[" || ch === "(") depth++;
    if (ch === "]" || ch === ")") depth--;
    if (ch === ":" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  let base = cur;
  let importantPrefix = false;
  let importantSuffix = false;
  let negative = false;
  if (base.startsWith("!")) {
    importantPrefix = true;
    base = base.slice(1);
  }
  if (base.endsWith("!")) {
    importantSuffix = true;
    base = base.slice(0, -1);
  }
  if (base.startsWith("-")) {
    negative = true;
    base = base.slice(1);
  }
  return { variants: parts, importantPrefix, importantSuffix, negative, base };
}

function build(p, base) {
  return [
    ...p.variants.map((v) => v + ":"),
    p.importantPrefix ? "!" : "",
    p.negative ? "-" : "",
    base,
    p.importantSuffix ? "!" : "",
  ].join("");
}

/**
 * Classify one class token.
 * Returns null (not directional), { kind: "map", to } (safe rewrite) or { kind: "manual", rule, why, fix }.
 */
export function classify(token) {
  if (!token || token.includes("${")) return null;
  const p = parseToken(token);
  const { base } = p;
  // An explicit rtl:/ltr: variant is a deliberate direction choice; leave it alone.
  if (p.variants.some((v) => v === "rtl" || v === "ltr")) return null;
  for (const [from, to, kind] of PREFIX_MAP) {
    if (kind === EXACT) {
      if (base === from) return { kind: "map", to: build(p, to), from: token };
      continue;
    }
    if (base === from && kind === FREE) return { kind: "map", to: build(p, to), from: token };
    if (!base.startsWith(from + "-")) continue;
    const value = base.slice(from.length + 1);
    const ok = kind === SPACING ? SPACING_VALUE.test(value) : FREE_VALUE.test(value);
    if (!ok) return null;
    return { kind: "map", to: build(p, `${to}-${value}`), from: token };
  }
  for (const r of MANUAL_RULES) {
    if (r.test.test(base))
      return { kind: "manual", rule: r.id, why: r.why, fix: r.fix, from: token };
  }
  return null;
}

/** True when a class string already handles direction (an rtl:/ltr: variant on the same element). */
export const hasDirectionVariant = (tokens) =>
  tokens.some((t) => /^(?:[\w-]+:)*(?:rtl|ltr):/.test(t));

/**
 * Rewrite the tokens of one class string. Returns the new string plus the tokens left for manual review.
 * `left-*`/`right-*` next to translate-x (centering tricks) are not rewritten: the pair must flip together.
 */
export function rewriteClassString(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const hasTranslate = tokens.some((t) => /^-?translate-x-(?!0$)/.test(parseToken(t).base));
  const animated = tokens.some((t) => /^(?:[\w-]+:)*(?:animate|transition)/.test(t));
  const manual = [];
  const changes = [];
  const out = text.replace(/\S+/g, (tok) => {
    const c = classify(tok);
    if (!c) return tok;
    if (c.kind === "manual") {
      const covered =
        (c.rule === "space-x" && tokens.includes("rtl:space-x-reverse")) ||
        (c.rule === "translate-x" && (animated || hasDirectionVariant(tokens)));
      if (!covered) manual.push(c);
      return tok;
    }
    const base = parseToken(tok).base;
    if (hasTranslate && /^(?:left|right)-/.test(base)) {
      manual.push({
        kind: "manual",
        rule: "inset-with-translate",
        from: tok,
        why: "left/right next to translate-x is a centering trick; both must flip together.",
        fix: `Use ${c.to} and an rtl: translate with the opposite sign, or center with inset-x-0 mx-auto.`,
      });
      return tok;
    }
    changes.push(c);
    return c.to;
  });
  return { text: out, changes, manual };
}
