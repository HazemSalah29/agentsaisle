import { searchSkills, type RegistrySkill } from "@agentsaisle/registry-schema";
import type { Context } from "./context.js";
import { CliError } from "./errors.js";
import { loadRegistry } from "./registry.js";

const LIMIT = 20;

function describe(skill: RegistrySkill): string {
  const trust =
    skill.source === "official" ? "official" : skill.verified ? "verified" : "unverified";
  return [
    skill.name,
    `v${skill.latest}`,
    trust,
    ...(skill.runsScripts ? ["runs scripts"] : []),
  ].join("  ");
}

const shorten = (text: string, max = 110) =>
  text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text;

/** Search the registry by name, aisle, author and description, best match first. */
export async function searchRegistry(query: string, ctx: Context): Promise<void> {
  if (!query.trim()) throw new CliError("Give a word to search for, for example: aisle search git");
  const results = searchSkills((await loadRegistry()).skills, query);
  if (results.length === 0) {
    ctx.log(`No skills match "${query}". Try fewer words, or browse the catalog on the website.`);
    return;
  }
  for (const skill of results.slice(0, LIMIT)) {
    ctx.log(describe(skill));
    ctx.log(`  ${shorten(skill.description)}`);
  }
  if (results.length > LIMIT)
    ctx.log(`... and ${results.length - LIMIT} more. Add more words to narrow it down.`);
  ctx.log();
  ctx.log(`Install one with: aisle add ${results[0]!.name}`);
}
