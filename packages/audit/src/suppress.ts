import type { AuditFinding } from "@agentsaisle/registry-schema";
import { z } from "zod";
import { parse } from "yaml";
import { finding } from "./util.js";

const Entry = z.object({
  rule: z.string().regex(/^(?:AA-)?[A-Z]\d{2}$/, "rule must look like AA-N01"),
  path: z.string().min(1).optional(),
  reason: z.string().min(15, "reason must be at least 15 characters"),
});
const File = z.object({ ignore: z.array(Entry) });
type Entry = z.infer<typeof Entry>;

export const SUPPRESSION_FILE_NAME = ".aisleaudit.yaml";

function s08(severity: AuditFinding["severity"], title: string, why: string, excerpt?: string) {
  return finding({
    rule: "AA-S08",
    severity,
    title,
    file: SUPPRESSION_FILE_NAME,
    excerpt,
    why,
    fix: "Fix the file so every entry has a valid rule ID and a reason of at least 15 characters, and do not try to suppress critical findings.",
  });
}

function globToRegExp(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const body = esc
    .replace(/\*\*/g, "\uE000")
    .replace(/\*/g, "[^/]*")
    .replace(/\uE000/g, ".*");
  return new RegExp(`^${body}$`);
}

function matches(entry: Entry, f: AuditFinding): boolean {
  const id = entry.rule.startsWith("AA-") ? entry.rule : `AA-${entry.rule}`;
  if (id !== f.rule) return false;
  if (!entry.path) return true;
  const p = entry.path.replace(/^\.\//, "");
  return globToRegExp(p).test(f.file) || (p.endsWith("/") && f.file.startsWith(p));
}

/**
 * Apply .aisleaudit.yaml. Suppressed findings stay in the report, labeled with the reason.
 * Critical findings are never suppressed here; only a registry maintainer can mark them reviewed.
 * A broken file or a suppression that cannot take effect is reported as AA-S08, so it is stored
 * in the report and shown wherever the report is shown.
 */
export function applySuppressions(
  findings: AuditFinding[],
  source: string | undefined,
): AuditFinding[] {
  if (source === undefined) return findings;
  let entries: Entry[] = [];
  try {
    entries = File.parse(parse(source)).ignore;
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : (e as Error).message.split("\n")[0];
    return [
      ...findings,
      s08(
        "medium",
        "Suppression file is invalid and was ignored",
        "None of the suppressions in this file were applied, so every finding is still counted.",
        msg,
      ),
    ];
  }
  const extra: AuditFinding[] = [];
  const warned = new Set<string>();
  const out = findings.map((f) => {
    const entry = entries.find((e) => matches(e, f));
    if (!entry) return f;
    if (f.severity === "critical") {
      if (!warned.has(f.rule)) {
        warned.add(f.rule);
        extra.push(
          s08(
            "low",
            `${f.rule} is critical and cannot be suppressed by the skill author`,
            "The suppression has no effect; only a registry maintainer can mark a critical finding as reviewed.",
            `rule: ${f.rule}, reason: ${entry.reason}`,
          ),
        );
      }
      return f;
    }
    return { ...f, suppressed: { reason: entry.reason } };
  });
  return [...out, ...extra];
}
