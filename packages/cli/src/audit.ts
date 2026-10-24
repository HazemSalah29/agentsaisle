import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AuditInputError,
  auditSkill,
  formatJson,
  formatMarkdownMany,
  formatPretty,
  formatSarif,
  listSkillFolders,
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
  if (opts.deep) {
    throw new CliError("--deep is not available yet (planned for a later release).", 2);
  }

  let reports: AuditReport[];
  // Folder of each audited skill, so SARIF can use repository-relative paths.
  const folders = new Map<string, string>();
  const target = await resolveAuditTarget(input, getIndex, env).catch((e: unknown) => {
    if (e instanceof CliError) throw new CliError(e.message, 2);
    throw e;
  });
  try {
    const options: AuditOptions = { includeUninstalled: true };
    // A named skill (registry, or a single GitHub folder) is one report with its metadata attached.
    if (target.meta.skill || existsSync(path.join(target.dir, "SKILL.md"))) {
      const r = await auditSkill(target.dir, { ...options, ...target.meta });
      folders.set(r.skill, target.dir);
      reports = [r];
    } else {
      const dirs = await listSkillFolders(target.dir);
      reports = [];
      for (const dir of dirs.length ? dirs : [target.dir]) {
        const r = await auditSkill(dir, options);
        if (target.meta.sha) r.sha = target.meta.sha;
        folders.set(r.skill, dir);
        reports.push(r);
      }
    }
  } catch (e) {
    if (e instanceof AuditInputError) throw new CliError(e.message, 2);
    throw e;
  } finally {
    await target.cleanup();
  }

  // Repository-relative folders (from the working directory) for SARIF locations.
  const pathPrefix = Object.fromEntries(
    [...folders].map(([name, dir]) => [
      name,
      path.relative(process.cwd(), dir).split(path.sep).join("/"),
    ]),
  );
  const full =
    format === "json"
      ? formatJson(reports)
      : format === "sarif"
        ? formatSarif(reports, { pathPrefix }).trimEnd()
        : format === "markdown"
          ? formatMarkdownMany(reports).trimEnd()
          : reports.map((r) => formatPretty(r)).join("\n\n");
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
