import type { RegistryIndex } from "@agentsaisle/registry-schema";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRegistry, resolveSkill } from "./registry.js";
import { SHA, tmpDir } from "./test-utils.js";

const sha2 = "b".repeat(40);
const index: RegistryIndex = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  profiles: [],
  questions: [],
  aisles: [],
  elsewhere: [],
  skills: [
    {
      name: "explore",
      description: "d",
      source: "official",
      author: "a",
      repo: "a/b",
      path: "x",
      latest: "1.10.0",
      versions: [
        { version: "1.9.0", sha: SHA },
        { version: "1.10.0", sha: sha2 },
      ],
      category: ["code"],
      clients: ["claude-code"],
      runsScripts: false,
      verified: true,
    },
  ],
};

describe("resolveSkill", () => {
  it("defaults to latest and honours pinned versions", () => {
    expect(resolveSkill(index, "explore").sha).toBe(sha2);
    expect(resolveSkill(index, "explore", "1.9.0").sha).toBe(SHA);
  });
  it("suggests close names for unknown skills", () => {
    expect(() => resolveSkill(index, "explor")).toThrow(/Did you mean: explore/);
  });
  it("lists versions for unknown versions", () => {
    expect(() => resolveSkill(index, "explore", "9.9.9")).toThrow(/Available: 1.10.0, 1.9.0/);
  });
});

describe("loadRegistry", () => {
  it("reads AISLE_REGISTRY as a local file and validates it", async () => {
    const dir = await tmpDir();
    const file = path.join(dir, "registry.json");
    await writeFile(file, JSON.stringify(index));
    expect((await loadRegistry({ AISLE_REGISTRY: file })).skills).toHaveLength(1);
    await writeFile(file, "{}");
    await expect(loadRegistry({ AISLE_REGISTRY: file })).rejects.toThrow(/not valid/);
    await expect(loadRegistry({ AISLE_REGISTRY: path.join(dir, "missing.json") })).rejects.toThrow(
      /Cannot read/,
    );
  });
});
