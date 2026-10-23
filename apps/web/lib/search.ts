import { searchSkills, type RegistrySkill } from "@agentsaisle/registry-schema";
import type { Filters } from "./filters";

export { searchSkills };

/** A registry skill plus optional numbers fetched from GitHub at build time. */
export type CatalogSkill = RegistrySkill & { stars?: number; updatedAt?: string };

export function filterSkills<T extends CatalogSkill>(skills: T[], f: Filters): T[] {
  return skills.filter(
    (s) =>
      (f.aisles.length === 0 || f.aisles.some((a) => s.category.includes(a))) &&
      (f.clients.length === 0 || f.clients.some((c) => (s.clients as string[]).includes(c))) &&
      (f.source === "all" || s.source === f.source) &&
      (!f.verifiedOnly || s.verified) &&
      (!f.hideScripts || !s.runsScripts),
  );
}

export function sortSkills<T extends CatalogSkill>(skills: T[], sort: Filters["sort"]): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const copy = [...skills];
  switch (sort) {
    case "name":
      return copy.sort(byName);
    case "newest":
      return copy.sort(
        (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || byName(a, b),
      );
    case "popular":
      return copy.sort(
        (a, b) =>
          (b.stars ?? 0) - (a.stars ?? 0) ||
          Number(b.source === "official") - Number(a.source === "official") ||
          byName(a, b),
      );
  }
}

/**
 * Search, filter and sort in one go. With a query, "popular" keeps relevance order
 * (popularity would bury the best match); "newest" and "name" always re-sort.
 */
export function applyFilters<T extends CatalogSkill>(skills: T[], f: Filters): T[] {
  const matched = filterSkills(searchSkills(skills, f.query), f);
  return f.query.trim() && f.sort === "popular" ? matched : sortSkills(matched, f.sort);
}

/** Options for the FilterBar, derived from the data. */
export function filterOptions(skills: CatalogSkill[]): { aisles: string[]; clients: string[] } {
  const aisles = [...new Set(skills.flatMap((s) => s.category))].sort();
  const clients = [...new Set(skills.flatMap((s) => s.clients))].sort();
  return { aisles, clients };
}
