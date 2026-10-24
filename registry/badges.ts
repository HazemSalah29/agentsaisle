/**
 * shields.io endpoint badges, one JSON file per skill: /badges/<name>.json.
 * A README shows one with ![aisle audit](https://img.shields.io/endpoint?url=<site>/badges/<name>.json).
 * Format: https://shields.io/badges/endpoint-badge (schemaVersion 1, label, message, color).
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditGrade, RegistrySkill } from "@agentsaisle/registry-schema";

export interface Badge {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
}

const COLORS: Record<AuditGrade, string> = {
  A: "brightgreen",
  B: "green",
  C: "yellow",
  D: "orange",
  F: "red",
};

/** The badge for a skill's audit grade. A skill with no report says so, in grey. */
export function badgeFor(grade: AuditGrade | undefined): Badge {
  return grade
    ? { schemaVersion: 1, label: "aisle audit", message: grade, color: COLORS[grade] }
    : { schemaVersion: 1, label: "aisle audit", message: "not audited", color: "lightgrey" };
}

/** Write dist/badges/<name>.json for every skill, replacing whatever an earlier build left. */
export async function writeBadges(dir: string, skills: readonly RegistrySkill[]): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const s of skills)
    await writeFile(
      path.join(dir, `${s.name}.json`),
      JSON.stringify(badgeFor(s.audit?.grade)) + "\n",
    );
}
