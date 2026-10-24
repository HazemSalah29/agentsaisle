/**
 * Audits for the registry build. Official skills are read from their local folder (offline);
 * community skills are downloaded at their pinned commit with the CLI's hardened extractor and
 * audited from a temp folder. Nothing in a downloaded skill is ever executed.
 * A failed download never fails the build: that skill simply has no report ("Not audited").
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { AUDIT_VERSION, auditSkill } from "@agentsaisle/audit";
import { AuditReport, type RegistrySkill } from "@agentsaisle/registry-schema";
import { downloadSkill, removeSymlinks, type SkillSource } from "../packages/cli/src/github";
import type { SkillAuditor } from "./build";

export type Downloader = (source: SkillSource, dest: string) => Promise<void>;

export interface AuditorOptions {
  rootDir: string;
  /** Where downloaded-skill reports are cached between builds (default: registry/.audit-cache). */
  cacheDir?: string;
  download?: Downloader;
  now?: Date;
  warn?: (message: string) => void;
}

const defaultDownload: Downloader = (source, dest) =>
  downloadSkill(source, dest, process.env, { keepAll: true, links: "keep" });

export function createAuditor(opts: AuditorOptions): SkillAuditor {
  const cacheDir = opts.cacheDir ?? path.join(opts.rootDir, ".audit-cache");
  const download = opts.download ?? defaultDownload;
  const warn = opts.warn ?? ((m: string) => console.warn(m));

  return async (skill: RegistrySkill) => {
    const latest = skill.versions.find((v) => v.version === skill.latest) ?? skill.versions[0]!;
    const meta = { skill: skill.name, version: skill.latest, sha: latest.sha, now: opts.now };
    if (skill.source === "official") {
      const dir = path.join(opts.rootDir, "official", skill.name);
      return auditSkill(dir, { ...meta, folderName: skill.name, includeUninstalled: true });
    }

    const cacheFile = path.join(
      cacheDir,
      `${skill.name}@${skill.latest}-${latest.sha.slice(0, 12)}-${AUDIT_VERSION}.json`,
    );
    if (existsSync(cacheFile)) {
      const cached = AuditReport.safeParse(JSON.parse(await readFile(cacheFile, "utf8")));
      if (cached.success) return cached.data;
    }
    const tmp = await mkdtemp(path.join(os.tmpdir(), "aisle-build-audit-"));
    try {
      const dest = path.join(tmp, skill.name);
      await download({ repo: skill.repo, sha: latest.sha, path: skill.path }, dest);
      const report = await auditSkill(dest, {
        ...meta,
        folderName: skill.name,
        includeUninstalled: true,
      });
      await removeSymlinks(dest);
      await mkdir(cacheDir, { recursive: true });
      await writeFile(cacheFile, JSON.stringify(report));
      return report;
    } catch (e) {
      warn(
        `warn: could not audit ${skill.name}@${skill.latest}: ${(e as Error).message.split("\n")[0]}`,
      );
      return undefined;
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  };
}

/** Write dist/audits/<name>@<version>.json, replacing whatever an earlier build left there. */
export async function writeReports(dir: string, reports: Map<string, AuditReport>): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const [key, report] of reports)
    await writeFile(path.join(dir, `${key}.json`), JSON.stringify(report, null, 2) + "\n");
}

export async function listReports(dir: string): Promise<string[]> {
  return (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).sort();
}
