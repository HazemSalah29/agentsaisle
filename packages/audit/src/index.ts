import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  splitFrontmatter,
  type AuditFinding,
  type AuditReport,
} from "@agentsaisle/registry-schema";
import { parse } from "yaml";
import { loadSkill, AuditInputError, LIMITS, type LoadOptions } from "./load.js";
import { allRules } from "./rules/index.js";
import { countFindings, gradeFor } from "./score.js";
import { applySuppressions } from "./suppress.js";
import type { Ctx, Frontmatter } from "./types.js";
import { SEVERITY_ORDER } from "./util.js";

export const AUDIT_VERSION = "1.0.0";
export const DISCLAIMER_CLEAN =
  "Automated checks found no known risky patterns. This is not a guarantee of safety.";
export const DISCLAIMER_FOUND =
  "Automated checks found the patterns listed here. An audit reduces risk; it is not a guarantee of safety.";

export interface AuditOptions extends LoadOptions {
  /** Folder name SKILL.md's name should match (default: the folder's own name). */
  folderName?: string;
  /** Registry metadata copied into the report. */
  skill?: string;
  version?: string;
  sha?: string;
  /** For tests: a fixed timestamp. */
  now?: Date;
}

function parseFrontmatter(text: string | undefined): Frontmatter {
  if (text === undefined) return { present: false };
  const parts = splitFrontmatter(text.replace(/^\uFEFF/, ""));
  if (!parts) return { present: false };
  try {
    const data = parse(parts.frontmatter) as unknown;
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return { present: true, error: "frontmatter is not a YAML mapping" };
    }
    return { present: true, data: data as Record<string, unknown> };
  } catch (e) {
    return { present: true, error: (e as Error).message.split("\n")[0] };
  }
}

function sortFindings(list: AuditFinding[]): AuditFinding[] {
  return [...list].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.rule.localeCompare(b.rule),
  );
}

function dedupe(list: AuditFinding[]): AuditFinding[] {
  const seen = new Set<string>();
  return list.filter((f) => {
    const key = `${f.rule}|${f.file}|${f.line ?? ""}|${f.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Audit one skill folder. Reads files as text; nothing in the folder is imported or run. */
export async function auditSkill(folder: string, options: AuditOptions = {}): Promise<AuditReport> {
  const skill = await loadSkill(folder, options);
  const md = skill.files.find((f) => f.path === "SKILL.md");
  const frontmatter = parseFrontmatter(md?.text);
  const ctx: Ctx = {
    skill,
    frontmatter,
    folderName: options.folderName ?? path.basename(skill.root),
    hasLockfile: skill.files.some((f) =>
      ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"].includes(
        path.posix.basename(f.path),
      ),
    ),
  };
  const raw = sortFindings(dedupe(allRules.flatMap((rule) => rule(ctx))));
  const findings = sortFindings(applySuppressions(raw, skill.suppressionFile));
  const counts = countFindings(findings);
  const grade = gradeFor(counts);
  const nameFromFm = typeof frontmatter.data?.name === "string" ? frontmatter.data.name : undefined;
  const report: AuditReport = {
    skill: options.skill ?? nameFromFm ?? ctx.folderName,
    auditedAt: (options.now ?? new Date()).toISOString(),
    auditVersion: AUDIT_VERSION,
    files: skill.files.length + skill.symlinks.length,
    bytes: skill.totalBytes,
    counts,
    grade,
    findings,
    disclaimer:
      counts.critical + counts.high + counts.medium + counts.low > 0
        ? DISCLAIMER_FOUND
        : DISCLAIMER_CLEAN,
  };
  if (options.version) report.version = options.version;
  if (options.sha) report.sha = options.sha;
  return report;
}

const SKIP_WALK = new Set([".git", "node_modules", "dist", ".next"]);

async function findSkillFolders(dir: string, depth: number, found: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && e.name === "SKILL.md")) {
    found.push(dir);
    return; // do not look inside a skill for nested skills
  }
  if (depth <= 0) return;
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.isDirectory() && !SKIP_WALK.has(e.name))
      await findSkillFolders(path.join(dir, e.name), depth - 1, found);
  }
}

/** Audit a folder that is a skill, or contains several skills (up to five levels down). */
export async function auditMany(
  folder: string,
  options: AuditOptions = {},
): Promise<AuditReport[]> {
  const found: string[] = [];
  try {
    await findSkillFolders(folder, 5, found);
  } catch {
    throw new AuditInputError(`Not a readable folder: ${folder}`);
  }
  if (found.length === 0) return [await auditSkill(folder, options)];
  const results: AuditReport[] = [];
  for (const dir of found)
    results.push(await auditSkill(dir, { ...options, folderName: undefined }));
  return results;
}

export { AuditInputError, LIMITS, loadSkill };
export { countFindings, gradeFor } from "./score.js";
export { applySuppressions } from "./suppress.js";
export { formatPretty } from "./format/pretty.js";
export { formatJson } from "./format/json.js";
export { allRules } from "./rules/index.js";
export type { LoadOptions } from "./load.js";
