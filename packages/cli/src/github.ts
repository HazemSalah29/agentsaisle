import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import { CliError } from "./errors.js";

const CODELOAD = "https://codeload.github.com";
const API = "https://api.github.com";

export interface SkillSource {
  repo: string;
  sha: string;
  /** Folder inside the repo that contains SKILL.md ("" for the repo root). */
  path: string;
}

const normalize = (p: string) => p.split("\\").join("/").replace(/^\.\//, "").replace(/\/+$/, "");

/**
 * Files that belong to a skill's development, not to the agent: benchmark tasks, generated
 * previews, the human README (all at the skill's top level) and the include source of SKILL.md.
 * `inner` is a path relative to the skill folder.
 */
export function isDevOnly(inner: string): boolean {
  const top = inner.split("/")[0];
  return top === "evals" || top === "preview" || inner === "README.md" || inner === "SKILL.src.md";
}

/**
 * Download the tarball for `source.sha` and extract only `source.path/` into `destDir`.
 * Files are only written, never executed. Links and unsafe entries are skipped.
 */
export async function downloadSkill(
  source: SkillSource,
  destDir: string,
  env = process.env,
): Promise<void> {
  const base = (env.AISLE_CODELOAD_URL ?? CODELOAD).replace(/\/$/, "");
  const url = `${base}/${source.repo}/tar.gz/${source.sha}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new CliError(
      `Could not download ${source.repo}@${source.sha.slice(0, 7)} (${(e as Error).message}).`,
    );
  }
  if (!res.ok || !res.body) {
    throw new CliError(
      `Could not download ${source.repo}@${source.sha.slice(0, 7)} (HTTP ${res.status}). ` +
        `Check that the repository is public and the commit exists.`,
    );
  }

  const prefix = normalize(source.path);
  let extracted = 0;
  await mkdir(destDir, { recursive: true });
  const extractor = tar.x({
    cwd: destDir,
    // Drop the "<repo>-<sha>/" folder, plus the skill's own path.
    strip: 1 + (prefix ? prefix.split("/").length : 0),
    filter: (entryPath, entry) => {
      const type = "type" in entry ? entry.type : "File";
      if (type !== "File" && type !== "Directory") return false; // no symlinks, hardlinks, devices
      const rel = normalize(entryPath).split("/").slice(1).join("/");
      if (rel.split("/").includes("..") || path.isAbsolute(rel)) return false;
      const inside = prefix === "" || rel === prefix || rel.startsWith(prefix + "/");
      if (!inside) return false;
      if (isDevOnly(prefix ? rel.slice(prefix.length + 1) : rel)) return false;
      if (type === "File") extracted++;
      return true;
    },
  });
  try {
    await pipeline(Readable.fromWeb(res.body as never), extractor);
  } catch (e) {
    throw new CliError(`The downloaded archive could not be extracted (${(e as Error).message}).`);
  }
  if (extracted === 0) {
    throw new CliError(
      `No files found at "${source.path || "/"}" in ${source.repo}@${source.sha.slice(0, 7)}.`,
    );
  }
}

/** Resolve a branch, tag or "HEAD" to a full commit SHA via the GitHub API. */
export async function resolveRef(
  repo: string,
  ref: string | undefined,
  env = process.env,
): Promise<string> {
  const base = (env.AISLE_GITHUB_API_URL ?? API).replace(/\/$/, "");
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const res = await fetch(`${base}/repos/${repo}/commits/${encodeURIComponent(ref ?? "HEAD")}`, {
    headers,
  });
  if (!res.ok) {
    throw new CliError(`Could not resolve ${repo}@${ref ?? "HEAD"} (HTTP ${res.status}).`);
  }
  const { sha } = (await res.json()) as { sha?: string };
  if (!sha || !/^[0-9a-f]{40}$/.test(sha))
    throw new CliError(`GitHub returned an unexpected response for ${repo}.`);
  return sha;
}
