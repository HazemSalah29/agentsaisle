import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  CommunityEntry,
  OfficialMeta,
  RegistryIndex,
  SkillFrontmatter,
  compareSemver,
  splitFrontmatter,
  type RegistrySkill,
} from "@agentsaisle/registry-schema";

/** TODO(confirm): GitHub repo that hosts registry/official. */
const OFFICIAL_REPO = process.env.OFFICIAL_REPO ?? "agentsaisle/agent-aisle";
const OFFICIAL_AUTHOR = "agentsaisle";

/** Returns the raw SKILL.md text for a repo path at a commit SHA. */
export type SkillFetcher = (repo: string, sha: string, skillPath: string) => Promise<string>;
/** Returns the commit SHA for a git tag, or the current HEAD when no tag exists. */
export type ShaResolver = (tag: string) => string;

export const githubFetcher: SkillFetcher = async (repo, sha, skillPath) => {
  const url = `https://raw.githubusercontent.com/${repo}/${sha}/${skillPath}/SKILL.md`;
  const headers: Record<string, string> = {};
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
};

export function gitShaResolver(cwd: string): ShaResolver {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  return (tag) => {
    try {
      return git("rev-parse", `${tag}^{commit}`);
    } catch {
      console.warn(`warn: no git tag "${tag}"; pinning to HEAD`);
      return git("rev-parse", "HEAD");
    }
  };
}

function frontmatterOf(md: string, where: string): SkillFrontmatter {
  const parts = splitFrontmatter(md);
  if (!parts) throw new Error(`${where}: SKILL.md has no frontmatter`);
  const res = SkillFrontmatter.safeParse(parseYaml(parts.frontmatter));
  if (!res.success) throw new Error(`${where}: invalid SKILL.md frontmatter: ${formatIssues(res.error.issues)}`);
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

async function readYaml<T>(file: string, schema: { safeParse(v: unknown): Parsed<T> }, label: string): Promise<T> {
  const res = schema.safeParse(parseYaml(await readFile(file, "utf8")));
  if (!res.success) throw new Error(`${label}: ${formatIssues(res.error.issues)}`);
  return res.data;
}

export interface BuildOptions {
  rootDir: string;
  fetchSkill: SkillFetcher;
  resolveSha: ShaResolver;
  now?: Date;
}

export async function buildRegistry(opts: BuildOptions): Promise<RegistryIndex> {
  const { rootDir, fetchSkill, resolveSha } = opts;
  const skills: RegistrySkill[] = [];
  const errors: string[] = [];

  for (const name of await listDirs(path.join(rootDir, "official"))) {
    const dir = path.join(rootDir, "official", name);
    const label = `registry/official/${name}`;
    try {
      const meta = await readYaml(path.join(dir, "skill.meta.yaml"), OfficialMeta, label);
      const fm = frontmatterOf(await readFile(path.join(dir, "SKILL.md"), "utf8"), label);
      if (fm.name !== name) throw new Error(`${label}: SKILL.md name "${fm.name}" must match folder "${name}"`);
      skills.push({
        name,
        description: fm.description,
        source: "official",
        author: OFFICIAL_AUTHOR,
        repo: OFFICIAL_REPO,
        path: `registry/official/${name}`,
        latest: meta.version,
        versions: [{ version: meta.version, sha: resolveSha(`${name}@${meta.version}`) }],
        category: meta.category,
        clients: meta.clients,
        runsScripts: meta.runs_scripts || (await hasScriptsDir(dir)),
        verified: true,
      });
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  const communityDir = path.join(rootDir, "community");
  const files = (await readdir(communityDir).catch(() => [] as string[])).filter((f) => f.endsWith(".yaml"));
  for (const file of files) {
    const label = `registry/community/${file}`;
    try {
      const entry = await readYaml(path.join(communityDir, file), CommunityEntry, label);
      if (`${entry.name}.yaml` !== file) throw new Error(`${label}: file name must be "${entry.name}.yaml"`);
      const versions = [...entry.versions].sort((a, b) => compareSemver(b.version, a.version));
      const latest = versions[0]!;
      const fm = frontmatterOf(await fetchSkill(entry.repo, latest.sha, entry.path), label);
      if (fm.name !== entry.name) throw new Error(`${label}: SKILL.md name "${fm.name}" must match entry name "${entry.name}"`);
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

  const seen = new Set<string>();
  for (const s of skills) {
    if (seen.has(s.name)) errors.push(`duplicate skill name "${s.name}"`);
    seen.add(s.name);
  }
  if (errors.length) throw new Error(`Registry validation failed:\n- ${errors.join("\n- ")}`);

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return RegistryIndex.parse({ generatedAt: (opts.now ?? new Date()).toISOString(), skills });
}

async function main() {
  const rootDir = path.dirname(fileURLToPath(import.meta.url));
  const index = await buildRegistry({
    rootDir,
    fetchSkill: githubFetcher,
    resolveSha: gitShaResolver(rootDir),
  });
  const out = path.join(rootDir, "dist", "registry.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(index, null, 2) + "\n");
  console.log(`registry: wrote ${index.skills.length} skills to ${path.relative(process.cwd(), out)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
