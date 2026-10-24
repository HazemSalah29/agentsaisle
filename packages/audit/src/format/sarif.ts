import { createHash } from "node:crypto";
import type { AuditFinding, AuditReport, AuditSeverity } from "@agentsaisle/registry-schema";
import { RULES, ruleInfo } from "../catalog.js";

export interface SarifOptions {
  /** Tool version written to the log. */
  version?: string;
  /**
   * Path of each skill folder relative to the repository root, keyed by skill name. GitHub code
   * scanning needs repository-relative paths; without a prefix, paths are relative to the skill.
   */
  pathPrefix?: Record<string, string>;
}

const LEVEL: Record<AuditSeverity, "error" | "warning" | "note"> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "note",
  info: "note",
};
// GitHub ranks code scanning alerts by this number (0.1 to 10).
const SECURITY_SEVERITY: Record<AuditSeverity, string> = {
  critical: "9.5",
  high: "8.0",
  medium: "5.5",
  low: "3.0",
  info: "0.5",
};

const fingerprint = (skill: string, f: AuditFinding) =>
  createHash("sha256")
    .update([skill, f.rule, f.file, f.line ?? "", f.title, f.excerpt ?? ""].join("\n"))
    .digest("hex")
    .slice(0, 32);

const join = (prefix: string | undefined, file: string) =>
  prefix && prefix !== "." ? `${prefix.replace(/\/+$/, "")}/${file}` : file;

/** SARIF 2.1.0 log for GitHub code scanning (Security tab). One run, every skill's findings. */
export function formatSarif(
  reports: AuditReport | AuditReport[],
  options: SarifOptions = {},
): string {
  const list = Array.isArray(reports) ? reports : [reports];
  const used = new Set(list.flatMap((r) => r.findings.map((f) => f.rule)));
  const rules = RULES.filter((x) => used.has(x.id));
  // Rules not in the catalog (should not happen) still get an entry so ruleIndex stays valid.
  for (const id of used) if (!ruleInfo(id)) rules.push({ id, severity: "medium", title: id });
  const index = new Map(rules.map((x, i) => [x.id, i]));

  const results = list.flatMap((report) =>
    report.findings
      .filter((f) => f.severity !== "info")
      .map((f) => ({
        ruleId: f.rule,
        ruleIndex: index.get(f.rule) ?? 0,
        level: LEVEL[f.severity],
        message: {
          text: `${f.title}. Why: ${f.why} Fix: ${f.fix}${f.source === "deep" ? " (AI-assisted, may be wrong)" : ""}`,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: join(options.pathPrefix?.[report.skill], f.file),
                uriBaseId: "%SRCROOT%",
              },
              region: {
                startLine: f.line ?? 1,
                ...(f.excerpt ? { snippet: { text: f.excerpt } } : {}),
              },
            },
          },
        ],
        partialFingerprints: { "aisleAudit/v1": fingerprint(report.skill, f) },
        ...(f.suppressed
          ? { suppressions: [{ kind: "inSource", justification: f.suppressed.reason }] }
          : {}),
      })),
  );

  const log = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "aisle audit",
            version: options.version ?? list[0]?.auditVersion ?? "1.0.0",
            informationUri: "https://agentsaisle-vercel.vercel.app/audit",
            rules: rules.map((x) => ({
              id: x.id,
              name: x.id.replace("-", ""),
              shortDescription: { text: x.title },
              help: {
                text: `${x.title}. See https://agentsaisle-vercel.vercel.app/audit for what each rule checks.`,
              },
              defaultConfiguration: { level: LEVEL[x.severity] },
              properties: {
                tags: ["security", "agent-skill"],
                "security-severity": SECURITY_SEVERITY[x.severity],
              },
            })),
          },
        },
        results,
      },
    ],
  };
  return JSON.stringify(log, null, 2) + "\n";
}
