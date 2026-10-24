import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AuditInputError,
  auditMany,
  auditSkill,
  formatJson,
  formatPretty,
  type AuditOptions,
} from "@agentsaisle/audit";
import type { AuditReport, AuditSeverity, RegistryIndex } from "@agentsaisle/registry-schema";
import { existsSync } from "node:fs";
import { resolveAuditTarget } from "./audit-target.js";
import { CliError } from "./errors.js";

export const FORMATS = ["pretty", "json", "sarif", "markdown"] as const;
export const FAIL_ON = ["critical", "high", "medium", "low", "none"] as const;
type FailOn = (typeof FAIL_ON)[number];

export interface AuditCliOptions {
  format?: string;
  failOn?: string;
  deep?: boolean;
  output?: string;
  quiet?: boolean;
}

export interface AuditIo {
  out(text: string): void;
  err(text: string): void;
}

const ORDER: AuditSeverity[] = ["critical", "high", "medium", "low", "info"];

/** True when any unsuppressed finding is at or above `threshold`. Suppressed findings are not in `counts`. */
export function exceeds(report: AuditReport, threshold: FailOn): boolean {
  if (threshold === "none") return false;
  const limit = ORDER.indexOf(threshold);
  return ORDER.some((s, i) => i <= limit && report.counts[s] > 0);
}

export function summaryLine(r: AuditReport): string {
  const c = r.counts;
  return `${r.skill}${r.version ? "@" + r.version : ""}  grade ${r.grade}  (${c.critical} critical, ${c.high} high, ${c.medium} medium, ${c.low} low)`;
}

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
  flag: string,
): T {
  const v = value ?? fallback;
  if (!(allowed as readonly string[]).includes(v)) {
    throw new CliError(`Invalid ${flag} "${v}". Use ${allowed.join(", ")}.`, 2);
  }
  return v as T;
}

/**
 * `aisle audit <target>`. Returns the exit code: 0 clean, 1 findings at or above --fail-on.
 * Anything that stops the audit from running throws a CliError with exit code 2.
 */
export async function runAudit(
  input: string,
  opts: AuditCliOptions,
  getIndex: () => Promise<RegistryIndex>,
  io: AuditIo = { out: (t) => console.log(t), err: (t) => console.error(t) },
  env = process.env,
): Promise<number> {
  const format = oneOf(opts.format, FORMATS, "pretty", "--format");
  const failOn = oneOf(opts.failOn, FAIL_ON, "high", "--fail-on");
  if (format === "sarif" || format === "markdown") {
    throw new CliError(
      `--format ${format} is not available yet (planned for a later release). Use pretty or json.`,
      2,
    );
  }
  if (opts.deep) {
    throw new CliError("--deep is not available yet (planned for a later release).", 2);
  }

  let reports: AuditReport[];
  const target = await resolveAuditTarget(input, getIndex, env).catch((e: unknown) => {
    if (e instanceof CliError) throw new CliError(e.message, 2);
    throw e;
  });
  try {
    const options: AuditOptions = { includeUninstalled: true };
    // A named skill (registry, or a single GitHub folder) is one report with its metadata attached.
    if (target.meta.skill || existsSync(path.join(target.dir, "SKILL.md"))) {
      reports = [await auditSkill(target.dir, { ...options, ...target.meta })];
    } else {
      reports = await auditMany(target.dir, options);
      if (target.meta.sha) for (const r of reports) r.sha = target.meta.sha;
    }
  } catch (e) {
    if (e instanceof AuditInputError) throw new CliError(e.message, 2);
    throw e;
  } finally {
    await target.cleanup();
  }

  const full =
    format === "json" ? formatJson(reports) : reports.map((r) => formatPretty(r)).join("\n\n");
  if (opts.output) {
    try {
      await mkdir(path.dirname(path.resolve(opts.output)), { recursive: true });
      await writeFile(opts.output, full + "\n");
    } catch (e) {
      throw new CliError(`Could not write ${opts.output} (${(e as Error).message}).`, 2);
    }
    io.err(`Report written to ${opts.output}`);
  }
  if (opts.quiet) {
    for (const r of reports) io.out(summaryLine(r));
  } else if (!opts.output) {
    io.out(full);
  } else {
    for (const r of reports) io.out(summaryLine(r));
  }
  return reports.some((r) => exceeds(r, failOn)) ? 1 : 0;
}
