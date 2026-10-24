import type { AuditFinding, AuditSeverity } from "@agentsaisle/registry-schema";
import type { Ctx, LineInfo, LinePattern, SkillFile } from "./types.js";

export const SEVERITY_ORDER: AuditSeverity[] = ["critical", "high", "medium", "low", "info"];

const SECRET_RES: RegExp[] = [
  /sk-(?:ant-)?[A-Za-z0-9_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{30,}/g,
  /github_pat_[A-Za-z0-9_]{40,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /[sr]k_live_[A-Za-z0-9]{16,}/g,
  /npm_[A-Za-z0-9]{36}/g,
  /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
];

/** Keep the first four characters of anything that looks like a credential. */
export function maskSecrets(s: string): string {
  let out = s;
  for (const re of SECRET_RES) out = out.replace(re, (m) => `${m.slice(0, 4)}\u2026[masked]`);
  return out;
}

export function clip(s: string, max = 160): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : t.slice(0, max - 1) + "\u2026";
}

/** A short excerpt around `index`, secrets masked, at most 160 characters. */
export function excerptAt(line: string, index = 0): string {
  const masked = maskSecrets(line);
  const t = masked.trim();
  if (t.length <= 160) return clip(t);
  const start = Math.max(0, Math.min(index - 40, masked.length - 160));
  return clip(masked.slice(start, start + 200));
}

export function finding(
  f: Omit<AuditFinding, "source" | "excerpt"> & { excerpt?: string },
): AuditFinding {
  const out: AuditFinding = { ...f, source: "static" };
  if (f.excerpt !== undefined) out.excerpt = clip(maskSecrets(f.excerpt));
  else delete out.excerpt;
  if (f.line === undefined) delete out.line;
  return out;
}

export function isScript(f: SkillFile): boolean {
  return f.kind === "script";
}
export function isInstruction(f: SkillFile): boolean {
  return f.kind === "skill-md" || f.kind === "instruction";
}
export function isTextFile(f: SkillFile): boolean {
  return f.kind !== "binary" && f.text !== undefined;
}

const COMMENT_RE = /^\s*(#(?!!)|\/\/|\/\*|\*\s|\*$|--\s|REM\s|;)/;
export function isCommentLine(text: string): boolean {
  return COMMENT_RE.test(text);
}

export function* eachLine(file: SkillFile): Generator<LineInfo> {
  for (let i = 0; i < file.lines.length; i++) {
    yield { file, n: i + 1, text: file.lines[i] ?? "", fenced: file.fenced[i] ?? false };
  }
}

const BAD_EXAMPLE_RE =
  /\b(bad|avoid|don'?t|do not|never|unsafe|insecure|vulnerable|dangerous|malicious|attack(?:er|ers)?|injection|anti-?patterns?|wrong|red flags?|suspicious|exploit|forbidden|refuse|must not|e\.g\.|for example|such as|phrases like|look for|detect)\b|\u274C|\u2717|\u26A0/i;

/**
 * True when a line sits in a "this is an example of something bad" context: the line itself,
 * the three lines above it, the fence info string, or a recent heading says so, or it is a quotation.
 * Used to lower severity (never to hide) for skills that talk about attacks.
 */
export function inBadExampleContext(file: SkillFile, n: number): boolean {
  const i = n - 1;
  const text = file.lines[i] ?? "";
  if (/^\s*>/.test(text)) return true;
  if (BAD_EXAMPLE_RE.test(text)) return true;
  if (BAD_EXAMPLE_RE.test(file.fenceInfo[i] ?? "")) return true;
  let seen = 0;
  for (let j = i - 1; j >= 0 && seen < 3; j--) {
    const prev = file.lines[j] ?? "";
    if (prev.trim() === "") continue;
    seen++;
    if (BAD_EXAMPLE_RE.test(prev)) return true;
  }
  for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
    const prev = file.lines[j] ?? "";
    if (/^#{1,6}\s/.test(prev)) return BAD_EXAMPLE_RE.test(prev);
  }
  return false;
}

/** The sentence before `index` says not to do this. */
export function negatedBefore(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 80), index);
  const sentence = before.split(/[.!?;]\s/).pop() ?? before;
  return /\b(never|don'?t|do not|avoid|must not|should not|shouldn'?t|cannot|can'?t|refuse|forbid|flag|detect|warn)\b/i.test(
    sentence,
  );
}

export function runPatterns(ctx: Ctx, patterns: LinePattern[]): AuditFinding[] {
  const out: AuditFinding[] = [];
  for (const file of ctx.skill.files) {
    if (!isTextFile(file)) continue;
    const script = isScript(file);
    const instruction = isInstruction(file);
    for (const line of eachLine(file)) {
      if (line.text.length === 0) continue;
      const comment = script && isCommentLine(line.text);
      for (const p of patterns) {
        if (p.scope === "script" && !script) continue;
        if (p.scope === "instruction" && !instruction) continue;
        if (p.scope === "code" && !(script || (instruction && line.fenced))) continue;
        if (comment && !p.comments) continue;
        const m = p.re.exec(line.text);
        if (!m) continue;
        if (p.skip?.(line, m)) continue;
        let severity = p.severity;
        let why = p.why;
        if (p.quotable && instruction && inBadExampleContext(file, line.n)) {
          if (severity === "critical" || severity === "high") {
            severity = "medium";
            why += " (Lowered: this looks like a quoted or bad example, not an instruction.)";
          }
        }
        out.push(
          finding({
            rule: p.rule,
            severity,
            title: p.title,
            file: file.path,
            line: line.n,
            excerpt: excerptAt(line.text, m.index),
            why,
            fix: p.fix,
          }),
        );
      }
    }
  }
  return out;
}
