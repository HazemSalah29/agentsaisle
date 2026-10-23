import { compareSemver, type LockFile, type RegistryIndex } from "@agentsaisle/registry-schema";
import { lockfilePath } from "./agents.js";
import type { Context } from "./context.js";
import { CliError } from "./errors.js";
import { installMany } from "./install.js";
import { readLockfile } from "./lockfile.js";
import { loadRegistry } from "./registry.js";

export interface UpdatePlan {
  updates: Array<{ name: string; from: string; to: string }>;
  upToDate: string[];
  skipped: Array<{ name: string; reason: string }>;
}

const SEMVER = /^\d+\.\d+\.\d+/;

/**
 * Decide what `aisle update` would do. Only moves forward: a skill is updated when the registry's
 * latest version is newer than the locked one. Skills installed straight from GitHub (no registry
 * version) and skills that left the registry are reported, never touched.
 */
export function planUpdates(lock: LockFile, index: RegistryIndex, names: string[]): UpdatePlan {
  const plan: UpdatePlan = { updates: [], upToDate: [], skipped: [] };
  for (const name of names) {
    const entry = lock.skills[name];
    if (!entry) continue;
    const skill = index.skills.find((s) => s.name === name);
    if (entry.version.startsWith("git:") || !SEMVER.test(entry.version)) {
      plan.skipped.push({
        name,
        reason: "installed straight from GitHub; run aisle add again to change it",
      });
    } else if (!skill) {
      plan.skipped.push({ name, reason: "no longer in the registry" });
    } else if (compareSemver(skill.latest, entry.version) > 0) {
      plan.updates.push({ name, from: entry.version, to: skill.latest });
    } else {
      plan.upToDate.push(name);
    }
  }
  return plan;
}

/** Update one installed skill, or all of them, to the latest registry version. */
export async function updateSkills(name: string | undefined, ctx: Context): Promise<void> {
  const opts = { agent: ctx.agent, global: ctx.global, cwd: ctx.cwd };
  const lock = await readLockfile(lockfilePath(opts));
  const installed = Object.keys(lock.skills);

  if (name && !(name in lock.skills)) throw new CliError(`"${name}" is not installed.`);
  if (installed.length === 0) {
    ctx.log("No skills installed.");
    return;
  }

  const plan = planUpdates(lock, await loadRegistry(), name ? [name] : installed);
  for (const s of plan.skipped) ctx.warn(`Skipped ${s.name}: ${s.reason}.`);

  if (plan.updates.length === 0) {
    ctx.log(
      name
        ? `${name} is already up to date.`
        : plan.upToDate.length
          ? "Everything is up to date."
          : "Nothing to update.",
    );
    return;
  }

  for (const u of plan.updates) ctx.log(`${u.name}  ${u.from} -> ${u.to}`);
  if (ctx.dryRun) {
    ctx.log(
      `[dry-run] would update ${plan.updates.length} skill${plan.updates.length === 1 ? "" : "s"}.`,
    );
    return;
  }
  if (
    !(await ctx.confirm(
      `Update ${plan.updates.length} skill${plan.updates.length === 1 ? "" : "s"}?`,
    ))
  ) {
    ctx.log("Nothing updated.");
    return;
  }
  await installMany(
    plan.updates.map((u) => `${u.name}@${u.to}`),
    ctx,
    { overwrite: true },
  );
}
