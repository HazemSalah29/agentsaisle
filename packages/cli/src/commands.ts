import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { lockfilePath, targetDir } from "./agents.js";
import type { Context } from "./context.js";
import { CliError } from "./errors.js";
import { readLockfile, removeLockEntry } from "./lockfile.js";
import { partsOf } from "./library.js";
import { findSkill, loadRegistry } from "./registry.js";
import { compareSemver } from "@agentsaisle/registry-schema";
import { SKILL_NAME_RE } from "@agentsaisle/registry-schema";

export async function removeSkill(name: string, ctx: Context): Promise<void> {
  if (!SKILL_NAME_RE.test(name)) throw new CliError(`Invalid skill name "${name}".`);
  const opts = { agent: ctx.agent, global: ctx.global, cwd: ctx.cwd };
  const lock = lockfilePath(opts);
  const locked = (await readLockfile(lock)).skills;
  // A library (for example `video`) takes its installed parts with it. Offline, only the named skill is removed.
  const index = await loadRegistry().catch(() => undefined);
  const parts = partsOf(index, name).filter((p) => p in locked || existsSync(targetDir(p, opts)));
  const names = [...parts, name];
  const dir = targetDir(name, opts);
  if (!existsSync(dir) && !(name in locked)) throw new CliError(`"${name}" is not installed.`);

  if (ctx.dryRun) {
    for (const n of names)
      ctx.log(`[dry-run] would remove ${targetDir(n, opts)} and its lockfile entry`);
    return;
  }
  const what = parts.length ? `${name} and its ${parts.length} parts` : targetDir(name, opts);
  if (!(await ctx.confirm(`Remove ${what}?`))) {
    ctx.log(`Kept ${name}.`);
    return;
  }
  for (const n of names) {
    await rm(targetDir(n, opts), { recursive: true, force: true });
    await removeLockEntry(lock, n);
  }
  ctx.log(parts.length ? `Removed ${name} and ${parts.length} parts.` : `Removed ${name}.`);
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
  const hidden = new Set<string>();
  for (const name of names)
    if (index) for (const p of partsOf(index, name)) if (p in skills) hidden.add(p);
  for (const name of names) {
    if (hidden.has(name)) continue;
    const entry = skills[name]!;
    const latest = index?.skills.find((s) => s.name === name)?.latest;
    const notes: string[] = [];
    const n = partsOf(index, name).filter((p) => p in skills).length;
    if (n) notes.push(`+${n} parts`);
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
  if (skill.requires?.length)
    ctx.log(`Includes:  ${skill.requires.length} parts (${skill.requires.join(", ")})`);
  if (skill.partOf)
    ctx.log(`Part of:   ${skill.partOf} (install that one: aisle add ${skill.partOf})`);
  if (skill.runsScripts)
    ctx.warn("\nWarning: this skill runs scripts. Read them before installing.");
  if (!skill.verified) ctx.warn("Warning: not verified by Agents Aisle.");
  ctx.log();
  ctx.log(`Install:   aisle add ${skill.name}`);
}
