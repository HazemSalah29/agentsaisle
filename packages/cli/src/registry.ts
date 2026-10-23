import { RegistryIndex, compareSemver, type RegistrySkill } from "@agentsaisle/registry-schema";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CliError } from "./errors.js";
import { closestMatches } from "./spec.js";

/**
 * The live registry. This is the project's .vercel.app address, which keeps working after a custom
 * domain is added, so published CLI versions never break. Override with AISLE_REGISTRY.
 */
export const DEFAULT_REGISTRY_URL = "https://agentsaisle-vercel.vercel.app/registry.json";
const CACHE_TTL_MS = 10 * 60 * 1000;

export function cacheDir(): string {
  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
      "aisle",
    );
  }
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Caches", "aisle");
  return path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"), "aisle");
}

function parseIndex(text: string, source: string): RegistryIndex {
  try {
    return RegistryIndex.parse(JSON.parse(text));
  } catch {
    throw new CliError(`Registry at ${source} is not valid. Try again later.`);
  }
}

/** `AISLE_REGISTRY` (file path or URL) overrides the default; local files skip the cache. */
export async function loadRegistry(env = process.env): Promise<RegistryIndex> {
  const source = env.AISLE_REGISTRY ?? DEFAULT_REGISTRY_URL;
  if (!/^https?:\/\//.test(source)) {
    try {
      return parseIndex(await readFile(source, "utf8"), source);
    } catch (e) {
      if (e instanceof CliError) throw e;
      throw new CliError(`Cannot read registry file ${source}.`);
    }
  }

  const cacheFile = path.join(cacheDir(), "registry.json");
  try {
    const age = Date.now() - (await stat(cacheFile)).mtimeMs;
    if (age < CACHE_TTL_MS) return parseIndex(await readFile(cacheFile, "utf8"), cacheFile);
  } catch {
    // no usable cache; fetch
  }

  let text: string;
  try {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (e) {
    throw new CliError(`Could not fetch the registry from ${source} (${(e as Error).message}).`);
  }
  const index = parseIndex(text, source);
  await mkdir(path.dirname(cacheFile), { recursive: true })
    .then(() => writeFile(cacheFile, text))
    .catch(() => {});
  return index;
}

export interface Resolved {
  skill: RegistrySkill;
  version: string;
  sha: string;
}

export function findSkill(index: RegistryIndex, name: string): RegistrySkill {
  const skill = index.skills.find((s) => s.name === name);
  if (skill) return skill;
  const near = closestMatches(
    name,
    index.skills.map((s) => s.name),
  );
  throw new CliError(
    `Unknown skill "${name}".` + (near.length ? ` Did you mean: ${near.join(", ")}?` : ""),
  );
}

/** No version means latest. */
export function resolveSkill(index: RegistryIndex, name: string, version?: string): Resolved {
  const skill = findSkill(index, name);
  const wanted = version ?? skill.latest;
  const entry = skill.versions.find((v) => v.version === wanted);
  if (!entry) {
    const all = [...skill.versions]
      .map((v) => v.version)
      .sort(compareSemver)
      .reverse();
    throw new CliError(`"${name}" has no version ${wanted}. Available: ${all.join(", ")}.`);
  }
  return { skill, version: entry.version, sha: entry.sha };
}
