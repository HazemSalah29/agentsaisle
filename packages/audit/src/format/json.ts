import { AuditReport } from "@agentsaisle/registry-schema";

/** Pretty-printed JSON, validated against the shared schema so a bad report fails loudly. */
export function formatJson(reports: AuditReport | AuditReport[]): string {
  const list = Array.isArray(reports) ? reports : [reports];
  const parsed = list.map((r) => AuditReport.parse(r));
  return JSON.stringify(Array.isArray(reports) ? parsed : parsed[0], null, 2);
}
