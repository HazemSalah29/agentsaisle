import { SKILL_NAME_RE } from "@agentsaisle/registry-schema";
import type { AuditFinding } from "@agentsaisle/registry-schema";
import type { Rule } from "../types.js";
import { finding, isScript } from "../util.js";

const skillMdMissing: Rule = (ctx) => {
  const fm = ctx.frontmatter;
  const hasFile = ctx.skill.files.some((f) => f.path === "SKILL.md");
  if (!hasFile) {
    return [
      finding({
        rule: "AA-S01",
        severity: "high",
        title: "No SKILL.md found",
        file: "SKILL.md",
        why: "Without SKILL.md the folder is not a valid skill and its behavior cannot be reviewed.",
        fix: "Add a SKILL.md with name and description frontmatter at the skill root.",
      }),
    ];
  }
  if (!fm.present || fm.error || !fm.data) {
    return [
      finding({
        rule: "AA-S01",
        severity: "high",
        title: fm.present ? "SKILL.md frontmatter is invalid" : "SKILL.md has no frontmatter",
        file: "SKILL.md",
        line: 1,
        excerpt: fm.error,
        why: "Agents read frontmatter to decide when to load the skill; a missing or broken block hides what it is.",
        fix: "Start SKILL.md with a valid YAML block between --- lines containing name and description.",
      }),
    ];
  }
  return [];
};

const nameAndDescription: Rule = (ctx) => {
  const data = ctx.frontmatter.data;
  if (!data) return [];
  const out: AuditFinding[] = [];
  const mk = (title: string, excerpt?: string) =>
    finding({
      rule: "AA-S02",
      severity: "medium",
      title,
      file: "SKILL.md",
      line: 1,
      excerpt,
      why: "The name and description are what the agent and the user see; wrong values make the skill hard to identify.",
      fix: "Use a lowercase kebab-case name that matches the folder and a description of 1 to 1,024 characters.",
    });
  const name = data.name;
  if (typeof name !== "string" || name.length === 0) {
    out.push(mk("Frontmatter has no name"));
  } else {
    if (name.length > 64 || !SKILL_NAME_RE.test(name)) {
      out.push(mk("Skill name is not lowercase kebab-case (max 64 characters)", `name: ${name}`));
    }
    if (name !== ctx.folderName) {
      out.push(mk(`Skill name does not match its folder "${ctx.folderName}"`, `name: ${name}`));
    }
  }
  const desc = data.description;
  if (typeof desc !== "string" || desc.trim().length === 0) {
    out.push(mk("Frontmatter has no description"));
  } else if (desc.length > 1024) {
    out.push(mk(`Description is ${desc.length} characters (limit 1,024)`));
  }
  return out;
};

const symlinks: Rule = (ctx) =>
  ctx.skill.symlinks.map((s) =>
    finding({
      rule: "AA-S03",
      severity: "critical",
      title: s.escapes ? "Symlink points outside the skill folder" : "Symlink inside the skill",
      file: s.path,
      excerpt: `${s.path} -> ${s.target}`,
      why: "A symlink can make the agent read or overwrite files that are not part of the skill, such as your credentials.",
      fix: "Replace the symlink with a regular file or remove it.",
    }),
  );

const binaries: Rule = (ctx) =>
  ctx.skill.files
    .filter((f) => f.kind === "binary" && f.executable)
    .map((f) =>
      finding({
        rule: "AA-S04",
        severity: "high",
        title: "Executable or compiled file",
        file: f.path,
        why: "Compiled files cannot be read or reviewed, so there is no way to know what they do.",
        fix: "Ship readable source scripts instead of binaries, bytecode or libraries.",
      }),
    );

function entropy(s: string): number {
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

const minified: Rule = (ctx) => {
  const out: AuditFinding[] = [];
  for (const f of ctx.skill.files) {
    if (!isScript(f)) continue;
    for (let i = 0; i < f.lines.length; i++) {
      const line = f.lines[i] ?? "";
      const long = line.length > 1000;
      const dense = line.length > 200 && !/\s/.test(line.slice(0, 200)) && entropy(line) > 5.2;
      if (long || dense) {
        out.push(
          finding({
            rule: "AA-S05",
            severity: "medium",
            title: "Minified or obfuscated script",
            file: f.path,
            line: i + 1,
            excerpt: line.slice(0, 120),
            why: "Minified or high-entropy code cannot be reviewed by reading it.",
            fix: "Ship the readable source, with normal line lengths and no packed payloads.",
          }),
        );
        break;
      }
    }
  }
  return out;
};

const size: Rule = (ctx) => {
  const out: AuditFinding[] = [];
  const md = ctx.skill.files.find((f) => f.path === "SKILL.md");
  if (md && md.lines.length > 500) {
    out.push(
      finding({
        rule: "AA-S06",
        severity: "low",
        title: `SKILL.md is ${md.lines.length} lines (over 500)`,
        file: "SKILL.md",
        why: "Very long instruction files are hard to review and bury risky lines.",
        fix: "Move detail into references/ one level deep.",
      }),
    );
  }
  for (const f of ctx.skill.files) {
    if (/^references\/[^/]+\/.+/.test(f.path)) {
      out.push(
        finding({
          rule: "AA-S06",
          severity: "low",
          title: "References are nested more than one level",
          file: f.path,
          why: "Deeply nested references are easy to miss in a review.",
          fix: "Keep reference files directly inside references/.",
        }),
      );
    }
  }
  return out;
};

const hidden: Rule = (ctx) =>
  ctx.skill.hidden.map((h) =>
    finding({
      rule: "AA-S07",
      severity: "low",
      title: "Hidden file or folder",
      file: h,
      why: "Hidden entries are skipped by most file listings, so they are easy to overlook in a review.",
      fix: "Remove it, or rename it so it is visible. Only .aisleaudit.yaml may be hidden.",
    }),
  );

export const structureRules: Rule[] = [
  skillMdMissing,
  nameAndDescription,
  symlinks,
  binaries,
  minified,
  size,
  hidden,
];
