import type { AuditFinding, AuditReport } from "@agentsaisle/registry-schema";

export interface PrettyOptions {
  /** Show info-level inventory findings (default: false). */
  verbose?: boolean;
}

function line(f: AuditFinding): string[] {
  const where = f.line ? `${f.file}:${f.line}` : f.file;
  const head = `  ${f.severity.toUpperCase().padEnd(8)} ${f.rule}  ${f.title}`;
  const out = [head, `           ${where}`];
  if (f.excerpt) out.push(`           > ${f.excerpt}`);
  if (f.suppressed) out.push(`           suppressed: ${f.suppressed.reason}`);
  out.push(`           why: ${f.why}`, `           fix: ${f.fix}`);
  return out;
}

export function formatPretty(report: AuditReport, options: PrettyOptions = {}): string {
  const c = report.counts;
  const out: string[] = [];
  out.push(`${report.skill}${report.version ? "@" + report.version : ""}  grade ${report.grade}`);
  out.push(
    `  ${c.critical} critical, ${c.high} high, ${c.medium} medium, ${c.low} low  (${report.files} files, ${report.bytes} bytes)`,
  );
  const shown = report.findings.filter((f) => options.verbose || f.severity !== "info");
  if (shown.length > 0) out.push("");
  for (const f of shown) out.push(...line(f), "");
  out.push(report.disclaimer);
  return out.join("\n");
}
