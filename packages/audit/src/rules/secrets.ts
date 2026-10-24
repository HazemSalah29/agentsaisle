import type { AuditFinding } from "@agentsaisle/registry-schema";
import type { Rule } from "../types.js";
import { eachLine, excerptAt, finding, isTextFile } from "../util.js";

const KEY_PATTERNS: { re: RegExp; name: string }[] = [
  { re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/, name: "API key (sk-)" },
  { re: /\bgh[pousr]_[A-Za-z0-9]{30,}/, name: "GitHub token" },
  { re: /\bgithub_pat_[A-Za-z0-9_]{40,}/, name: "GitHub token" },
  { re: /\bAKIA[0-9A-Z]{16}\b/, name: "AWS access key ID" },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/, name: "Slack token" },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, name: "Google API key" },
  { re: /\b[sr]k_live_[A-Za-z0-9]{16,}/, name: "Stripe live key" },
  { re: /\bnpm_[A-Za-z0-9]{36}\b/, name: "npm token" },
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/, name: "JWT" },
];
const PLACEHOLDER = /EXAMPLE|PLACEHOLDER|YOUR[_-]|xxxx|\.\.\.|<[^>]+>|REDACTED|DUMMY|FAKE/i;

const secrets: Rule = (ctx) => {
  const out: AuditFinding[] = [];
  const mk = (file: string, n: number, name: string, line: string, idx: number) =>
    finding({
      rule: "AA-K01",
      severity: "high",
      title: `Hardcoded secret: ${name}`,
      file,
      line: n,
      excerpt: excerptAt(line, idx),
      why: "A credential stored in a skill is public to everyone who installs it and cannot be taken back.",
      fix: "Remove it, rotate the credential, and read it from an environment variable instead.",
    });
  for (const f of ctx.skill.files) {
    if (!isTextFile(f)) continue;
    for (const line of eachLine(f)) {
      for (const { re, name } of KEY_PATTERNS) {
        const m = re.exec(line.text);
        if (m && !PLACEHOLDER.test(m[0])) {
          out.push(mk(f.path, line.n, name, line.text, m.index));
          break;
        }
      }
      // A private key header only counts when key material follows it.
      if (/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/.test(line.text)) {
        const body = f.lines
          .slice(line.n, line.n + 3)
          .some((l) => /^[A-Za-z0-9+/=]{40,}$/.test(l.trim()));
        if (body) out.push(mk(f.path, line.n, "private key", line.text, 0));
      }
    }
  }
  return out;
};

export const secretRules: Rule[] = [secrets];
