import { readFileSync } from "node:fs";
import path from "node:path";
import { AuditReport } from "@agentsaisle/registry-schema";

/**
 * The stored audit report of a skill version, copied from registry/dist/audits to public/audits by
 * scripts/copy-registry.mts. Any problem (missing file, bad JSON, old shape) means "no report":
 * the page shows "Not audited yet" and the build never fails.
 */
export function getAuditReport(name: string, version: string): AuditReport | undefined {
  try {
    const file = path.join(process.cwd(), "public", "audits", `${name}@${version}.json`);
    const parsed = AuditReport.safeParse(JSON.parse(readFileSync(file, "utf8")));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
