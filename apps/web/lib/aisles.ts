import type {
  Aisle,
  ElsewhereEntry,
  Profile,
  RegistryIndex,
  RegistrySkill,
} from "@agentsaisle/registry-schema";

/** Everything shown on one aisle page, in the order it is shown. */
export interface AisleGroup {
  aisle: Aisle;
  /** Our own skills, baseline first. */
  official: RegistrySkill[];
  /** Community skills a maintainer has read. */
  verified: RegistrySkill[];
  /** Community skills nobody here has read yet. */
  community: RegistrySkill[];
  /** Other authors' skills, with a link out. */
  elsewhere: ElsewhereEntry[];
  /** Curated bundles for this aisle. */
  kits: Profile[];
  /** True when there is no skill to install yet (the aisle exists, the shelves are empty). */
  comingSoon: boolean;
}

const tierRank: Record<string, number> = { baseline: 0, core: 1, specialty: 2 };
const byTierThenName = (a: RegistrySkill, b: RegistrySkill) =>
  (tierRank[a.tier ?? ""] ?? 3) - (tierRank[b.tier ?? ""] ?? 3) || a.name.localeCompare(b.name);
const byName = (a: RegistrySkill, b: RegistrySkill) => a.name.localeCompare(b.name);

/**
 * Does `skill` belong on `aisle`? An official skill goes by its niche. A community skill has no niche,
 * so it goes by its own niche if it set one, or by a category that matches one of the aisle's niches
 * or the aisle's id.
 */
export function inAisle(skill: RegistrySkill, aisle: Aisle): boolean {
  if (skill.niche) return aisle.niches.includes(skill.niche);
  if (skill.source === "official") return false;
  return skill.category.some((c) => aisle.niches.includes(c) || c === aisle.id);
}

export function groupAisle(aisle: Aisle, index: RegistryIndex): AisleGroup {
  const here = index.skills.filter((s) => inAisle(s, aisle));
  const official = here.filter((s) => s.source === "official").sort(byTierThenName);
  const verified = here.filter((s) => s.source === "community" && s.verified).sort(byName);
  const community = here.filter((s) => s.source === "community" && !s.verified).sort(byName);
  return {
    aisle,
    official,
    verified,
    community,
    elsewhere: index.elsewhere
      .filter((e) => e.aisle === aisle.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    kits: index.profiles.filter((p) => p.aisle === aisle.id),
    comingSoon: official.length + verified.length + community.length === 0,
  };
}

export const groupAisles = (index: RegistryIndex): AisleGroup[] =>
  index.aisles.map((a) => groupAisle(a, index));

/** "3 official, 1 community, 2 elsewhere", or "Coming later". */
export function summarizeAisle(g: AisleGroup): string {
  if (g.comingSoon && g.elsewhere.length === 0) return "Coming later";
  const parts = [
    g.official.length ? `${g.official.length} official` : "",
    g.verified.length + g.community.length
      ? `${g.verified.length + g.community.length} community`
      : "",
    g.elsewhere.length ? `${g.elsewhere.length} elsewhere` : "",
  ].filter(Boolean);
  return parts.join(", ");
}
