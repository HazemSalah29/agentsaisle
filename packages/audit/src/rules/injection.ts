import type { AuditFinding } from "@agentsaisle/registry-schema";
import type { LinePattern, Rule } from "../types.js";
import { eachLine, excerptAt, finding, isInstruction, runPatterns } from "../util.js";

const patterns: LinePattern[] = [
  {
    rule: "AA-I01",
    severity: "high",
    title: "Instruction override language",
    why: "Text that tells the agent to drop its earlier instructions is how prompt injection takes over an agent.",
    fix: "Remove the override; a skill should add instructions, not cancel the user's or the system's.",
    scope: "instruction",
    quotable: true,
    re: /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|the\s+|your\s+)*(?:previous|prior|above|earlier|preceding|system|safety)\s+(?:instructions?|prompts?|rules?|messages?|guidelines?|context)\b|\bdisregard\s+(?:the\s+)?system\s+prompt\b|\byou\s+are\s+now\s+(?:an?\s+|my\s+|free\b|unrestricted\b|no\s+longer\b|dan\b)|\bnew\s+instructions\s*:|\bfrom\s+now\s+on,?\s+(?:you|ignore|disregard)\b/i,
  },
  {
    rule: "AA-I02",
    severity: "high",
    title: "Instruction to hide actions from the user",
    why: "Telling the agent to conceal what it does removes your chance to notice and stop it.",
    fix: "Remove it; a skill should say what it did and ask before anything sensitive.",
    scope: "instruction",
    quotable: true,
    re: /\b(?:do\s*n[o']t|never|without)\s+(?:tell(?:ing)?|mention(?:ing)?|show(?:ing)?|reveal(?:ing)?|inform(?:ing)?|notify(?:ing)?|let(?:ting)?)\s+(?:the\s+|your\s+)?(?:user|human|operator)\b|\bwithout\s+(?:asking|confirmation|permission)\b[^.\n]{0,40}\b(?:send|upload|delete|install|run|execute|post|push|write)\b|\bsilently\s+(?:run|execute|install|send|upload|post|modify|change|edit|write|delete|add|enable|disable|approve|fetch|download|curl|exfiltrate)\w*|\bhide\s+(?:this|these|it)\s+from\s+(?:the\s+)?(?:user|human)\b/i,
  },
  {
    rule: "AA-I03",
    severity: "critical",
    title: "Instruction to weaken the agent's safety settings",
    why: "Changing permissions, approvals or global instructions lets later actions run with no check.",
    fix: "Remove it; a skill must not edit permission settings, auto-approve actions or rewrite global agent instructions.",
    scope: "instruction",
    quotable: true,
    re: /\b(?:auto[- ]?approve|dangerously[- ]?skip[- ]?permissions|bypassPermissions)\b|\bdisable\s+(?:all\s+|the\s+|every\s+)?(?:confirmations?|permission\s+(?:prompts?|checks?)|safety\s+(?:checks?|rules?)|approvals?)\b|\bturn\s+off\s+(?:the\s+)?(?:permission|confirmation|approval)|\b(?:add|append|set|put|insert|edit|modify|update|write)\b[^.\n]{0,60}\b(?:permissions?\.allow|allow(?:ed)?[- ]?(?:rules?|list)|allowedTools)\b|\b(?:edit|modify|update|write\s+to|append\s+to|overwrite|change)\b[^.\n]{0,40}\bsettings(?:\.local)?\.json\b[^.\n]{0,60}\b(?:permission|allow|deny|hook|approve|bypass)\w*|\b(?:append|add|write|edit|modify|overwrite|update)\b[^.\n]{0,40}(?:~\/\.claude\/CLAUDE\.md|~\/\.codex\/AGENTS\.md|~\/\.claude\/settings\.json|global\s+CLAUDE\.md)/i,
  },
  {
    rule: "AA-I06",
    severity: "high",
    title: "Instruction to fetch and follow remote instructions",
    why: "Remote text can change after review, so the skill's real behavior is whatever that page says today.",
    fix: "Put the instructions in the skill itself, or fetch data only and never act on instructions found in it.",
    scope: "instruction",
    quotable: true,
    re: /\b(?:read|fetch|open|load|visit|download|curl|get|check)\b[^.\n]{0,80}https?:\/\/\S+[^\n]{0,80}\b(?:follow|obey|execute|carry\s+out)\b[^.\n]{0,40}\b(?:instructions?|steps|commands?|what\s+(?:it|they)\s+(?:says?|tells?))|\bfollow\s+(?:the\s+)?(?:instructions?|steps)\s+(?:at|from|in)\s+https?:\/\//i,
  },
];

const HTML_COMMENT_CUES =
  /\b(?:ignore|you\s+must|you\s+should|always|never|do\s+not|don't|run|execute|send|fetch|upload|delete|override|assistant|agent|claude|system\s+prompt|secret)\b/i;
const COMMENT_BENIGN =
  /^\s*(?:include\s*:|TODO|FIXME|NOTE\b|lint|prettier|eslint|markdownlint|vale|cspell|generated|prettier-ignore|toc|end)/i;

const hiddenInstructions: Rule = (ctx) => {
  const out: AuditFinding[] = [];
  for (const f of ctx.skill.files) {
    if (!isInstruction(f) || f.text === undefined) continue;
    const text = f.text;
    const lineOf = (idx: number) => text.slice(0, idx).split(/\r\n|\n|\r/).length;
    const push = (idx: number, what: string, snippet: string) =>
      out.push(
        finding({
          rule: "AA-I04",
          severity: "medium",
          title: `Instructions hidden in ${what}`,
          file: f.path,
          line: lineOf(idx),
          excerpt: excerptAt(snippet.replace(/\s+/g, " ")),
          why: "Readers of the rendered page do not see this text, but the agent reads it.",
          fix: "Move the text into the visible body of the file, or delete it.",
        }),
      );
    for (const m of text.matchAll(/<!--([\s\S]*?)-->/g)) {
      const body = m[1] ?? "";
      if (body.trim().length < 20 || COMMENT_BENIGN.test(body)) continue;
      if (HTML_COMMENT_CUES.test(body)) push(m.index ?? 0, "an HTML comment", body);
    }
    for (const m of text.matchAll(/<details(?![^>]*\bopen\b)[^>]*>([\s\S]*?)<\/details>/gi)) {
      const body = (m[1] ?? "").replace(/<summary[\s\S]*?<\/summary>/i, "");
      if (HTML_COMMENT_CUES.test(body) && !/^\s*```/m.test(body)) {
        push(m.index ?? 0, "a collapsed <details> block", body);
      }
    }
    for (const m of text.matchAll(/!\[([^\]]{60,})\]\(/g)) {
      if (HTML_COMMENT_CUES.test(m[1] ?? "")) push(m.index ?? 0, "image alt text", m[1] ?? "");
    }
  }
  return out;
};

const encodedBlobs: Rule = (ctx) => {
  const out: AuditFinding[] = [];
  for (const f of ctx.skill.files) {
    if (!isInstruction(f)) continue;
    for (const line of eachLine(f)) {
      // Markdown image data URIs are covered by size rules, not here.
      const m = /[A-Za-z0-9+/]{200,}={0,2}|\b[0-9a-fA-F]{128,}\b/.exec(line.text);
      if (!m) continue;
      out.push(
        finding({
          rule: "AA-I05",
          severity: "medium",
          title: "Long encoded blob in an instruction file",
          file: f.path,
          line: line.n,
          excerpt: excerptAt(line.text, m.index),
          why: "Encoded text cannot be read in review but a model may decode and follow it.",
          fix: "Replace it with plain text, or move genuine data to a clearly named asset file.",
        }),
      );
    }
  }
  return out;
};

export const injectionRules: Rule[] = [
  (ctx) => runPatterns(ctx, patterns),
  hiddenInstructions,
  encodedBlobs,
];
