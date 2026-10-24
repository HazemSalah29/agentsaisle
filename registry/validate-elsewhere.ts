/**
 * Checks registry/elsewhere.yaml against the public repositories: each folder must hold a SKILL.md and
 * the license must be stated somewhere in the repo. Reads public files over HTTPS only; it never
 * downloads or runs anything else. Run on demand: `pnpm registry:validate-elsewhere`.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { ElsewhereFile, type ElsewhereEntry } from "@agentsaisle/registry-schema";

/** Returns the text of a URL, or undefined when it does not exist (404) or fails. */
export type TextFetcher = (url: string) => Promise<string | undefined>;

export interface Problem {
  entry: string;
  message: string;
}

const raw = (repo: string, file: string) =>
  `https://raw.githubusercontent.com/${repo}/HEAD/${file}`;
const join = (...parts: string[]) => parts.filter(Boolean).join("/");

/** Names of license files to look for, next to the skill and at the repo root. */
const LICENSE_FILES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"];

/** The `license:` value from SKILL.md frontmatter, if any. */
export function frontmatterLicense(skillMd: string): string | undefined {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd);
  if (!m) return undefined;
  try {
    const fm = parseYaml(m[1]!) as Record<string, unknown>;
    return typeof fm?.license === "string" ? fm.license : undefined;
  } catch {
    return undefined;
  }
}

/** Checks one entry. Returns its problems (empty means it is good). */
export async function checkEntry(entry: ElsewhereEntry, fetchText: TextFetcher): Promise<string[]> {
  const problems: string[] = [];
  const skillMd = await fetchText(raw(entry.repo, join(entry.path, "SKILL.md")));
  if (skillMd === undefined) {
    problems.push(`no SKILL.md at ${entry.repo}/${entry.path}`);
    return problems;
  }
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd);
  if (!fm) problems.push("SKILL.md has no frontmatter");
  let found = frontmatterLicense(skillMd) !== undefined;
  for (const dir of [entry.path, ""]) {
    if (found) break;
    for (const f of LICENSE_FILES) {
      if ((await fetchText(raw(entry.repo, join(dir, f)))) !== undefined) {
        found = true;
        break;
      }
    }
  }
  if (!found)
    problems.push(
      "no license found (no LICENSE file in the skill folder or repo root, and none in SKILL.md)",
    );
  return problems;
}

export async function validateElsewhere(
  entries: readonly ElsewhereEntry[],
  fetchText: TextFetcher,
): Promise<Problem[]> {
  const out: Problem[] = [];
  for (const e of entries)
    for (const message of await checkEntry(e, fetchText))
      out.push({ entry: `${e.repo}/${e.path} (${e.name})`, message });
  return out;
}

const httpText: TextFetcher = async (url) => {
  try {
    const res = await fetch(url);
    return res.ok ? await res.text() : undefined;
  } catch {
    return undefined;
  }
};

async function main() {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "elsewhere.yaml");
  const data = ElsewhereFile.parse(parseYaml(await readFile(file, "utf8")));
  const problems = await validateElsewhere(data.entries, httpText);
  console.log(`elsewhere: checked ${data.entries.length} entries`);
  for (const p of problems) console.log(`  ${p.entry}: ${p.message}`);
  if (problems.length) {
    console.log("Drop or fix the entries above before listing them.");
    process.exit(1);
  }
  console.log("elsewhere: all entries verified");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
