/**
 * House-standard linter for official skills (V2 brief section 2.3). Run with `pnpm lint:skills`.
 * Reads files only; it never runs anything from a skill.
 */
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { OfficialMeta, SkillFrontmatter, splitFrontmatter } from "@agentsaisle/registry-schema";
import { compileSkill, IncludeError } from "./compile";

export interface LintFinding {
  skill: string;
  /** File inside the skill folder the finding is about. */
  file: string;
  rule: string;
  message: string;
}

/** Niche of the core kit, exempt from the `<niche>-<task>` naming rule. */
export const CORE_NICHE = "core";
export const MAX_LINES = 150;
export const MAX_DESCRIPTION = 1024;
export const REQUIRED_SECTIONS = [
  "Use when",
  "Don't use when",
  "Steps",
  "Budget",
  "Output",
  "Done when",
] as const;

const NETWORK_PATTERNS: Array<[string, RegExp]> = [
  ["curl", /\bcurl\b/],
  ["wget", /\bwget\b/],
  ["fetch()", /\bfetch\s*\(/],
  ["http.get", /\bhttps?\.(get|request)\s*\(/],
  ["XMLHttpRequest", /XMLHttpRequest/],
  ["URL import", /(import\s*\(\s*|require\s*\(\s*|from\s+)['"]https?:/],
];
const ALLOW_NETWORK = "lint-skills: allow-network";

export interface LintOptions {
  sharedDir: string;
  /** V1 skills exempt from the section and meta-completeness rules until Milestone 8. */
  legacy: boolean;
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(full)));
    else out.push(full);
  }
  return out;
}

/** Lint one skill folder. */
export async function lintSkill(skillDir: string, opts: LintOptions): Promise<LintFinding[]> {
  const skill = path.basename(skillDir);
  const findings: LintFinding[] = [];
  const add = (file: string, rule: string, message: string) =>
    findings.push({ skill, file, rule, message });

  // skill.meta.yaml
  let meta: OfficialMeta | undefined;
  const metaFile = path.join(skillDir, "skill.meta.yaml");
  if (!existsSync(metaFile)) {
    add("skill.meta.yaml", "meta", "missing skill.meta.yaml.");
  } else {
    try {
      const res = OfficialMeta.safeParse(parseYaml(await readFile(metaFile, "utf8")));
      if (res.success) meta = res.data;
      else {
        for (const i of res.error.issues)
          add("skill.meta.yaml", "meta", `${i.path.join(".") || "(root)"}: ${i.message}`);
      }
    } catch (e) {
      add("skill.meta.yaml", "meta", `not valid YAML: ${(e as Error).message.split("\n")[0]}`);
    }
  }

  // SKILL.md: frontmatter, length
  const skillFile = path.join(skillDir, "SKILL.md");
  if (!existsSync(skillFile)) {
    add("SKILL.md", "frontmatter", "missing SKILL.md.");
    return findings;
  }
  const text = await readFile(skillFile, "utf8");
  const parts = splitFrontmatter(text);
  let frontmatter: Record<string, unknown> = {};
  if (!parts) {
    add("SKILL.md", "frontmatter", "no frontmatter (a --- block with name and description).");
  } else {
    let data: unknown;
    try {
      data = parseYaml(parts.frontmatter);
    } catch {
      add("SKILL.md", "frontmatter", "frontmatter is not valid YAML.");
    }
    const res = SkillFrontmatter.safeParse(data);
    if (!res.success) {
      for (const i of res.error.issues)
        add("SKILL.md", "frontmatter", `${i.path.join(".") || "frontmatter"}: ${i.message}`);
    } else {
      frontmatter = res.data;
      if (res.data.name !== skill)
        add(
          "SKILL.md",
          "frontmatter",
          `name "${res.data.name}" must equal the folder name "${skill}".`,
        );
      if (res.data.description.length > MAX_DESCRIPTION) {
        add(
          "SKILL.md",
          "frontmatter",
          `description is ${res.data.description.length} characters (max ${MAX_DESCRIPTION}).`,
        );
      }
    }
  }

  const lineCount = text.replace(/\n$/, "").split("\n").length;
  if (lineCount > MAX_LINES)
    add(
      "SKILL.md",
      "length",
      `${lineCount} lines (max ${MAX_LINES}). Move detail into references/.`,
    );

  // name format. The core kit (niche "core") keeps short names like "plan" and "verify".
  if (meta?.niche && meta.niche !== CORE_NICHE && !skill.startsWith(`${meta.niche}-`)) {
    add("SKILL.md", "name", `name must start with the niche: "${meta.niche}-<task>".`);
  }

  // sections (not for legacy skills)
  if (!opts.legacy && parts) {
    const headings = parts.body
      .split(/\r?\n/)
      .flatMap((l) => (l.startsWith("## ") ? [l.slice(3).trim()] : []));
    const missing = REQUIRED_SECTIONS.filter((s) => !headings.includes(s));
    for (const s of missing) add("SKILL.md", "sections", `missing section "## ${s}".`);
    if (missing.length === 0) {
      const order = REQUIRED_SECTIONS.map((s) => headings.indexOf(s));
      if (order.some((n, i) => i > 0 && n < order[i - 1]!)) {
        add(
          "SKILL.md",
          "sections",
          `sections are out of order. Expected: ${REQUIRED_SECTIONS.join(", ")}.`,
        );
      }
    }
  }

  // meta completeness (not for legacy skills)
  if (!opts.legacy && meta) {
    const absent = (["niche", "kind", "tier", "permissions"] as const).filter(
      (k) => meta![k] === undefined,
    );
    if (absent.length)
      add(
        "skill.meta.yaml",
        "meta",
        `missing ${absent.join(", ")} (required by the house standard).`,
      );
  }

  // permissions vs scripts
  const hasScripts = existsSync(path.join(skillDir, "scripts"));
  if (meta?.permissions && meta.permissions.runs_scripts !== meta.runs_scripts) {
    add("skill.meta.yaml", "permissions", "permissions.runs_scripts must equal runs_scripts.");
  }
  if (hasScripts && meta && !meta.runs_scripts) {
    add(
      "skill.meta.yaml",
      "permissions",
      "the skill has a scripts/ folder, so runs_scripts must be true.",
    );
  }

  // demo screenshots must be plain file names that exist in preview/
  for (const shotName of meta?.demo?.screenshots ?? []) {
    if (!/^[\w.-]+\.(png|jpe?g|webp)$/i.test(shotName))
      add("skill.meta.yaml", "demo", `screenshot "${shotName}" must be a file name in preview/.`);
    else if (!existsSync(path.join(skillDir, "preview", shotName)))
      add("skill.meta.yaml", "demo", `screenshot "${shotName}" not found in preview/.`);
  }

  // invocation
  if (/^(design|image|video)-/.test(skill) && frontmatter["disable-model-invocation"] !== true) {
    add(
      "SKILL.md",
      "invocation",
      "style and media skills must set disable-model-invocation: true.",
    );
  }

  // references one level deep
  const refs = path.join(skillDir, "references");
  for (const e of await readdir(refs, { withFileTypes: true }).catch(() => [])) {
    if (e.isDirectory())
      add(
        `references/${e.name}`,
        "references",
        "references/ must be one level deep; no sub-folders.",
      );
  }

  // scripts never fetch remote code
  for (const file of (await listFiles(path.join(skillDir, "scripts"))).sort()) {
    const rel = path.relative(skillDir, file).split(path.sep).join("/");
    const body = await readFile(file, "utf8").catch(() => "");
    const allowed = body.includes(ALLOW_NETWORK);
    if (allowed && meta?.permissions?.network !== true) {
      add(
        rel,
        "scripts",
        `"${ALLOW_NETWORK}" requires permissions.network: true in skill.meta.yaml.`,
      );
      continue;
    }
    if (allowed) continue;
    const lines = body.split(/\r?\n/);
    for (const [label, re] of NETWORK_PATTERNS) {
      const at = lines.findIndex((l) => re.test(l));
      if (at !== -1) {
        add(
          rel,
          "scripts",
          `line ${at + 1}: network access (${label}). Scripts must not fetch remote code. For a provider call, add "${ALLOW_NETWORK}" and set permissions.network: true.`,
        );
        break;
      }
    }
  }

  // includes
  if (text.includes("<!-- include:")) {
    add(
      "SKILL.md",
      "includes",
      "unexpanded include marker. Edit SKILL.src.md and run pnpm skills:build.",
    );
  }
  try {
    if ((await compileSkill(skillDir, opts.sharedDir, "check")).status === "stale") {
      add("SKILL.md", "includes", "out of date with SKILL.src.md. Run pnpm skills:build.");
    }
  } catch (e) {
    if (!(e instanceof IncludeError)) throw e;
    add("SKILL.src.md", "includes", e.message);
  }

  return findings;
}

export interface LintReport {
  findings: LintFinding[];
  checked: string[];
  legacy: string[];
}

/** Lint every skill under `officialDir`. `legacy` names are exempt from the section and meta rules. */
export async function lintAll(
  officialDir: string,
  sharedDir: string,
  legacyNames: string[],
): Promise<LintReport> {
  const entries = (await readdir(officialDir, { withFileTypes: true }).catch(() => []))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const findings: LintFinding[] = [];
  for (const name of entries) {
    findings.push(
      ...(await lintSkill(path.join(officialDir, name), {
        sharedDir,
        legacy: legacyNames.includes(name),
      })),
    );
  }
  for (const name of legacyNames.filter((n) => !entries.includes(n))) {
    findings.push({
      skill: name,
      file: "lint-skills.config.json",
      rule: "config",
      message: `legacy list names "${name}", which is not an official skill. Remove it from the config.`,
    });
  }
  return { findings, checked: entries, legacy: legacyNames.filter((n) => entries.includes(n)) };
}
