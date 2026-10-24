#!/usr/bin/env node
// Finds RTL problems in a web project and prints file:line, severity and a suggested fix.
// Read-only. error = breaks RTL; warn = likely issue. Exit 1 if any error, so it can gate CI.
// Add "rtl-scan-ignore" in a comment on the same or previous line to silence one finding.
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { classify, hasDirectionVariant, parseToken } from "./_classmap.mjs";
import {
  capLines,
  findKitDirs,
  kitNote,
  isEntry,
  lineIndex,
  parseArgs,
  segmentTokens,
  tailwindVersion,
  stringSegments,
  walk,
} from "./_lib.mjs";

const CODE_EXTS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
const CSS_EXTS = [".css", ".scss", ".pcss"];

const DIRECTIONAL_ICON =
  /<((?:Arrow|ArrowBig|ArrowLong|Chevron|Chevrons|Caret|Move|Angle|Navigation)(?:Left|Right)(?:Icon|Circle|Square)?|(?:Left|Right)Arrow|(?:Previous|Next)Icon)\b/;
const CSS_PHYSICAL = [
  [
    /\b(margin|padding)-(left|right)\b/,
    (m) => `${m[1]}-inline-${m[2] === "left" ? "start" : "end"}`,
  ],
  [/\b(margin|padding)(Left|Right)\b/, (m) => `${m[1]}Inline${m[2] === "Left" ? "Start" : "End"}`],
  [
    /\bborder-(left|right)(-(?:width|style|color))?\b/,
    (m) => `border-inline-${m[1] === "left" ? "start" : "end"}${m[2] ?? ""}`,
  ],
  [
    /\bborder(Left|Right)(Width|Style|Color)?\b/,
    (m) => `borderInline${m[1] === "Left" ? "Start" : "End"}${m[2] ?? ""}`,
  ],
  [
    /\bborder-(top|bottom)-(left|right)-radius\b/,
    (m) => `border-${m[1] === "top" ? "start" : "end"}-${m[2] === "left" ? "start" : "end"}-radius`,
  ],
  [/\btext-align\s*:\s*(left|right)\b/, (m) => `text-align: ${m[1] === "left" ? "start" : "end"}`],
  [
    /\btextAlign\s*:\s*["'](left|right)["']/,
    (m) => `textAlign: "${m[1] === "left" ? "start" : "end"}"`,
  ],
  [/\bfloat\s*:\s*(left|right)\b/, (m) => `float: inline-${m[1] === "left" ? "start" : "end"}`],
  [
    /(?<![-\w.])(left|right)\s*:\s*(?!["'](?:left|right)["'])[-\w.%(]/,
    (m) => `inset-inline-${m[1] === "left" ? "start" : "end"}`,
  ],
];
const LAYOUT_TAGS =
  /<(div|section|main|nav|header|footer|aside|ul|ol|body|html|article|form)\b[^>]*\bdir=["']ltr["']/;

/** Scan one file's text. `ext` picks the rule set. Returns [{line, rule, severity, message, fix}]. */
export function scanText(src, ext, { tracking = true, spaceXLogical = false } = {}) {
  const findings = [];
  const lines = src.split("\n");
  const add = (line, rule, severity, message, fix) => {
    const near = `${lines[line - 1] ?? ""}\n${lines[line - 2] ?? ""}`;
    if (near.includes("rtl-scan-ignore")) return;
    findings.push({ line, rule, severity, message, fix });
  };

  if (CODE_EXTS.includes(ext)) {
    const lineOf = lineIndex(src);
    for (const seg of stringSegments(src)) {
      const tokens = segmentTokens(seg);
      const dirAware = hasDirectionVariant(tokens.map((t) => t.token));
      const hasTranslate = tokens.some((t) =>
        /^-?translate-x-(?!0$)/.test(parseToken(t.token).base),
      );
      const hasAnimation = tokens.some((t) => /^(?:[\w-]+:)*(?:animate|transition)/.test(t.token));
      for (const { token, offset } of tokens) {
        const line = lineOf(offset);
        const c = classify(token);
        if (
          c?.kind === "map" &&
          hasTranslate &&
          /^(?:left|right)-/.test(parseToken(token).base) &&
          !dirAware
        )
          add(
            line,
            "inset-with-translate",
            "warn",
            `${token} is paired with translate-x (a centering trick)`,
            `Use ${c.to} and an rtl: translate with the opposite sign, or center with inset-x-0 mx-auto`,
          );
        else if (c?.kind === "map")
          add(line, "physical-class", "error", `Physical class ${token}`, `Use ${c.to}`);
        else if (c?.kind === "manual") {
          if (c.rule === "space-x" && (dirAware || spaceXLogical)) continue;
          if (c.rule === "translate-x" && (hasAnimation || dirAware)) continue;
          if (c.rule !== "space-x" && c.rule !== "translate-x" && dirAware) continue;
          add(line, c.rule, "warn", `${token}: ${c.why}`, c.fix);
        } else if (tracking && /^(?:[\w-]+:)*tracking-(?!normal$)/.test(token)) {
          const v = parseToken(token).variants;
          if (!v.includes("ltr"))
            add(
              line,
              "letter-spacing",
              "warn",
              `${token} breaks Arabic letter joining`,
              "Reset to normal under :lang(ar) (see typography.md)",
            );
        }
      }
    }
  }

  lines.forEach((text, idx) => {
    const line = idx + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(text) && !text.includes("<")) return;
    if (CODE_EXTS.includes(ext) || CSS_EXTS.includes(ext)) {
      for (const [re, fix] of CSS_PHYSICAL) {
        const m = re.exec(text);
        if (!m) continue;
        // Skip Tailwind class names such as "text-left" that the class rule already reported.
        add(
          line,
          "physical-css",
          "error",
          `Physical CSS property: ${m[0].trim()}`,
          `Use ${fix(m)}`,
        );
        break;
      }
      if (
        tracking &&
        /\bletter-spacing\s*:|\bletterSpacing\s*:/.test(text) &&
        !/normal|0(?:px|em)?\s*[;,]?\s*$/.test(text)
      )
        add(
          line,
          "letter-spacing",
          "warn",
          "letter-spacing breaks Arabic letter joining",
          "Reset to normal under :lang(ar)",
        );
    }
    if (CODE_EXTS.includes(ext)) {
      const dir = LAYOUT_TAGS.exec(text);
      if (dir)
        add(
          line,
          "dir-ltr",
          "error",
          `Hardcoded dir="ltr" on <${dir[1]}>`,
          'Remove it, or use dir="auto"; keep ltr only on email/URL/code fields (see bidi.md)',
        );
      const icon = DIRECTIONAL_ICON.exec(text);
      if (
        icon &&
        !/rtl:|DirectionalIcon/.test(text) &&
        !/DirectionalIcon/.test(lines[idx - 1] ?? "") &&
        !/DirectionalIcon/.test(lines[idx - 2] ?? "")
      )
        add(
          line,
          "directional-icon",
          "warn",
          `<${icon[1]}> is a directional icon`,
          "Wrap in <DirectionalIcon directional> (see mirroring.md)",
        );
      const loc = /\.(toLocale(?:Date|Time)?String)\(\s*(\)|undefined|\{)/.exec(text);
      if (loc)
        add(
          line,
          "locale-format",
          "warn",
          `${loc[1]}() without an explicit locale`,
          "Pass the locale and numbering system, e.g. 'ar-EG-u-nu-latn' (see numbers-dates.md)",
        );
      const intl = /new Intl\.(\w+)\(\s*(\)|undefined)/.exec(text);
      if (intl)
        add(
          line,
          "locale-format",
          "warn",
          `Intl.${intl[1]} without an explicit locale`,
          "Pass the locale explicitly",
        );
      if (
        /(?<![=\w])\{\s*(?:`[^`]*[A-Za-z]{2,}[^`]*\$\{|["'][^"']*[A-Za-z]{2,}[^"']*["']\s*\+|[\w.()]+\s*\+\s*["'][^"']*[A-Za-z]{2,})/.test(
          text,
        ) &&
        /[<>]|\{/.test(text)
      )
        add(
          line,
          "concat-text",
          "warn",
          "User-facing text built by concatenation",
          "Use one message with placeholders; word order changes in Arabic (see translation.md)",
        );
      else if (
        />\s*[^<>{}=]*\b[A-Za-z]{2,}\b[^<>{}=]*\{[^{}]+\}|\}\s*[A-Za-z]{3,}[^<>{}=]*(?:<|$)/.test(
          text,
        ) &&
        /^\s*[<>{A-Za-z]/.test(text) &&
        !/^\s*(?:import|export|const|let|return|if)\b/.test(text) &&
        /<|>\s*$/.test(text)
      )
        add(
          line,
          "concat-text",
          "warn",
          "Text next to an interpolation in JSX",
          "Use one message with placeholders (see translation.md)",
        );
    }
  });
  return findings;
}

/** Does any global stylesheet reset letter-spacing for Arabic? Then tracking classes are harmless. */
export function hasArabicTrackingReset(files) {
  return files.some((f) =>
    /:lang\(ar\)[^{]*\{[^}]*letter-spacing\s*:\s*(?:normal|0)/s.test(readFileSync(f, "utf8")),
  );
}

export function scan(roots, { includeKit = false } = {}) {
  const list = Array.isArray(roots) ? roots : [roots];
  // Project root: the first directory given, else the working directory (when only files are given).
  const project = list.find((r) => statSync(r).isDirectory()) ?? process.cwd();
  // Tailwind 4 generates space-x with margin-inline-start/end, so it already follows direction.
  const tw = tailwindVersion(project);
  const spaceXLogical = Boolean(tw && tw[0] >= 4);
  const exts = [...CODE_EXTS, ...CSS_EXTS];
  const seen = new Set();
  const targets = [];
  for (const r of list)
    for (const f of walk(r, { exts, includeKit })) {
      if (seen.has(f)) continue;
      seen.add(f);
      targets.push({ file: f, base: statSync(r).isDirectory() ? r : path.dirname(r) });
    }
  // The :lang(ar) reset usually lives in a global stylesheet, so look at the whole project's CSS.
  const css = walk(project, { exts: CSS_EXTS, includeKit });
  const tracking = !hasArabicTrackingReset(css);
  const out = [];
  for (const { file, base } of targets) {
    const rel = path.relative(base, file) || path.basename(file);
    for (const f of scanText(readFileSync(file, "utf8"), path.extname(file), {
      tracking,
      spaceXLogical,
    }))
      out.push({ file: rel, ...f });
  }
  return out;
}

function main(argv) {
  const { flags, positional } = parseArgs(argv, {
    booleans: ["json", "include-kit", "errors-only"],
    strings: ["rule"],
  });
  const roots = (positional.length ? positional : ["."]).map((p) => path.resolve(p));
  for (const r of roots)
    if (!existsSync(r)) {
      console.error(`Not found: ${r}`);
      process.exit(2);
    }
  let findings = scan(roots, { includeKit: Boolean(flags["include-kit"]) });
  if (flags.rule) findings = findings.filter((f) => f.rule === flags.rule);
  if (flags["errors-only"]) findings = findings.filter((f) => f.severity === "error");
  const errors = findings.filter((f) => f.severity === "error").length;
  // Say so when a design-kit folder was stepped over, and how much is in it.
  const kitDirs = flags["include-kit"]
    ? []
    : roots.flatMap((r) => findKitDirs(r).map((d) => path.join(r, d)));
  let note = "";
  if (kitDirs.length) {
    const inside = scan(kitDirs, { includeKit: true });
    const e = inside.filter((f) => f.severity === "error").length;
    note = `\n${kitNote(
      kitDirs.map((d) => path.relative(process.cwd(), d)),
      ` (${e} error(s), ${inside.length - e} warning(s) inside)`,
    )}`;
  }
  if (flags.json) console.log(JSON.stringify(findings, null, 2));
  else {
    findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
    const lines = findings.map(
      (f) =>
        `${f.file}:${f.line} ${f.severity} ${f.rule}: ${f.message.replace(/\.$/, "")}. ${f.fix}`,
    );
    console.log(
      capLines(lines, `${errors} error(s), ${findings.length - errors} warning(s)${note}`),
    );
  }
  process.exit(errors ? 1 : 0);
}

if (isEntry(import.meta.url)) main(process.argv.slice(2));
