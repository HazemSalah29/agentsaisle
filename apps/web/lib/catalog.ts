import { getRepoMeta } from "./github";
import { listedSkills } from "./library";
import { getRegistry } from "./registry";
import type { CatalogSkill } from "./search";

/** All listed skills (a library once, not its parts), with GitHub stars and last-updated dates when they could be fetched. */
export async function getCatalog(): Promise<CatalogSkill[]> {
  const skills = listedSkills(getRegistry().skills);
  const repos = [...new Set(skills.map((s) => s.repo))];
  const metas = new Map(
    await Promise.all(repos.map(async (r) => [r, await getRepoMeta(r)] as const)),
  );
  return skills.map((s) => {
    const meta = metas.get(s.repo);
    return meta ? { ...s, stars: meta.stars, updatedAt: meta.pushedAt } : s;
  });
}
