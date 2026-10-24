import type { AuditGrade, AuditSeverity } from "@agentsaisle/registry-schema";

// Safe for client components: no file access here (see lib/audit.ts for reading reports).
export const SEVERITIES: AuditSeverity[] = ["critical", "high", "medium", "low"];

export const severityLabel = (s: AuditSeverity) => s[0]!.toUpperCase() + s.slice(1);

export const GRADE_WORDS: Record<AuditGrade, string> = {
  A: "no findings above low",
  B: "medium findings only",
  C: "one or two high findings",
  D: "three or more high findings",
  F: "a critical finding",
};

export const AUDIT_RULES_URL =
  "https://github.com/HazemSalah29/agentsaisle/tree/main/packages/audit/src/rules";
