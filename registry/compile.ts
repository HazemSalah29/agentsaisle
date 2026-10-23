/**
 * Shared fragments for skills. A skill can keep its source in SKILL.src.md with full-line markers
 * like `<!-- include: _shared/read-budget.md -->`; `pnpm skills:build` expands them into the
 * committed SKILL.md. The CLI installs a skill by downloading its folder at a pinned commit, so the
 * installed SKILL.md has to exist in the repository already expanded.
 */
import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export class IncludeError extends Error {}

const MARKER = /^<!--\s*include:\s*(\S+?)\s*-->$/;
const FRAGMENT_PATH = /^_shared\/[A-Za-z0-9._-]+\.md$/;
const ANY_MARKER = /<!--\s*include:/;

/**
 * Replace every full-line include marker with the fragment's trimmed text. Output uses "\n".
 * `readFragment` gets paths like "_shared/read-budget.md" and returns undefined when missing.
 */
export function expandIncludes(
  text: string,
  readFragment: (fragmentPath: string) => string | undefined,
  file = "SKILL.src.md",
): string {
  const out: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const where = `${file}:${i + 1}`;
    const match = MARKER.exec(line.trim());
    if (!match) {
      if (ANY_MARKER.test(line)) {
        throw new IncludeError(
          `${where}: an include marker must be alone on its line, like <!-- include: _shared/x.md -->.`,
        );
      }
      out.push(line);
      return;
    }
    const fragmentPath = match[1]!;
    if (!FRAGMENT_PATH.test(fragmentPath)) {
      throw new IncludeError(
        `${where}: "${fragmentPath}" is not allowed. Includes must be _shared/<name>.md.`,
      );
    }
    const fragment = readFragment(fragmentPath);
    if (fragment === undefined)
      throw new IncludeError(`${where}: unknown fragment "${fragmentPath}".`);
    if (ANY_MARKER.test(fragment)) {
      throw new IncludeError(
        `${where}: "${fragmentPath}" contains an include of its own. Fragments can't be nested.`,
      );
    }
    out.push(...fragment.trim().split(/\r?\n/));
  });
  const joined = out.join("\n");
  return joined.endsWith("\n") ? joined : `${joined}\n`;
}

export type CompileStatus = "no-source" | "up-to-date" | "written" | "stale";
export interface CompileResult {
  skill: string;
  status: CompileStatus;
}

/**
 * Compile one skill folder. `write` updates SKILL.md; `check` only reports "stale" when SKILL.md is
 * missing or differs from what SKILL.src.md expands to. Skills without a SKILL.src.md are left alone.
 */
export async function compileSkill(
  skillDir: string,
  sharedDir: string,
  mode: "write" | "check",
): Promise<CompileResult> {
  const skill = path.basename(skillDir);
  const srcFile = path.join(skillDir, "SKILL.src.md");
  if (!existsSync(srcFile)) return { skill, status: "no-source" };

  const expanded = expandIncludes(
    await readFile(srcFile, "utf8"),
    (p) => {
      const file = path.join(sharedDir, path.basename(p));
      return existsSync(file) ? readFileSync(file, "utf8") : undefined;
    },
    `${skill}/SKILL.src.md`,
  );

  const target = path.join(skillDir, "SKILL.md");
  const current = existsSync(target) ? await readFile(target, "utf8") : undefined;
  if (current === expanded) return { skill, status: "up-to-date" };
  if (mode === "check") return { skill, status: "stale" };
  await writeFile(target, expanded);
  return { skill, status: "written" };
}

/** Compile every skill folder under `officialDir`. */
export async function compileAll(
  officialDir: string,
  sharedDir: string,
  mode: "write" | "check",
): Promise<CompileResult[]> {
  const entries = await readdir(officialDir, { withFileTypes: true }).catch(() => []);
  const results: CompileResult[] = [];
  for (const e of entries
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    results.push(await compileSkill(path.join(officialDir, e.name), sharedDir, mode));
  }
  return results;
}
