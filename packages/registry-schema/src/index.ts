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

export const SkillKind = z.enum(["saver", "quality"]);
export type SkillKind = z.infer<typeof SkillKind>;
// tier values are an assumption (the V2 brief names the field but not its values).
export const SkillTier = z.enum(["baseline", "core", "specialty"]);
export type SkillTier = z.infer<typeof SkillTier>;

const Fraction = z.number().min(0).max(1);
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date like 2026-10-23");

/** Eval results as written in skill.meta.yaml (snake_case). Rates are fractions from 0 to 1. */
export const MetaTested = z
  .object({
    model: z.string().min(1),
    date: DateOnly,
    tasks: z.number().int().positive(),
    // Negative means the skill used more tokens than the baseline.
    token_savings_median: z.number().min(-1).max(1),
    success_rate: Fraction,
    baseline_success_rate: Fraction,
    preferred_in_blind_test: Fraction,
  })
  .strict();

/** What a skill can do on the user's machine, shown on its page before install. */
export const MetaPermissions = z
  .object({
    tools: z.array(z.string().min(1)),
    writes_files: z.boolean(),
    runs_scripts: z.boolean(),
    network: z.boolean(),
    /** Names of the environment variables the skill needs. Empty means none. */
    needs_api_keys: z.array(z.string().min(1)),
  })
  .strict();

/** A demo link: a full URL, or a path on this site such as /demos/<skill>/<name>.html. */
const DemoUrl = z.union([
  z.url(),
  z.string().regex(/^\/(?!\/)[\w./-]+$/, "a full URL or a path starting with /"),
]);

export const SkillDemo = z
  .object({
    url: DemoUrl.optional(),
    /** One or two sentences that say what the preview shows. Replaces the default text on the skill page. */
    caption: z.string().min(1).max(900).optional(),
    /** Show the url as an interactive page on the skill page, instead of the screenshots. */
    embed: z.boolean().optional(),
    /** "How it was made", shown as a numbered list under an embedded demo. */
    steps: z
      .array(
        z.object({ title: z.string().min(1).max(80), text: z.string().min(1).max(600) }).strict(),
      )
      .max(8)
      .optional(),
    screenshots: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type SkillDemo = z.infer<typeof SkillDemo>;

/** registry/official/<name>/skill.meta.yaml */
export const OfficialMeta = z
  .object({
    version: Semver,
    ...common,
    tokens: z
      .object({ metadata: z.number().int().nonnegative(), body: z.number().int().nonnegative() })
      .optional(),
    // House standard fields (V2). Optional so V1 skills keep working; the skill linter requires
    // niche, kind, tier and permissions for every non-legacy skill.
    niche: SkillName.optional(),
    kind: SkillKind.optional(),
    tier: SkillTier.optional(),
    tested: MetaTested.optional(),
    permissions: MetaPermissions.optional(),
    demo: SkillDemo.optional(),
  })
  .strict();
export type OfficialMeta = z.infer<typeof OfficialMeta>;

/** Frontmatter of a SKILL.md (extra keys allowed; agents add their own). */
export const SkillFrontmatter = z.looseObject({
  name: SkillName,
  description: z.string().min(1),
});
export type SkillFrontmatter = z.infer<typeof SkillFrontmatter>;

/** Audit report (produced by @agentsaisle/audit, read by the CLI, CI and the website). */
export const AuditSeverity = z.enum(["critical", "high", "medium", "low", "info"]);
export type AuditSeverity = z.infer<typeof AuditSeverity>;
export const AuditGrade = z.enum(["A", "B", "C", "D", "F"]);
export type AuditGrade = z.infer<typeof AuditGrade>;

export const AuditFinding = z.object({
  rule: z.string().regex(/^AA-[A-Z]\d{2}$/, "must look like AA-X02"),
  severity: AuditSeverity,
  title: z.string().min(1),
  file: z.string(),
  line: z.number().int().positive().optional(),
  /** At most 160 characters, secrets masked. */
  excerpt: z.string().max(160).optional(),
  why: z.string().min(1),
  fix: z.string().min(1),
  source: z.enum(["static", "deep"]),
  suppressed: z.object({ reason: z.string().min(1) }).optional(),
});
export type AuditFinding = z.infer<typeof AuditFinding>;

/** What a skill can use, for the permissions block on the website. */
export const AuditInventory = z.object({
  tools: z.array(z.string()),
  scripts: z.array(z.string()),
  urls: z.array(z.string()),
  domains: z.array(z.string()),
});
export type AuditInventory = z.infer<typeof AuditInventory>;

const AuditCounts = z.object({
  critical: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  low: z.number().int().nonnegative(),
  info: z.number().int().nonnegative(),
});

/** The part of a report the catalog needs (grade badge), stored in registry.json. */
export const AuditSummary = z.object({
  grade: AuditGrade,
  counts: AuditCounts,
  auditedAt: z.string(),
  auditVersion: z.string(),
});
export type AuditSummary = z.infer<typeof AuditSummary>;

export const AuditReport = z.object({
  skill: z.string(),
  version: z.string().optional(),
  sha: z.string().optional(),
  auditedAt: z.string(),
  auditVersion: z.string(),
  files: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  counts: AuditCounts,
  grade: AuditGrade,
  /** Optional so reports stored before A3 still parse. */
  inventory: AuditInventory.optional(),
  findings: z.array(AuditFinding),
  disclaimer: z.string().min(1),
});
export type AuditReport = z.infer<typeof AuditReport>;

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
  // V2 fields, camelCase like the rest of the index. Absent for community skills and V1 skills.
  niche: SkillName.optional(),
  kind: SkillKind.optional(),
  tier: SkillTier.optional(),
  tested: z
    .object({
      model: z.string(),
      date: z.string(),
      tasks: z.number().int(),
      tokenSavingsMedian: z.number(),
      successRate: z.number(),
      baselineSuccessRate: z.number(),
      preferredInBlindTest: z.number(),
    })
    .optional(),
  permissions: z
    .object({
      tools: z.array(z.string()),
      writesFiles: z.boolean(),
      runsScripts: z.boolean(),
      network: z.boolean(),
      needsApiKeys: z.array(z.string()),
    })
    .optional(),
  demo: z
    .object({
      url: z.string().optional(),
      caption: z.string().optional(),
      embed: z.boolean().optional(),
      steps: z.array(z.object({ title: z.string(), text: z.string() })).optional(),
      screenshots: z.array(z.string()),
    })
    .optional(),
  /** Grade and counts from the stored audit (A3). Absent when the skill has not been audited. */
  audit: AuditSummary.optional(),
});
export type RegistrySkill = z.infer<typeof RegistrySkill>;

/** A starter bundle, installed by `aisle init --profile <id>`. */
export const Profile = z.object({
  id: SkillName,
  name: z.string().min(1),
  description: z.string().min(1),
  skills: z.array(SkillName).min(1),
  /** Set for a kit: a curated bundle shown on this aisle's page. Must be an id from aisles.yaml. */
  aisle: SkillName.optional(),
});
export type Profile = z.infer<typeof Profile>;

/** One question of the profile picker. Each answer adds skills to the bundle. */
export const Question = z.object({
  id: SkillName,
  prompt: z.string().min(1),
  options: z.array(z.object({ label: z.string().min(1), adds: z.array(SkillName) })).min(2),
});
export type Question = z.infer<typeof Question>;

/** registry/profiles.yaml */
export const ProfilesFile = z.object({
  profiles: z.array(Profile).min(1),
  questions: z.array(Question).min(1),
});
export type ProfilesFile = z.infer<typeof ProfilesFile>;

/** One aisle (niche group) of the catalog. `niches` are the values of `niche` in skill.meta.yaml. */
export const Aisle = z.object({
  id: SkillName,
  name: z.string().min(1),
  description: z.string().min(1),
  niches: z.array(SkillName).min(1),
});
export type Aisle = z.infer<typeof Aisle>;

/** registry/aisles.yaml */
export const AislesFile = z.object({ aisles: z.array(Aisle).min(1) });
export type AislesFile = z.infer<typeof AislesFile>;

/**
 * A skill by another author, listed on its own aisle with a link out. We do not copy it and do not
 * install it. `description` is one short neutral line written by us.
 */
export const ElsewhereEntry = z
  .object({
    name: z.string().min(1).max(80),
    author: z.string().min(1),
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "must be <owner>/<repo>"),
    /** Folder inside the repo, or empty for the repo root. */
    path: z.string().default(""),
    description: z.string().min(1).max(160),
    /** SPDX id as reported by GitHub, such as MIT or Apache-2.0. */
    license: z.string().min(1),
    aisle: SkillName,
  })
  .strict();
export type ElsewhereEntry = z.infer<typeof ElsewhereEntry>;

/** registry/elsewhere.yaml */
export const ElsewhereFile = z.object({ entries: z.array(ElsewhereEntry) });
export type ElsewhereFile = z.infer<typeof ElsewhereFile>;

export const RegistryIndex = z.object({
  generatedAt: z.string(),
  skills: z.array(RegistrySkill),
  // Defaults keep older cached registry.json files (without profiles) valid.
  profiles: z.array(Profile).default([]),
  questions: z.array(Question).default([]),
  aisles: z.array(Aisle).default([]),
  elsewhere: z.array(ElsewhereEntry).default([]),
  /** The block `aisle init` writes into CLAUDE.md or AGENTS.md. Delivered here so a site deploy can change it. */
  houseRules: z.string().optional(),
});
export type RegistryIndex = z.infer<typeof RegistryIndex>;

export const LockEntry = z.object({
  name: SkillName,
  version: z.string().min(1),
  repo: z.string(),
  path: z.string(),
  sha: CommitSha,
  installedAt: z.string(),
});
export type LockEntry = z.infer<typeof LockEntry>;

/** aisle-lock.json in the project root */
export const LockFile = z.object({
  lockfileVersion: z.literal(1),
  skills: z.record(SkillName, LockEntry),
});
export type LockFile = z.infer<typeof LockFile>;

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
export * from "./search";
