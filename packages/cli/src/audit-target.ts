import { existsSync } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { RegistryIndex } from "@agentsaisle/registry-schema";
import { CliError } from "./errors.js";
import { downloadSkill, resolveRef } from "./github.js";
import { resolveSkill } from "./registry.js";
import { parseSpec } from "./spec.js";

export interface AuditTarget {
  /** Folder to audit (a skill, or a folder holding several). */
  dir: string;
  /** Report metadata for the single skill this target names (registry installs). */
  meta: { skill?: string; version?: string; sha?: string; folderName?: string };
  label: string;
  /** Remove any temp download. Safe to call more than once. */
  cleanup(): Promise<void>;
}

/** `./x`, `../x`, `/abs`, `~/x` or `C:\x`. A bare `name` is always a registry name. */
export const isPathLike = (input: string) =>
  /^(\.{1,2}([\\/]|$)|[\\/]|~([\\/]|$)|[A-Za-z]:[\\/])/.test(input);

const expandHome = (p: string) =>
  p === "~" || /^~[\\/]/.test(p) ? path.join(os.homedir(), p.slice(1)) : p;

export async function resolveAuditTarget(
  input: string,
  getIndex: () => Promise<RegistryIndex>,
  env = process.env,
): Promise<AuditTarget> {
  if (isPathLike(input)) {
    const dir = path.resolve(expandHome(input));
    if (!existsSync(dir) || !(await stat(dir)).isDirectory()) {
      throw new CliError(`Not a folder: ${input}`, 2);
    }
    return { dir, meta: {}, label: input, cleanup: async () => {} };
  }

  const spec = parseSpec(input);
  let source: { repo: string; sha: string; path: string };
  let meta: AuditTarget["meta"];
  let leaf: string;
  let label: string;
  if (spec.kind === "registry") {
    const { skill, version, sha } = resolveSkill(await getIndex(), spec.name, spec.version);
    source = { repo: skill.repo, sha, path: skill.path };
    meta = { skill: skill.name, version, sha, folderName: skill.name };
    leaf = skill.name;
    label = `${skill.name}@${version}`;
  } else {
    const sha = await resolveRef(spec.repo, spec.ref, env);
    source = { repo: spec.repo, sha, path: spec.path };
    leaf = spec.path ? path.posix.basename(spec.path) : spec.repo.split("/")[1]!;
    meta = { sha, folderName: spec.path ? leaf : undefined };
    label = `${spec.repo}${spec.path ? "/" + spec.path : ""}@${sha.slice(0, 7)}`;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "aisle-audit-"));
  const cleanup = () => rm(tmp, { recursive: true, force: true });
  try {
    const dir = path.join(tmp, leaf);
    // Everything is fetched (README, evals, symlinks) because the audit looks at all of it.
    await downloadSkill(source, dir, env, { keepAll: true, links: "keep" });
    return { dir, meta, label, cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
