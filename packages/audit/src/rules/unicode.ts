import type { AuditFinding } from "@agentsaisle/registry-schema";
import type { Rule } from "../types.js";
import { finding, isInstruction, isScript, isTextFile } from "../util.js";

const hex = (cp: number) => "U+" + cp.toString(16).toUpperCase().padStart(4, "0");

// Arabic-script ranges named in the brief, plus Hebrew for its legitimate RTL runs.
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const RTL_LETTER =
  /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFE]/;
const ARABIC_LETTER = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFE]/;
const LATIN = /[A-Za-z0-9\u00C0-\u024F]/;

const isTag = (cp: number) => cp >= 0xe0000 && cp <= 0xe007f;
const isBidiOverride = (cp: number) =>
  (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069);
const isBidiMark = (cp: number) =>
  isBidiOverride(cp) || cp === 0x200e || cp === 0x200f || cp === 0x061c;
const isZeroWidth = (cp: number) =>
  cp === 0x200b ||
  cp === 0x2060 ||
  cp === 0xfeff ||
  cp === 0x200c ||
  cp === 0x200d ||
  cp === 0x180e;

function around(chars: string[], i: number, step: number, skip: (c: string) => boolean): string {
  for (let j = i + step; j >= 0 && j < chars.length; j += step) {
    const c = chars[j]!;
    if (!skip(c)) return c;
  }
  return "";
}

const unicode: Rule = (ctx) => {
  const out: AuditFinding[] = [];
  for (const f of ctx.skill.files) {
    if (!isTextFile(f)) continue;
    const script = isScript(f);
    const instruction = isInstruction(f);
    const reported = new Set<string>();
    const push = (
      rule: string,
      severity: AuditFinding["severity"],
      title: string,
      line: number,
      cp: number,
      why: string,
      fix: string,
    ) => {
      const key = `${rule}:${line}`;
      if (reported.has(key)) return;
      reported.add(key);
      out.push(
        finding({
          rule,
          severity,
          title,
          file: f.path,
          line,
          excerpt: `${hex(cp)} on this line`,
          why,
          fix,
        }),
      );
    };
    for (let li = 0; li < f.lines.length; li++) {
      const text = f.lines[li] ?? "";
      if (!/[^\t\x20-\x7E]/.test(text)) continue;
      const chars = Array.from(text);
      for (let i = 0; i < chars.length; i++) {
        const cp = chars[i]!.codePointAt(0)!;
        const n = li + 1;
        if (isTag(cp)) {
          push(
            "AA-U01",
            "critical",
            "Invisible Unicode tag characters",
            n,
            cp,
            "Tag characters are invisible but models can read them, so they can carry hidden instructions.",
            "Delete the invisible characters.",
          );
          continue;
        }
        if (isBidiOverride(cp) && script) {
          push(
            "AA-U02",
            "high",
            "Bidirectional control character in a script",
            n,
            cp,
            'Bidi controls can make code display differently than it runs ("Trojan Source").',
            "Remove it; use normal source text.",
          );
          continue;
        }
        if (isBidiMark(cp) && instruction) {
          const near = chars.slice(Math.max(0, i - 8), i + 9).join("");
          if (RTL_LETTER.test(near)) continue; // inside a Hebrew or Arabic run
          push(
            "AA-U03",
            "medium",
            "Bidirectional control character outside right-to-left text",
            n,
            cp,
            "Bidi controls can reorder text so a reader sees something different from what the agent reads.",
            'Remove it, or use markup such as dir="rtl" for right-to-left text.',
          );
          continue;
        }
        if (isZeroWidth(cp)) {
          if (cp === 0xfeff && li === 0 && i === 0) continue; // byte order mark at file start
          const prev = around(chars, i, -1, () => false);
          const next = around(chars, i, 1, () => false);
          const joiner = cp === 0x200c || cp === 0x200d;
          if (
            joiner &&
            (ARABIC_LETTER.test(prev) || ARABIC_LETTER.test(next) || ARABIC.test(prev + next))
          )
            continue;
          const nextCp = next ? next.codePointAt(0)! : 0;
          const cluster = isZeroWidth(nextCp) || (prev !== "" && isZeroWidth(prev.codePointAt(0)!));
          const inWord = LATIN.test(prev) && LATIN.test(next);
          if (cluster || inWord) {
            push(
              "AA-U04",
              "medium",
              "Zero-width characters inside text",
              n,
              cp,
              "Zero-width characters are invisible and can split words to dodge reviewers or filters.",
              "Delete the invisible characters.",
            );
          }
        }
      }
    }
  }
  return out;
};

export const unicodeRules: Rule[] = [unicode];
