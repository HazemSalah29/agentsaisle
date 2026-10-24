/**
 * Which community entries a pull request touches. Shared by the validator and the audit.
 * Files come from, in order: command-line arguments, the CHANGED_FILES env var, or a git diff
 * against BASE_REF (default origin/main).
 */
import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const registryDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.dirname(registryDir);
export const COMMUNITY = "registry/community";

export const esc = (s: string, prop = false) => {
  const base = s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  return prop ? base.replace(/:/g, "%3A").replace(/,/g, "%2C") : base;
};

export function changedFiles(args: string[]): string[] {
  if (args.length) return args;
  if (process.env.CHANGED_FILES?.trim()) return process.env.CHANGED_FILES.trim().split(/\s+/);
  const base = process.env.BASE_REF ?? "origin/main";
  try {
    return execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`, "--", COMMUNITY],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    )
      .split("\n")
      .filter(Boolean);
  } catch {
    console.warn(`Could not diff against ${base}; checking every community entry instead.`);
    return [];
  }
}

export async function allCommunityFiles(): Promise<string[]> {
  const dir = path.join(registryDir, "community");
  return (await readdir(dir).catch(() => [] as string[])).map((f) => `${COMMUNITY}/${f}`);
}

/** Repository-relative community entry paths to check for this run. */
export async function selectCommunityFiles(args: string[]): Promise<string[]> {
  let files = changedFiles(args)
    .map((f) => path.relative(repoRoot, path.resolve(repoRoot, f)).split(path.sep).join("/"))
    .filter((f) => f.startsWith(`${COMMUNITY}/`));
  if (
    files.length === 0 &&
    args.length === 0 &&
    !process.env.CHANGED_FILES &&
    !process.env.GITHUB_ACTIONS
  )
    files = await allCommunityFiles();
  return files;
}
