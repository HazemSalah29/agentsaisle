import { AuditInputError, auditSkill, formatPretty } from "@agentsaisle/audit";
import type { AuditFinding } from "@agentsaisle/registry-schema";
import type { Context } from "./context.js";
import { CliError } from "./errors.js";
import { removeSymlinks } from "./github.js";

export interface GuardInput {
  /** Staged folder holding exactly the files that would be installed. */
  dir: string;
  name: string;
  version?: string;
  sha: string;
}

const list = (findings: AuditFinding[]) =>
  findings.map((f) => `  - ${f.rule} ${f.title} (${f.line ? `${f.file}:${f.line}` : f.file})`);

/**
 * Audit a staged skill before it is moved into place.
 * critical: blocked unless --force AND the name is typed (--yes never counts).
 * high: summary plus a confirmation (--yes answers it). Anything lower: one summary line.
 * Returns false when the user declined; throws when the install is blocked.
 * Symlinks are always stripped from the staged folder afterwards.
 */
export async function auditGuard(input: GuardInput, ctx: Context): Promise<boolean> {
  if (!ctx.audit) {
    ctx.warn(`Warning: skipping the security audit for "${input.name}" (--no-audit).`);
    await removeSymlinks(input.dir);
    return true;
  }

  let report;
  try {
    report = await auditSkill(input.dir, {
      skill: input.name,
      version: input.version,
      sha: input.sha,
      folderName: input.name,
    });
  } catch (e) {
    if (e instanceof AuditInputError) {
      throw new CliError(
        `The security audit could not run for "${input.name}": ${e.message} Nothing was installed. ` +
          `Use --no-audit to install without it.`,
      );
    }
    throw e;
  }

  const c = report.counts;
  const active = report.findings.filter((f) => !f.suppressed);
  const critical = active.filter((f) => f.severity === "critical");
  const high = active.filter((f) => f.severity === "high");

  try {
    if (c.critical > 0) {
      ctx.warn(`Security audit: "${input.name}" has ${c.critical} critical finding(s).`);
      ctx.warn(formatPretty({ ...report, findings: critical }));
      if (!ctx.force) {
        throw new CliError(
          `Blocked: "${input.name}" was not installed. To install it anyway, re-run with --force ` +
            `and type the skill name when asked (--yes does not bypass this).`,
        );
      }
      const ok = await ctx.typed(
        `Installing "${input.name}" despite critical findings.`,
        input.name,
      );
      if (!ok) throw new CliError(`The name did not match. Nothing was installed.`);
      ctx.warn(`Installing "${input.name}" despite critical findings (--force).`);
      return true;
    }

    if (c.high > 0) {
      ctx.warn(`Security audit: "${input.name}" has ${c.high} high-severity finding(s):`);
      for (const line of list(high)) ctx.warn(line);
      ctx.warn(`  Run "aisle audit ${input.name}" for details.`);
      if (!(await ctx.confirm(`Install "${input.name}" anyway?`))) {
        ctx.log(`Skipped ${input.name}.`);
        return false;
      }
      return true;
    }

    const rest = c.medium + c.low;
    ctx.log(
      rest > 0
        ? `Security audit: grade ${report.grade}, ${c.medium} medium and ${c.low} low finding(s). Run "aisle audit ${input.name}" for details.`
        : `Security audit: grade ${report.grade}, no findings.`,
    );
    return true;
  } finally {
    await removeSymlinks(input.dir);
  }
}
