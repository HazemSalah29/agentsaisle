import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { createAuditor, writeReports } from "./audits";
import { writeBadges } from "./badges";
import { compileAll, IncludeError } from "./compile";
import {
  CommunityEntry,
  OfficialMeta,
  ProfilesFile,
  RegistryIndex,
  SkillFrontmatter,
  compareSemver,
  splitFrontmatter,
  type AuditReport,
  type RegistrySkill,
  type OfficialMeta as OfficialMetaType,
  AislesFile,
  ElsewhereFile,
  type Aisle,
  type ElsewhereEntry,
} from "@agentsaisle/registry-schema";

/** GitHub repo that hosts registry/official. */
const OFFICIAL_REPO = process.env.OFFICIAL_REPO ?? "HazemSalah29/agentsaisle";
const OFFICIAL_AUTHOR = "agentsaisle";

/** Returns the raw SKILL.md text for a repo path at a commit SHA. */
export type SkillFetcher = (repo: string, sha: string, skillPath: string) => Promise<string>;
/** Returns the commit SHA that an official skill version is pinned to. */
export type ShaResolver = (tag: string) => string | Promise<string>;

export const githubFetcher: SkillFetcher = async (repo, sha, skillPath) => {
  const url = `https://raw.githubusercontent.com/${repo}/${sha}/${skillPath}/SKILL.md`;
  const headers: Record<string, string> = {};
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
};

const FULL_SHA = /^[0-9a-f]{40}$/;

/** The commit a local git tag points at, or undefined when the tag isn't in this checkout. */
export function localTagSha(cwd: string, tag: string): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", `${tag}^{commit}`], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Every lightweight tag of a repository in as few requests as possible (100 tags per request),
 * as a map from tag name to commit SHA. A build resolves a dozen official skills, and one request
 * is much less likely to hit GitHub's rate limit on shared build machines than one per skill.
 * Annotated tags are left out (they point at a tag object, not a commit); callers fall back to
 * `remoteTagSha` for those. Returns an empty map when GitHub can't be reached.
 */
export async function fetchTagIndex(
  repo: string,
  opts: { fetch?: typeof fetch; token?: string } = {},
): Promise<Map<string, string>> {
  const doFetch = opts.fetch ?? fetch;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const index = new Map<string, string>();
  try {
    for (let page = 1; page <= 20; page++) {
      const res = await doFetch(
        `https://api.github.com/repos/${repo}/git/matching-refs/tags?per_page=100&page=${page}`,
        { headers },
      );
      if (!res.ok) break;
      const refs = (await res.json()) as Array<{
        ref?: string;
        object?: { sha?: string; type?: string };
      }>;
      for (const r of refs) {
        const sha = r.object?.sha;
        if (
          r.ref?.startsWith("refs/tags/") &&
          r.object?.type === "commit" &&
          sha &&
          FULL_SHA.test(sha)
        ) {
          index.set(r.ref.slice("refs/tags/".length), sha);
        }
      }
      if (refs.length < 100) break;
    }
  } catch {
    // keep whatever was read
  }
  return index;
}

/**
 * The commit a tag points at on GitHub. Needed where the checkout has no tags (Vercel clones
 * shallowly). Returns undefined when the tag doesn't exist or GitHub can't be reached.
 */
export async function remoteTagSha(
  repo: string,
  tag: string,
  opts: { fetch?: typeof fetch; token?: string } = {},
): Promise<string | undefined> {
  const doFetch = opts.fetch ?? fetch;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  try {
    const res = await doFetch(
      `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(tag)}`,
      {
        headers,
      },
    );
    if (!res.ok) return undefined;
    const { sha } = (await res.json()) as { sha?: unknown };
    return typeof sha === "string" && FULL_SHA.test(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve `<name>@<version>` to a commit: local tag first, then GitHub. If neither knows the tag,
 * `strict` (CI and Vercel) fails the build, because pinning a wrong commit would ship broken
 * installs; otherwise (local development) it pins HEAD and warns.
 */
export function createShaResolver(opts: {
  local: (tag: string) => string | undefined;
  remote: (tag: string) => Promise<string | undefined>;
  head: () => string;
  strict: boolean;
  warn?: (message: string) => void;
}): ShaResolver {
  return async (tag) => {
    const found = opts.local(tag) ?? (await opts.remote(tag));
    if (found) return found;
    if (opts.strict) {
      throw new Error(
        `Cannot resolve git tag "${tag}" locally or on GitHub. Push the tag (git push origin ${tag}) and build again.`,
      );
    }
    (opts.warn ?? console.warn)(`warn: no git tag "${tag}"; pinning to HEAD (local build only)`);
    return opts.head();
  };
}

export function gitShaResolver(
  cwd: string,
  strict = Boolean(process.env.CI || process.env.VERCEL),
): ShaResolver {
  let index: Promise<Map<string, string>> | undefined;
  return createShaResolver({
    local: (tag) => localTagSha(cwd, tag),
    // One request for all tags, then a per-tag lookup only for any it did not contain.
    remote: async (tag) => {
      index ??= fetchTagIndex(OFFICIAL_REPO, { token: process.env.GITHUB_TOKEN });
      return (
        (await index).get(tag) ??
        remoteTagSha(OFFICIAL_REPO, tag, { token: process.env.GITHUB_TOKEN })
      );
    },
    head: () =>
      execFileSync("git", ["rev-parse", "HEAD"], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    strict,
  });
}

function frontmatterOf(md: string, where: string): SkillFrontmatter {
  const parts = splitFrontmatter(md);
  if (!parts) throw new Error(`${where}: SKILL.md has no frontmatter`);
  const res = SkillFrontmatter.safeParse(parseYaml(parts.frontmatter));
  if (!res.success)
    throw new Error(`${where}: invalid SKILL.md frontmatter: ${formatIssues(res.error.issues)}`);
  return res.data;
}

async function listDirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function hasScriptsDir(dir: string): Promise<boolean> {
  return (await listDirs(dir)).includes("scripts");
}

type Issue = { path: PropertyKey[]; message: string };
type Parsed<T> = { success: true; data: T } | { success: false; error: { issues: Issue[] } };

const formatIssues = (issues: Issue[]) =>
  issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`).join("; ");

async function readYaml<T>(
  file: string,
  schema: { safeParse(v: unknown): Parsed<T> },
  label: string,
): Promise<T> {
  const res = schema.safeParse(parseYaml(await readFile(file, "utf8")));
  if (!res.success) throw new Error(`${label}: ${formatIssues(res.error.issues)}`);
  return res.data;
}

/** profiles.yaml is optional; when present every skill it names must exist. */
async function readProfiles(rootDir: string, names: Set<string>): Promise<Partial<ProfilesFile>> {
  const file = path.join(rootDir, "profiles.yaml");
  if (!existsSync(file)) return {};
  const label = "registry/profiles.yaml";
  const data = await readYaml(file, ProfilesFile, label).catch((e: Error) => {
    throw new Error(`Registry validation failed:\n- ${e.message}`);
  });
  const problems: string[] = [];
  const check = (skill: string, where: string) => {
    if (!names.has(skill)) problems.push(`${label}: ${where} references unknown skill "${skill}"`);
  };
  for (const p of data.profiles) p.skills.forEach((s) => check(s, `profile "${p.id}"`));
  for (const q of data.questions) {
    q.options.forEach((o) =>
      o.adds.forEach((s) => check(s, `question "${q.id}" option "${o.label}"`)),
    );
  }
  const ids = data.profiles.map((p) => p.id);
  ids
    .filter((id, i) => ids.indexOf(id) !== i)
    .forEach((id) => problems.push(`${label}: duplicate profile id "${id}"`));
  if (problems.length) throw new Error(`Registry validation failed:\n- ${problems.join("\n- ")}`);
  return data;
}

/** The house standard fields from skill.meta.yaml, converted to the index's camelCase. Only what is set. */
export function houseStandardFields(meta: OfficialMetaType): Partial<RegistrySkill> {
  return {
    ...(meta.niche ? { niche: meta.niche } : {}),
    ...(meta.kind ? { kind: meta.kind } : {}),
    ...(meta.tier ? { tier: meta.tier } : {}),
    ...(meta.tested
      ? {
          tested: {
            model: meta.tested.model,
            date: meta.tested.date,
            tasks: meta.tested.tasks,
            tokenSavingsMedian: meta.tested.token_savings_median,
            successRate: meta.tested.success_rate,
            baselineSuccessRate: meta.tested.baseline_success_rate,
            preferredInBlindTest: meta.tested.preferred_in_blind_test,
          },
        }
      : {}),
    ...(meta.permissions
      ? {
          permissions: {
            tools: meta.permissions.tools,
            writesFiles: meta.permissions.writes_files,
            runsScripts: meta.permissions.runs_scripts,
            network: meta.permissions.network,
            needsApiKeys: meta.permissions.needs_api_keys,
          },
        }
      : {}),
    ...(meta.demo
      ? {
          demo: {
            ...(meta.demo.url ? { url: meta.demo.url } : {}),
            screenshots: meta.demo.screenshots,
          },
        }
      : {}),
  };
}

/** aisles.yaml is optional. When present, ids are unique and each official niche sits in exactly one aisle. */
async function readAisles(
  rootDir: string,
  nicheOf: Map<string, string | undefined>,
): Promise<Aisle[]> {
  const file = path.join(rootDir, "aisles.yaml");
  if (!existsSync(file)) return [];
  const label = "registry/aisles.yaml";
  const data = await readYaml(file, AislesFile, label).catch((e: Error) => {
    throw new Error(`Registry validation failed:\n- ${e.message}`);
  });
  const problems: string[] = [];
  const ids = data.aisles.map((a) => a.id);
  ids
    .filter((id, i) => ids.indexOf(id) !== i)
    .forEach((id) => problems.push(`${label}: duplicate aisle id "${id}"`));
  const owner = new Map<string, string>();
  for (const a of data.aisles)
    for (const n of a.niches) {
      if (owner.has(n))
        problems.push(`${label}: niche "${n}" is in both "${owner.get(n)}" and "${a.id}"`);
      owner.set(n, a.id);
    }
  for (const [skill, niche] of nicheOf)
    if (niche && !owner.has(niche))
      problems.push(`registry/official/${skill}: niche "${niche}" is not in any aisle (${label})`);
  if (problems.length) throw new Error(`Registry validation failed:\n- ${problems.join("\n- ")}`);
  return data.aisles;
}

/** elsewhere.yaml is optional. Entries must point at a known aisle and be unique by repo and path. */
async function readElsewhere(rootDir: string, aisleIds: Set<string>): Promise<ElsewhereEntry[]> {
  const file = path.join(rootDir, "elsewhere.yaml");
  if (!existsSync(file)) return [];
  const label = "registry/elsewhere.yaml";
  const data = await readYaml(file, ElsewhereFile, label).catch((e: Error) => {
    throw new Error(`Registry validation failed:\n- ${e.message}`);
  });
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const e of data.entries) {
    if (!aisleIds.has(e.aisle))
      problems.push(`${label}: "${e.name}" uses unknown aisle "${e.aisle}"`);
    const key = `${e.repo}/${e.path}`.toLowerCase();
    if (seen.has(key))
      problems.push(`${label}: "${e.name}" duplicates ${e.repo}${e.path ? "/" + e.path : ""}`);
    seen.add(key);
  }
  if (problems.length) throw new Error(`Registry validation failed:\n- ${problems.join("\n- ")}`);
  return data.entries;
}

/** The text `aisle init` writes into CLAUDE.md or AGENTS.md, from registry/_shared/house-rules.md. */
async function readHouseRules(rootDir: string): Promise<string | undefined> {
  const file = path.join(rootDir, "_shared", "house-rules.md");
  return existsSync(file) ? (await readFile(file, "utf8")).trim() : undefined;
}

/** Audits the latest version of a skill. Returns undefined when it could not be audited. */
export type SkillAuditor = (skill: RegistrySkill) => Promise<AuditReport | undefined>;

export interface BuildOptions {
  rootDir: string;
  fetchSkill: SkillFetcher;
  resolveSha: ShaResolver;
  now?: Date;
  /** Optional: audit every skill and attach the grade to its registry entry. */
  audit?: SkillAuditor;
  /** Filled with each full report, keyed "<name>@<version>", for dist/audits. */
  reports?: Map<string, AuditReport>;
}

export async function buildRegistry(opts: BuildOptions): Promise<RegistryIndex> {
  const { rootDir, fetchSkill, resolveSha } = opts;
  const skills: RegistrySkill[] = [];
  const errors: string[] = [];

  // Generated SKILL.md files must match their SKILL.src.md, or installs would ship stale text.
  try {
    const compiled = await compileAll(
      path.join(rootDir, "official"),
      path.join(rootDir, "_shared"),
      "check",
    );
    for (const r of compiled.filter((c) => c.status === "stale")) {
      errors.push(
        `registry/official/${r.skill}: SKILL.md is out of date with SKILL.src.md. Run: pnpm skills:build`,
      );
    }
  } catch (e) {
    if (!(e instanceof IncludeError)) throw e;
    errors.push(e.message);
  }

  for (const name of await listDirs(path.join(rootDir, "official"))) {
    const dir = path.join(rootDir, "official", name);
    // A folder with neither SKILL.md nor skill.meta.yaml is a skill still being assembled; skip it.
    if (!existsSync(path.join(dir, "SKILL.md")) && !existsSync(path.join(dir, "skill.meta.yaml")))
      continue;
    const label = `registry/official/${name}`;
    try {
      const meta = await readYaml(path.join(dir, "skill.meta.yaml"), OfficialMeta, label);
      const fm = frontmatterOf(await readFile(path.join(dir, "SKILL.md"), "utf8"), label);
      if (fm.name !== name)
        throw new Error(`${label}: SKILL.md name "${fm.name}" must match folder "${name}"`);
      skills.push({
        name,
        description: fm.description,
        source: "official",
        author: OFFICIAL_AUTHOR,
        repo: OFFICIAL_REPO,
        path: `registry/official/${name}`,
        latest: meta.version,
        versions: [{ version: meta.version, sha: await resolveSha(`${name}@${meta.version}`) }],
        category: meta.category,
        clients: meta.clients,
        runsScripts: meta.runs_scripts || (await hasScriptsDir(dir)),
        verified: true,
        ...houseStandardFields(meta),
      });
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  const communityDir = path.join(rootDir, "community");
  const files = (await readdir(communityDir).catch(() => [] as string[])).filter((f) =>
    f.endsWith(".yaml"),
  );
  for (const file of files) {
    const label = `registry/community/${file}`;
    try {
      const entry = await readYaml(path.join(communityDir, file), CommunityEntry, label);
      if (`${entry.name}.yaml` !== file)
        throw new Error(`${label}: file name must be "${entry.name}.yaml"`);
      const versions = [...entry.versions].sort((a, b) => compareSemver(b.version, a.version));
      const latest = versions[0]!;
      const fm = frontmatterOf(await fetchSkill(entry.repo, latest.sha, entry.path), label);
      if (fm.name !== entry.name)
        throw new Error(
          `${label}: SKILL.md name "${fm.name}" must match entry name "${entry.name}"`,
        );
      skills.push({
        name: entry.name,
        description: fm.description,
        source: "community",
        author: entry.author,
        repo: entry.repo,
        path: entry.path,
        latest: latest.version,
        versions: versions.map(({ version, sha }) => ({ version, sha })),
        category: entry.category,
        clients: entry.clients,
        runsScripts: entry.runs_scripts,
        verified: entry.verified,
      });
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  if (opts.audit) {
    for (const skill of skills) {
      const report = await opts.audit(skill);
      if (!report) continue;
      skill.audit = {
        grade: report.grade,
        counts: report.counts,
        auditedAt: report.auditedAt,
        auditVersion: report.auditVersion,
      };
      opts.reports?.set(`${skill.name}@${skill.latest}`, report);
      // A critical finding in one of our own skills must never ship.
      if (skill.source === "official" && report.counts.critical > 0)
        errors.push(
          `registry/official/${skill.name}: audit found ${report.counts.critical} critical finding(s). Run: aisle audit ./registry/official/${skill.name}`,
        );
    }
  }

  const seen = new Set<string>();
  for (const s of skills) {
    if (seen.has(s.name)) errors.push(`duplicate skill name "${s.name}"`);
    seen.add(s.name);
  }
  if (errors.length) throw new Error(`Registry validation failed:\n- ${errors.join("\n- ")}`);

  skills.sort((a, b) => a.name.localeCompare(b.name));

  const profiles = await readProfiles(rootDir, new Set(skills.map((s) => s.name)));
  const aisles = await readAisles(
    rootDir,
    new Map(skills.filter((s) => s.source === "official").map((s) => [s.name, s.niche])),
  );
  const elsewhere = await readElsewhere(rootDir, new Set(aisles.map((a) => a.id)));
  const aisleIds = new Set(aisles.map((a) => a.id));
  const badKits = (profiles.profiles ?? []).filter((p) => p.aisle && !aisleIds.has(p.aisle));
  if (badKits.length)
    throw new Error(
      `Registry validation failed:\n- ${badKits
        .map((p) => `registry/profiles.yaml: profile "${p.id}" uses unknown aisle "${p.aisle}"`)
        .join("\n- ")}`,
    );
  return RegistryIndex.parse({
    generatedAt: (opts.now ?? new Date()).toISOString(),
    skills,
    ...profiles,
    aisles,
    elsewhere,
    houseRules: await readHouseRules(rootDir),
  });
}

async function main() {
  const rootDir = path.dirname(fileURLToPath(import.meta.url));
  const skipAudit = process.argv.includes("--no-audit") || process.env.AISLE_SKIP_AUDIT === "1";
  const reports = new Map<string, AuditReport>();
  const index = await buildRegistry({
    rootDir,
    fetchSkill: githubFetcher,
    resolveSha: gitShaResolver(rootDir),
    audit: skipAudit ? undefined : createAuditor({ rootDir }),
    reports,
  });
  const out = path.join(rootDir, "dist", "registry.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(index, null, 2) + "\n");
  await writeReports(path.join(rootDir, "dist", "audits"), reports);
  await writeBadges(path.join(rootDir, "dist", "badges"), index.skills);
  console.log(
    `registry: wrote ${index.skills.length} skills to ${path.relative(process.cwd(), out)}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
