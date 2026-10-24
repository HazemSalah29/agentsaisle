import { isCancel, select } from "@clack/prompts";
import type { Profile, RegistryIndex } from "@agentsaisle/registry-schema";
import type { Context } from "./context.js";
import { CliError } from "./errors.js";
import { installMany } from "./install.js";
import { loadRegistry } from "./registry.js";
import { installRules } from "./rules.js";
import { closestMatches } from "./spec.js";

export function resolveProfile(index: RegistryIndex, id: string): Profile {
  const profile = index.profiles.find((p) => p.id === id);
  if (profile) return profile;
  const near = closestMatches(
    id,
    index.profiles.map((p) => p.id),
  );
  const available = index.profiles.map((p) => p.id).join(", ");
  throw new CliError(
    `Unknown profile "${id}".` +
      (near.length ? ` Did you mean: ${near.join(", ")}?` : "") +
      ` Available: ${available}.`,
  );
}

export interface InitOptions {
  profile?: string;
  /** False with --no-rules. */
  rules?: boolean;
  rulesOnly?: boolean;
}

/**
 * `aisle init`: install a starter bundle (with --profile it never asks which) and write the house
 * rules block. `--no-rules` skips the block; `--rules-only` skips the bundle.
 */
export async function initProfile(opts: InitOptions, ctx: Context): Promise<void> {
  const wantRules = opts.rules !== false;
  if (opts.rulesOnly && !wantRules)
    throw new CliError("--rules-only and --no-rules can't be used together.");

  const index = await loadRegistry();
  // Check everything up front so nothing is installed before a problem is found.
  if (wantRules && !index.houseRules)
    throw new CliError("This registry has no house rules yet. Use --no-rules to skip them.");

  if (!opts.rulesOnly) {
    if (index.profiles.length === 0) throw new CliError("This registry has no profiles yet.");

    let id = opts.profile;
    if (!id) {
      if (!process.stdin.isTTY) {
        throw new CliError(
          `Pass --profile <id> when not running in a terminal. Available: ${index.profiles.map((p) => p.id).join(", ")}.`,
        );
      }
      const picked = await select({
        message: "Pick a profile",
        options: index.profiles.map((p) => ({ value: p.id, label: p.name, hint: p.description })),
      });
      if (isCancel(picked)) throw new CliError("Cancelled.");
      id = picked;
    }

    const profile = resolveProfile(index, id);
    const known = new Set(index.skills.map((s) => s.name));
    const missing = profile.skills.filter((s) => !known.has(s));
    if (missing.length) {
      throw new CliError(
        `Profile "${profile.id}" lists skills that are not in the registry: ${missing.join(", ")}.`,
      );
    }

    ctx.log(`${profile.name}: ${profile.description}`);
    ctx.log(`Skills: ${profile.skills.join(", ")}`);
    ctx.log();
    if (!ctx.dryRun && !(await ctx.confirm(`Install these ${profile.skills.length} skills?`))) {
      ctx.log("Nothing installed.");
      return;
    }
    await installMany(profile.skills, ctx);
  }

  if (wantRules) {
    if (!opts.rulesOnly) ctx.log();
    await installRules(index.houseRules!, ctx);
  }
}
