import { cp, mkdtemp, rename, rm } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { lockfilePath, targetDir } from "./agents.js";
import type { Context } from "./context.js";
import { CliError } from "./errors.js";
import { downloadSkill, resolveRef, type SkillSource } from "./github.js";
import { upsertLockEntry } from "./lockfile.js";
import { loadRegistry, resolveSkill } from "./registry.js";
import { parseSpec } from "./spec.js";
import { findScripts, validateSkill } from "./validate.js";
import { existsSync } from "node:fs";
import type { RegistryIndex } from "@agentsaisle/registry-schema";

interface Plan {
  /** Expected SKILL.md name (registry installs) or undefined (direct GitHub installs). */
  name?: string;
  version?: string;
  source: SkillSource;
  runsScripts: boolean;
  unverified: boolean;
  /** Official and verified: a maintainer read every script, so scripts are listed but not asked about. */
  trusted: boolean;
  label: string;
}

async function plan(input: string, getIndex: () => Promise<RegistryIndex>): Promise<Plan> {
  const spec = parseSpec(input);
  if (spec.kind === "registry") {
    const { skill, version, sha } = resolveSkill(await getIndex(), spec.name, spec.version);
    return {
      name: skill.name,
      version,
      source: { repo: skill.repo, sha, path: skill.path },
      runsScripts: skill.runsScripts,
      unverified: !skill.verified,
      trusted: skill.source === "official" && skill.verified,
      label: `${skill.name}@${version}`,
    };
  }
  const sha = await resolveRef(spec.repo, spec.ref);
  return {
    source: { repo: spec.repo, sha, path: spec.path },
    runsScripts: false,
    unverified: true,
    trusted: false,
    label: `${spec.repo}${spec.path ? "/" + spec.path : ""}@${sha.slice(0, 7)}`,
  };
}

/** Move a directory, falling back to copy + delete across devices. */
async function moveDir(from: string, to: string): Promise<void> {
  await mkdir(path.dirname(to), { recursive: true });
  try {
    await rename(from, to);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw e;
    await cp(from, to, { recursive: true });
    await rm(from, { recursive: true, force: true });
  }
}

export interface InstallOptions {
  /** Replace an existing folder without asking (used by `aisle update`). */
  overwrite?: boolean;
}

export async function installOne(
  input: string,
  ctx: Context,
  getIndex: () => Promise<RegistryIndex>,
  options: InstallOptions = {},
): Promise<void> {
  const p = await plan(input, getIndex);
  const opts = { agent: ctx.agent, global: ctx.global, cwd: ctx.cwd };

  if (p.unverified) {
    ctx.warn(
      p.name
        ? `Warning: ${p.label} is community-submitted and has not been verified by Agent Aisle.`
        : `Warning: ${p.label} is installed straight from GitHub and is unverified. Read it before you use it.`,
    );
  }

  if (ctx.dryRun) {
    const to = p.name
      ? targetDir(p.name, opts)
      : path.join(path.dirname(targetDir("x", opts)), "<skill name>");
    ctx.log(`[dry-run] would install ${p.label}`);
    ctx.log(
      `  from ${p.source.repo} @ ${p.source.sha}${p.source.path ? ` (${p.source.path})` : ""}`,
    );
    ctx.log(`  to   ${to}`);
    if (p.runsScripts) ctx.log("  note: this skill is marked as running scripts");
    return;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "aisle-"));
  try {
    const staged = path.join(tmp, "skill");
    await downloadSkill(p.source, staged);
    const fm = await validateSkill(staged, p.name);
    const name = fm.name;

    const scripts = await findScripts(staged);
    if (scripts.length > 0 || p.runsScripts) {
      if (p.trusted) {
        // Verified official skills: show what is included, but don't make every install a question.
        ctx.log(`${name} includes scripts (reviewed by Agent Aisle):`);
        for (const s of scripts) ctx.log(`  - ${s}`);
      } else {
        ctx.warn(`Warning: "${name}" includes scripts that your agent may run:`);
        for (const s of scripts) ctx.warn(`  - ${s}`);
        if (scripts.length === 0) ctx.warn("  (marked as running scripts in the registry)");
        if (!(await ctx.confirm(`Install "${name}" anyway?`))) {
          ctx.log(`Skipped ${name}.`);
          return;
        }
      }
    }

    const dest = targetDir(name, opts);
    let backup: string | undefined;
    if (existsSync(dest)) {
      if (!options.overwrite && !(await ctx.confirm(`${dest} already exists. Overwrite?`))) {
        ctx.log(`Skipped ${name}.`);
        return;
      }
      backup = path.join(tmp, "previous");
      await moveDir(dest, backup);
    }
    try {
      await moveDir(staged, dest);
      await upsertLockEntry(lockfilePath(opts), {
        name,
        version: p.version ?? `git:${p.source.sha.slice(0, 7)}`,
        repo: p.source.repo,
        path: p.source.path,
        sha: p.source.sha,
        installedAt: new Date().toISOString(),
      });
    } catch (e) {
      await rm(dest, { recursive: true, force: true });
      if (backup) await moveDir(backup, dest);
      throw e;
    }

    ctx.log(`Installed ${name}@${p.version ?? p.source.sha.slice(0, 7)}`);
    ctx.log(`  to ${dest}`);
    if (ctx.agent === "claude-code") ctx.log(`  try it: /${name}`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

export async function installMany(
  inputs: string[],
  ctx: Context,
  options: InstallOptions = {},
): Promise<void> {
  let index: Promise<RegistryIndex> | undefined;
  const getIndex = () => (index ??= loadRegistry());
  const failures: string[] = [];
  for (const input of inputs) {
    try {
      await installOne(input, ctx, getIndex, options);
    } catch (e) {
      if (!(e instanceof CliError)) throw e;
      console.error(`Error (${input}): ${e.message}`);
      failures.push(input);
    }
  }
  if (failures.length)
    throw new CliError(`${failures.length} of ${inputs.length} installs failed.`);
}
