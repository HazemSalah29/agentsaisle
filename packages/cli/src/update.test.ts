import type { LockFile, RegistryIndex } from "@agentsaisle/registry-schema";
import { describe, expect, it } from "vitest";
import { planUpdates } from "./update.js";
import { SHA } from "./test-utils.js";

const skill = (name: string, latest: string) => ({
  name,
  description: "d",
  source: "official" as const,
  author: "a",
  repo: "a/b",
  path: name,
  latest,
  versions: [{ version: latest, sha: SHA }],
  category: ["code"],
  clients: ["claude-code" as const],
  runsScripts: false,
  verified: true,
});
const index: RegistryIndex = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  profiles: [],
  questions: [],
  skills: [skill("explore", "1.10.0"), skill("commit", "1.0.0"), skill("plan", "2.0.0")],
};
const entry = (name: string, version: string) => ({
  name,
  version,
  repo: "a/b",
  path: name,
  sha: SHA,
  installedAt: "2026-01-01T00:00:00.000Z",
});
const lock = (...entries: ReturnType<typeof entry>[]): LockFile => ({
  lockfileVersion: 1,
  skills: Object.fromEntries(entries.map((e) => [e.name, e])),
});

describe("planUpdates", () => {
  it("updates only skills whose latest is newer, comparing versions numerically", () => {
    const l = lock(entry("explore", "1.9.0"), entry("commit", "1.0.0"), entry("plan", "1.0.0"));
    const plan = planUpdates(l, index, ["explore", "commit", "plan"]);
    expect(plan.updates).toEqual([
      { name: "explore", from: "1.9.0", to: "1.10.0" },
      { name: "plan", from: "1.0.0", to: "2.0.0" },
    ]);
    expect(plan.upToDate).toEqual(["commit"]);
    expect(plan.skipped).toEqual([]);
  });
  it("never downgrades a skill that is ahead of the registry", () => {
    const plan = planUpdates(lock(entry("commit", "1.5.0")), index, ["commit"]);
    expect(plan.updates).toEqual([]);
    expect(plan.upToDate).toEqual(["commit"]);
  });
  it("reports GitHub installs and skills that left the registry without touching them", () => {
    const l = lock(entry("explore", "git:abc1234"), entry("ghost", "1.0.0"));
    const plan = planUpdates(l, index, ["explore", "ghost"]);
    expect(plan.updates).toEqual([]);
    expect(plan.skipped.map((s) => s.name)).toEqual(["explore", "ghost"]);
    expect(plan.skipped[0]!.reason).toMatch(/straight from GitHub/);
    expect(plan.skipped[1]!.reason).toMatch(/no longer in the registry/);
  });
  it("ignores names that aren't in the lockfile", () => {
    expect(planUpdates(lock(), index, ["explore"])).toEqual({
      updates: [],
      upToDate: [],
      skipped: [],
    });
  });
});
