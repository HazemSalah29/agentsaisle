import type { RegistryIndex, RegistrySkill } from "@agentsaisle/registry-schema";

/** Skills shown in the catalog: a library appears once, its parts are shown on the library's page. Pure. */
export const listedSkills = <T extends { partOf?: string }>(skills: T[]): T[] =>
  skills.filter((s) => !s.partOf);

/** The parts of a library, in name order. Empty for any other skill. Pure. */
export function partsOfLibrary(index: RegistryIndex, skill: RegistrySkill): RegistrySkill[] {
  const names = new Set(skill.requires ?? []);
  return index.skills.filter((s) => names.has(s.name)).sort((a, b) => a.name.localeCompare(b.name));
}

/** The library a part belongs to, if any. Pure. */
export const libraryOfPart = (
  index: RegistryIndex,
  skill: RegistrySkill,
): RegistrySkill | undefined =>
  skill.partOf ? index.skills.find((s) => s.name === skill.partOf) : undefined;
