import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { lockfilePath, targetDir } from "./agents.js";
import type { Context } from "./context.js";
import { CliError } from "./errors.js";
import { readLockfile, removeLockEntry } from "./lockfile.js";
import { findSkill, loadRegistry } from "./registry.js";
import { compareSemver } from "@agentsaisle/registry-schema";
import { SKILL_NAME_RE } from "@agentsaisle/registry-schema";

export async function removeSkill(name: string, ctx: Context): Promise<void> {
  if (!SKILL_NAME_RE.test(name)) throw new CliError(`Invalid skill name "${name}".`);
  const opts = { agent: ctx.agent, global: ctx.global, cwd: ctx.cwd };
  const dir = targetDir(name, opts);
  const lock = lockfilePath(opts);
  const locked = name in (await readLockfile(lock)).skills;
  if (!existsSync(dir) && !locked) throw new CliError(`"${name}" is not installed.`);

  if (ctx.dryRun) {
    ctx.log(`[dry-run] would remove ${dir} and its lockfile entry`);
    return;
  }
  if (!(await ctx.confirm(`Remove ${dir}?`))) {
    ctx.log(`Kept ${name}.`);
    return;
  }
  await rm(dir, { recursive: true, force: true });
  await removeLockEntry(lock, name);
  ctx.log(`Removed ${name}.`);
}

export async function listSkills(ctx: Context): Promise<void> {
  const opts = { agent: ctx.agent, global: ctx.global, cwd: ctx.cwd };
  const { skills } = await readLockfile(lockfilePath(opts));
  const names = Object.keys(skills);
  if (names.length === 0) {
    ctx.log("No skills installed.");
    return;
  }
  const index = await loadRegistry().catch((e: unknown) => {
    ctx.warn(`Could not check for updates: ${(e as Error).message}`);
    return undefined;
  });
  for (const name of names) {
    const entry = skills[name]!;
    const latest = index?.skills.find((s) => s.name === name)?.latest;
    const notes: string[] = [];
    if (!existsSync(targetDir(name, opts))) notes.push("folder missing, reinstall");
    if (latest && compareSemver(latest, entry.version) > 0)
      notes.push(`update available: ${latest}`);
    ctx.log(`${name}  ${entry.version}${notes.length ? `  (${notes.join("; ")})` : ""}`);
  }
}

export async function showInfo(name: string, ctx: Context): Promise<void> {
  const skill = findSkill(await loadRegistry(), name);
  const versions = [...skill.versions].sort((a, b) => compareSemver(b.version, a.version));
  ctx.log(
    `${skill.name} ${skill.latest}  (${skill.source}${skill.verified ? ", verified" : ", unverified"})`,
  );
  ctx.log(skill.description);
  ctx.log();
  ctx.log(`Author:    ${skill.author}`);
  ctx.log(
    `Source:    https://github.com/${skill.repo}${skill.path ? "/tree/" + versions[0]!.sha + "/" + skill.path : ""}`,
  );
  ctx.log(`Category:  ${skill.category.join(", ")}`);
  ctx.log(`Clients:   ${skill.clients.join(", ")}`);
  ctx.log(`Versions:  ${versions.map((v) => v.version).join(", ")}`);
  if (skill.runsScripts)
    ctx.warn("\nWarning: this skill runs scripts. Read them before installing.");
  if (!skill.verified) ctx.warn("Warning: not verified by Agent Aisle.");
  ctx.log();
  ctx.log(`Install:   aisle add ${skill.name}`);
}
