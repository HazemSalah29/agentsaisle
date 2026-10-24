import type { RegistrySkill } from "@agentsaisle/registry-schema";

/**
 * An official skill with no measured results yet. Numbers on this site come only from the eval
 * harness, so until it has run, the skill says "Untested" instead of making a claim.
 */
export const isUntested = (skill: Pick<RegistrySkill, "source" | "tested">): boolean =>
  skill.source === "official" && !skill.tested;
