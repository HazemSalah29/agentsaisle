import { z } from "zod";

export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SHA_RE = /^[0-9a-f]{40}$/;

export const SkillName = z
  .string()
  .max(64)
  .regex(SKILL_NAME_RE, "must be lowercase kebab-case (a-z, 0-9, hyphens)");
export const Semver = z.string().regex(SEMVER_RE, "must be a semantic version like 1.2.0");
export const CommitSha = z
  .string()
  .regex(SHA_RE, "must be a full 40-character lowercase commit SHA");
export const Client = z.enum(["claude-code", "codex", "cursor"]);

const common = {
  category: z.array(z.string().min(1)).min(1),
  clients: z.array(Client).min(1),
  runs_scripts: z.boolean(),
};

export const CommunityVersion = z.object({
  version: Semver,
  ref: z.string().min(1),
  sha: CommitSha,
});

/** registry/community/<name>.yaml */
export const CommunityEntry = z
  .object({
    name: SkillName,
    author: z.string().min(1),
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "must be <owner>/<repo>"),
    path: z.string().min(1),
    versions: z.array(CommunityVersion).min(1),
    ...common,
    verified: z.boolean().default(false),
  })
  .strict();
export type CommunityEntry = z.infer<typeof CommunityEntry>;

/** registry/official/<name>/skill.meta.yaml */
export const OfficialMeta = z
  .object({
    version: Semver,
    ...common,
    tokens: z
      .object({ metadata: z.number().int().nonnegative(), body: z.number().int().nonnegative() })
      .optional(),
  })
  .strict();
export type OfficialMeta = z.infer<typeof OfficialMeta>;

/** Frontmatter of a SKILL.md (extra keys allowed; agents add their own). */
export const SkillFrontmatter = z.looseObject({
  name: SkillName,
  description: z.string().min(1),
});
export type SkillFrontmatter = z.infer<typeof SkillFrontmatter>;

export const RegistrySkill = z.object({
  name: SkillName,
  description: z.string(),
  source: z.enum(["official", "community"]),
  author: z.string(),
  repo: z.string(),
  path: z.string(),
  latest: Semver,
  versions: z.array(z.object({ version: Semver, sha: CommitSha })).min(1),
  category: z.array(z.string()),
  clients: z.array(Client),
  runsScripts: z.boolean(),
  verified: z.boolean(),
});
export type RegistrySkill = z.infer<typeof RegistrySkill>;

export const RegistryIndex = z.object({
  generatedAt: z.string(),
  skills: z.array(RegistrySkill),
});
export type RegistryIndex = z.infer<typeof RegistryIndex>;

/** Parse "a: b" style frontmatter-delimited markdown into [frontmatterText, body]. */
export function splitFrontmatter(md: string): { frontmatter: string; body: string } | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(md);
  return m ? { frontmatter: m[1] ?? "", body: m[2] ?? "" } : null;
}

export function compareSemver(a: string, b: string): number {
  const parse = (v: string) => v.split("-")[0]!.split(".").map(Number);
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  // a prerelease sorts below the same release
  return Number(!a.includes("-")) - Number(!b.includes("-"));
}
