import { LIMITS } from "@agentsaisle/audit";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
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

/** Extraction limits, the same numbers the audit loader enforces. */
export const EXTRACT_LIMITS = {
  maxArchiveBytes: LIMITS.maxTotalBytes,
  maxFiles: LIMITS.maxFiles,
  maxFileBytes: LIMITS.maxFileBytes,
  /** Guard against gzip bombs: bytes after decompression, whole archive. */
  maxUnpackedBytes: 256 * 1024 * 1024,
} as const;

export interface DownloadOptions {
  /** Keep files the CLI never installs (evals/, preview/, README.md); `aisle audit` wants everything. */
  keepAll?: boolean;
  /**
   * "skip" (default) drops symlinks. "keep" writes them (never followed) so the audit can report
   * them; the caller must remove them afterwards with `removeSymlinks`.
   */
  links?: "skip" | "keep";
}

const mb = (n: number) => `${n / 1024 / 1024} MB`;

/** Count bytes flowing through and fail once a limit is passed. */
function byteLimit(max: number, message: string): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      seen += chunk.length;
      if (seen > max) cb(new CliError(message));
      else cb(null, chunk);
    },
  });
}

/**
 * Download the tarball for `source.sha` and extract only `source.path/` into `destDir`.
 * Files are only written, never executed. Absolute paths, `..`, hardlinks and devices make the
 * download fail; so do archives over 20 MB, more than 2,000 files or any file over 2 MB.
 */
export async function downloadSkill(
  source: SkillSource,
  destDir: string,
  env = process.env,
  options: DownloadOptions = {},
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
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > EXTRACT_LIMITS.maxArchiveBytes) {
    throw new CliError(
      `The archive is larger than ${mb(EXTRACT_LIMITS.maxArchiveBytes)}; refusing it.`,
    );
  }

  const prefix = normalize(source.path);
  const keepLinks = options.links === "keep";
  let extracted = 0;
  let violation: string | undefined;
  const reject = (why: string) => {
    violation ??= why;
    return false;
  };
  await mkdir(destDir, { recursive: true });
  const extractor = tar.x({
    cwd: destDir,
    // Drop the "<repo>-<sha>/" folder, plus the skill's own path.
    strip: 1 + (prefix ? prefix.split("/").length : 0),
    filter: (entryPath, entry) => {
      if (violation) return false;
      const type = "type" in entry ? entry.type : "File";
      const raw = entryPath.split("\\").join("/");
      if (raw.startsWith("/") || /^[A-Za-z]:/.test(raw) || path.isAbsolute(entryPath)) {
        return reject(`an entry has an absolute path (${entryPath.slice(0, 80)})`);
      }
      const rel = normalize(entryPath).split("/").slice(1).join("/");
      if (rel.split("/").includes("..")) {
        return reject(`an entry escapes the folder with ".." (${entryPath.slice(0, 80)})`);
      }
      const inside = prefix === "" || rel === prefix || rel.startsWith(prefix + "/");
      if (!inside) return false;
      if (
        type === "Link" ||
        type === "BlockDevice" ||
        type === "CharacterDevice" ||
        type === "FIFO"
      ) {
        return reject(
          `an entry is a ${type === "Link" ? "hardlink" : "device or pipe"} (${rel.slice(0, 80)})`,
        );
      }
      if (type === "SymbolicLink") return keepLinks;
      if (type !== "File" && type !== "Directory") return false;
      if (!options.keepAll && isDevOnly(prefix ? rel.slice(prefix.length + 1) : rel)) return false;
      if (type === "File") {
        const size = "size" in entry ? Number(entry.size) : 0;
        if (size > EXTRACT_LIMITS.maxFileBytes) {
          return reject(`${rel.slice(0, 80)} is larger than ${mb(EXTRACT_LIMITS.maxFileBytes)}`);
        }
        if (++extracted > EXTRACT_LIMITS.maxFiles) {
          return reject(`the skill has more than ${EXTRACT_LIMITS.maxFiles} files`);
        }
      }
      return true;
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(res.body as never),
      byteLimit(
        EXTRACT_LIMITS.maxArchiveBytes,
        `The archive is larger than ${mb(EXTRACT_LIMITS.maxArchiveBytes)}; refusing it.`,
      ),
      createGunzip(),
      byteLimit(
        EXTRACT_LIMITS.maxUnpackedBytes,
        `The archive expands to more than ${mb(EXTRACT_LIMITS.maxUnpackedBytes)}; refusing it.`,
      ),
      extractor,
    );
  } catch (e) {
    if (e instanceof CliError) throw e;
    throw new CliError(`The downloaded archive could not be extracted (${(e as Error).message}).`);
  }
  if (violation) throw new CliError(`Refusing this archive: ${violation}.`);
  if (extracted === 0) {
    throw new CliError(
      `No files found at "${source.path || "/"}" in ${source.repo}@${source.sha.slice(0, 7)}.`,
    );
  }
}

/** Remove every symlink under `dir` (never following them). Returns the relative paths removed. */
export async function removeSymlinks(dir: string): Promise<string[]> {
  const removed: string[] = [];
  const walk = async (d: string): Promise<void> => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isSymbolicLink()) {
        await rm(abs, { force: true });
        removed.push(path.relative(dir, abs).split(path.sep).join("/"));
      } else if (e.isDirectory()) {
        await walk(abs);
      }
    }
  };
  await walk(dir);
  return removed;
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
