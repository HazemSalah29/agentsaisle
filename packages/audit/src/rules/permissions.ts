import type { AuditFinding } from "@agentsaisle/registry-schema";
import type { Rule } from "../types.js";
import { eachLine, excerptAt, finding, isInstruction, isScript } from "../util.js";

/** Split `allowed-tools` into entries; patterns like `Bash(git diff *)` contain spaces. */
export function parseAllowedTools(value: unknown): string[] {
  const parts: string[] = [];
  const items = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    for (const m of item.matchAll(/[A-Za-z_][\w:.-]*(?:\([^)]*\))?/g)) parts.push(m[0]);
  }
  return parts;
}

function toolName(entry: string): string {
  return entry.replace(/\(.*$/, "");
}

const INTERPRETER_RE =
  /^Bash\(\s*(node|nodejs|python3?|sh|bash|zsh|ruby|perl|php|deno|bun|npx|pnpm dlx|yarn dlx|eval|xargs|env|sudo|powershell|pwsh)\b/i;

const allowedTools = (key: string, line = 1) => ({ file: "SKILL.md", line, key });

function fmLine(ctx: Parameters<Rule>[0], key: string): number {
  const md = ctx.skill.files.find((f) => f.path === "SKILL.md");
  const i = md?.lines.findIndex((l) => l.startsWith(`${key}:`)) ?? -1;
  return i >= 0 ? i + 1 : 1;
}

const unrestrictedBash: Rule = (ctx) => {
  const tools = parseAllowedTools(ctx.frontmatter.data?.["allowed-tools"]);
  const bad = tools.filter((t) => /^Bash(\(\s*(\*+|\*\s+\*|:\*)?\s*\))?$/.test(t));
  return bad.map((t) =>
    finding({
      rule: "AA-P01",
      severity: "high",
      title: "allowed-tools grants unrestricted Bash",
      ...allowedTools("allowed-tools", fmLine(ctx, "allowed-tools")),
      excerpt: t,
      why: "Unrestricted Bash lets the skill run any command on your machine without asking.",
      fix: 'Allow only the commands the skill needs, for example "Bash(git diff *)".',
    }),
  );
};

const writePlusShell: Rule = (ctx) => {
  const data = ctx.frontmatter.data;
  if (!data) return [];
  if (data["disable-model-invocation"] === true) return [];
  const tools = parseAllowedTools(data["allowed-tools"]);
  const names = tools.map(toolName);
  const writes = names.some((n) => n === "Write" || n === "Edit" || n === "MultiEdit");
  const broadShell = tools.some(
    (t) => /^Bash(\(\s*(\*+|\*\s+\*|:\*)?\s*\))?$/.test(t) || INTERPRETER_RE.test(t),
  );
  if (!writes || !broadShell) return [];
  return [
    finding({
      rule: "AA-P02",
      severity: "medium",
      title: "Can write files and run interpreters without disable-model-invocation",
      file: "SKILL.md",
      line: fmLine(ctx, "allowed-tools"),
      excerpt: tools.join(" "),
      why: "The agent may load this skill on its own and then write files and run code in one go.",
      fix: "Set disable-model-invocation: true so the user starts it, or narrow the Bash patterns.",
    }),
  ];
};

const hooks: Rule = (ctx) => {
  const data = ctx.frontmatter.data;
  if (!data || data.hooks === undefined) return [];
  return [
    finding({
      rule: "AA-P03",
      severity: "high",
      title: "Frontmatter defines hooks",
      file: "SKILL.md",
      line: fmLine(ctx, "hooks"),
      why: "Hooks run commands automatically on agent events, with no further prompt.",
      fix: "Remove the hooks block, or document each command and have the user add it deliberately.",
    }),
  ];
};

// Verified against the Claude Code skills docs (code.claude.com/docs/en/skills, 2026-10-24): inline
// !`command` (only recognized at the start of a line or after whitespace) and a fenced block opened
// with ```!. Matching is deliberately looser than the docs (any position), so near-misses still show up.
const DYNAMIC_INLINE = /!`[^`\n]+`/;
const DYNAMIC_FENCE = /^\s*`{3,}!/;

const dynamicInjection: Rule = (ctx) => {
  const out: AuditFinding[] = [];
  for (const f of ctx.skill.files) {
    if (f.kind !== "skill-md") continue;
    for (const line of eachLine(f)) {
      const m = DYNAMIC_INLINE.exec(line.text);
      if (m || DYNAMIC_FENCE.test(line.text)) {
        out.push(
          finding({
            rule: "AA-P04",
            severity: "high",
            title: "Command runs when the skill loads",
            file: f.path,
            line: line.n,
            excerpt: excerptAt(line.text, m?.index ?? 0),
            why: "Commands in this syntax run as soon as the skill is loaded, before the agent or you can review them.",
            fix: "Have the agent run the command as a visible step instead, or remove it.",
          }),
        );
      }
    }
  }
  return out;
};

const webPlusFiles: Rule = (ctx) => {
  const tools = parseAllowedTools(ctx.frontmatter.data?.["allowed-tools"]);
  const web = tools.some((t) => t === "WebFetch" || /^Bash\(\s*(curl|wget)\b/i.test(t));
  const read = tools.some((t) => ["Read", "Grep", "Glob"].includes(toolName(t)));
  if (!web || !read) return [];
  return [
    finding({
      rule: "AA-P05",
      severity: "medium",
      title: "Unrestricted web access combined with file reading",
      file: "SKILL.md",
      line: fmLine(ctx, "allowed-tools"),
      excerpt: tools.join(" "),
      why: "A skill that can read your files and call any URL can send file contents out.",
      fix: 'Limit web access to named domains, for example "WebFetch(domain:docs.example.com)".',
    }),
  ];
};

const URL_RE = /https?:\/\/[^\s)>"'`\]]+/g;

const inventory: Rule = (ctx) => {
  const out: AuditFinding[] = [];
  const tools = parseAllowedTools(ctx.frontmatter.data?.["allowed-tools"]);
  const scripts = ctx.skill.files.filter(isScript).map((f) => f.path);
  const urls = new Set<string>();
  for (const f of ctx.skill.files) {
    if (f.text === undefined || !(isScript(f) || isInstruction(f))) continue;
    for (const m of f.text.matchAll(URL_RE)) urls.add(m[0].replace(/[.,;:]+$/, ""));
  }
  const mk = (what: string, items: string[]) =>
    finding({
      rule: "AA-P06",
      severity: "info",
      title: `Inventory: ${items.length} ${what}`,
      file: "SKILL.md",
      excerpt: items.join(", ") || "none",
      why: "Lists what the skill can use, so you can compare it with what the skill claims to do.",
      fix: "Nothing to fix; remove anything the skill does not need.",
    });
  out.push(mk(tools.length === 1 ? "tool" : "tools", tools));
  out.push(mk(scripts.length === 1 ? "script" : "scripts", scripts));
  out.push(mk(urls.size === 1 ? "URL" : "URLs", [...urls].sort()));
  return out;
};

export const permissionRules: Rule[] = [
  unrestrictedBash,
  writePlusShell,
  hooks,
  dynamicInjection,
  webPlusFiles,
  inventory,
];
