import { SkillFrontmatter, splitFrontmatter } from "@agentsaisle/registry-schema";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { CliError } from "./errors.js";

export async function readSkillFrontmatter(dir: string): Promise<SkillFrontmatter> {
  let md: string;
  try {
    md = await readFile(path.join(dir, "SKILL.md"), "utf8");
  } catch {
    throw new CliError("Invalid skill: SKILL.md not found at the expected path.");
  }
  const parts = splitFrontmatter(md);
  if (!parts) throw new CliError("Invalid skill: SKILL.md has no frontmatter.");
  let data: unknown;
  try {
    data = parseYaml(parts.frontmatter);
  } catch {
    throw new CliError("Invalid skill: SKILL.md frontmatter is not valid YAML.");
  }
  const res = SkillFrontmatter.safeParse(data);
  if (!res.success) {
    const why = res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new CliError(`Invalid skill: SKILL.md frontmatter is invalid (${why}).`);
  }
  return res.data;
}

/** Throws unless SKILL.md is valid and, when given, its name equals `expectedName`. */
export async function validateSkill(dir: string, expectedName?: string): Promise<SkillFrontmatter> {
  const fm = await readSkillFrontmatter(dir);
  if (expectedName && fm.name !== expectedName) {
    throw new CliError(
      `Invalid skill: SKILL.md name "${fm.name}" does not match "${expectedName}".`,
    );
  }
  return fm;
}

/** Relative paths of all files under a `scripts/` folder (empty when none). */
export async function findScripts(dir: string): Promise<string[]> {
  const root = path.join(dir, "scripts");
  const out: string[] = [];
  const walk = async (d: string): Promise<void> => {
    const entries = await readdir(d, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else out.push(path.relative(dir, full).split(path.sep).join("/"));
    }
  };
  await walk(root);
  return out.sort();
}
