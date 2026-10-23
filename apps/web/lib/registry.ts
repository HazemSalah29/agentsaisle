import { RegistryIndex, type RegistrySkill } from "@agentsaisle/registry-schema";
// Copied from registry/dist by scripts/copy-registry.mts (predev, prebuild, pretypecheck, pretest).
import data from "../public/registry.json";

let cached: RegistryIndex | undefined;

/** The compiled registry, validated once. Bundled into the build, so it also works for ISR. */
export function getRegistry(): RegistryIndex {
  return (cached ??= RegistryIndex.parse(data));
}

export function getSkill(name: string): RegistrySkill | undefined {
  return getRegistry().skills.find((s) => s.name === name);
}
