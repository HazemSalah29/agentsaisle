import type { AuditFinding, AuditReport, AuditSeverity } from "@agentsaisle/registry-schema";
import { SEVERITY_ORDER } from "../util.js";

export interface MarkdownOptions {
  /** Show info-level inventory findings in the list (default: false; the inventory has its own section). */
  verbose?: boolean;
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const code = (s: string) => "`" + s.replace(/`/g, "'") + "`";

function entry(f: AuditFinding): string[] {
  const where = f.line ? `${f.file}:${f.line}` : f.file;
  const out = [
    `- **${f.rule}** ${f.title}${f.suppressed ? " _(suppressed)_" : ""}`,
    `  - ${code(where)}`,
  ];
  if (f.excerpt) out.push(`  - Excerpt: ${code(f.excerpt)}`);
  if (f.suppressed) out.push(`  - Suppressed by the author: ${f.suppressed.reason}`);
  out.push(`  - Why: ${f.why}`, `  - Fix: ${f.fix}`);
  if (f.source === "deep") out.push("  - AI-assisted, may be wrong");
  return out;
}

const list = (items: string[]) => (items.length ? items.map(code).join(", ") : "none");

/** One report as GitHub-flavored markdown, for PR comments and files. */
export function formatMarkdown(report: AuditReport, options: MarkdownOptions = {}): string {
  const c = report.counts;
  const name = `${report.skill}${report.version ? "@" + report.version : ""}`;
  const out: string[] = [
    `### Agent Aisle audit: ${name}, grade ${report.grade}`,
    "",
    "| Critical | High | Medium | Low | Info |",
    "| ---: | ---: | ---: | ---: | ---: |",
    `| ${c.critical} | ${c.high} | ${c.medium} | ${c.low} | ${c.info} |`,
    "",
    `${report.files} files, ${report.bytes} bytes. Audited ${report.auditedAt.slice(0, 10)} with audit rules ${report.auditVersion}.`,
    "",
  ];
  const shown = report.findings.filter((f) => options.verbose || f.severity !== "info");
  for (const sev of SEVERITY_ORDER as AuditSeverity[]) {
    const group = shown.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    const body = group.flatMap(entry);
    const title = `${sev[0]!.toUpperCase()}${sev.slice(1)} (${group.length})`;
    if (sev === "critical" || sev === "high") out.push(`#### ${title}`, "", ...body, "");
    else out.push(`<details><summary>${title}</summary>`, "", ...body, "", "</details>", "");
  }
  if (shown.length === 0) out.push("No findings.", "");
  if (report.inventory) {
    const inv = report.inventory;
    out.push(
      "#### What this skill can use",
      "",
      `- Tools: ${list(inv.tools)}`,
      `- Scripts: ${list(inv.scripts)}`,
      `- Domains: ${list(inv.domains)}`,
      "",
    );
  }
  out.push(`_${cell(report.disclaimer)}_`);
  return out.join("\n");
}

/** Several reports, one after another. */
export function formatMarkdownMany(reports: AuditReport[], options: MarkdownOptions = {}): string {
  return reports.map((r) => formatMarkdown(r, options)).join("\n\n---\n\n") + "\n";
}
