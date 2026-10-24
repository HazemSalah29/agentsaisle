import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { RegistrySkill } from "@agentsaisle/registry-schema";
import { describe, expect, it } from "vitest";
import { badgeFor, writeBadges } from "./badges";

const skill = (name: string, grade?: "A" | "F"): RegistrySkill => ({
  name,
  description: "d",
  source: "official",
  author: "a",
  repo: "a/b",
  path: `registry/official/${name}`,
  latest: "1.0.0",
  versions: [{ version: "1.0.0", sha: "a".repeat(40) }],
  category: [],
  clients: ["claude-code"],
  runsScripts: false,
  verified: true,
  ...(grade
    ? {
        audit: {
          grade,
          counts: { critical: grade === "F" ? 1 : 0, high: 0, medium: 0, low: 0, info: 0 },
          auditedAt: "2026-10-24T00:00:00.000Z",
          auditVersion: "1.0.0",
        },
      }
    : {}),
});

describe("badgeFor", () => {
  it("uses the shields.io endpoint format with a color per grade", () => {
    expect(badgeFor("A")).toEqual({
      schemaVersion: 1,
      label: "aisle audit",
      message: "A",
      color: "brightgreen",
    });
    expect((["A", "B", "C", "D", "F"] as const).map((g) => badgeFor(g).color)).toEqual([
      "brightgreen",
      "green",
      "yellow",
      "orange",
      "red",
    ]);
  });
  it("says 'not audited' in grey when there is no report", () => {
    expect(badgeFor(undefined)).toMatchObject({ message: "not audited", color: "lightgrey" });
  });
});

describe("writeBadges", () => {
  it("writes one valid JSON file per skill and removes stale ones", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "aisle-badges-"));
    await writeFile(path.join(dir, "old.json"), "{}");
    await writeBadges(dir, [skill("alpha", "A"), skill("beta", "F"), skill("gamma")]);
    expect((await readdir(dir)).sort()).toEqual(["alpha.json", "beta.json", "gamma.json"]);
    const read = async (n: string) => JSON.parse(await readFile(path.join(dir, n), "utf8"));
    expect((await read("beta.json")).color).toBe("red");
    expect((await read("gamma.json")).message).toBe("not audited");
  });
});
