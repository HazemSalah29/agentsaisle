import type { RegistrySkill } from "./index";

type Searchable = Pick<RegistrySkill, "name" | "category" | "author" | "description">;

const WEIGHTS = { namePrefix: 10, name: 6, aisle: 4, author: 2, description: 1 };

function scoreToken(skill: Searchable, token: string): number {
  const name = skill.name.toLowerCase();
  let score = 0;
  if (name.startsWith(token)) score += WEIGHTS.namePrefix;
  else if (name.includes(token)) score += WEIGHTS.name;
  if (skill.category.some((c) => c.toLowerCase().includes(token))) score += WEIGHTS.aisle;
  if (skill.author.toLowerCase().includes(token)) score += WEIGHTS.author;
  if (skill.description.toLowerCase().includes(token)) score += WEIGHTS.description;
  return score;
}

/**
 * Skills matching every word of `query` (name, aisle, author, description), best match first.
 * An empty query returns the skills unchanged. Shared by the website and the CLI.
 */
export function searchSkills<T extends Searchable>(skills: T[], query: string): T[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return skills;
  return skills
    .map((skill, index) => {
      const scores = tokens.map((t) => scoreToken(skill, t));
      return {
        skill,
        index,
        total: scores.every((s) => s > 0) ? scores.reduce((a, b) => a + b, 0) : 0,
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || a.index - b.index)
    .map((r) => r.skill);
}
