import type { AuditFinding, AuditGrade, AuditReport } from "@agentsaisle/registry-schema";

export function countFindings(findings: AuditFinding[]): AuditReport["counts"] {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) if (!f.suppressed) counts[f.severity]++;
  return counts;
}

/** A = nothing above low, B = medium only, C = 1 to 2 high, D = 3+ high, F = any critical. */
export function gradeFor(counts: AuditReport["counts"]): AuditGrade {
  if (counts.critical > 0) return "F";
  if (counts.high >= 3) return "D";
  if (counts.high >= 1) return "C";
  if (counts.medium > 0) return "B";
  return "A";
}
