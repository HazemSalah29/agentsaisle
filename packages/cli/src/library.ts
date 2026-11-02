import type { RegistryIndex, RegistrySkill } from "@agentsaisle/registry-schema";
import { parseSpec } from "./spec.js";

/** The registry entry a plain `name` or `name@version` points at, or undefined for GitHub installs and unknown names. */
export function libraryOf(index: RegistryIndex, input: string): RegistrySkill | undefined {
  let spec;
  try {
    spec = parseSpec(input);
  } catch {
    return undefined;
  }
  if (spec.kind !== "registry") return undefined;
  const skill = index.skills.find((s) => s.name === spec.name);
  return skill?.requires?.length ? skill : undefined;
}

/** What to install, in order: a library's parts first, then the library, so a failed part leaves no half-installed library. */
export interface InstallStep {
  input: string;
  /** Inputs that must have installed before this one is tried. */
  needs: string[];
}

/** Expands libraries (for example `video`) into their parts. Order is kept and nothing is installed twice. Pure. */
export function expandLibraries(inputs: string[], index: RegistryIndex): InstallStep[] {
  const steps: InstallStep[] = [];
  const seen = new Set<string>();
  const add = (input: string, needs: string[] = []) => {
    if (seen.has(input)) return;
    seen.add(input);
    steps.push({ input, needs });
  };
  for (const input of inputs) {
    const lib = libraryOf(index, input);
    if (!lib) {
      add(input);
      continue;
    }
    const parts = lib.requires ?? [];
    for (const p of parts) add(p);
    add(input, parts);
  }
  return steps;
}

/** The parts of an installed library, by name (empty when `name` is not a library). */
export function partsOf(index: RegistryIndex | undefined, name: string): string[] {
  return index?.skills.find((s) => s.name === name)?.requires ?? [];
}
