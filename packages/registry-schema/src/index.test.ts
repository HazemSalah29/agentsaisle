import { describe, expect, it } from "vitest";
import {
  CommunityEntry,
  OfficialMeta,
  Profile,
  Question,
  RegistryIndex,
  SkillFrontmatter,
  compareSemver,
  splitFrontmatter,
} from "./index";

const sha = "a".repeat(40);
const valid = {
  name: "reel-scriptwriter",
  author: "someone",
  repo: "someone/skills",
  path: "skills/reel-scriptwriter",
  versions: [{ version: "1.0.0", ref: "v1.0.0", sha }],
  category: ["video"],
  clients: ["claude-code"],
  runs_scripts: false,
};

describe("CommunityEntry", () => {
  it("accepts a valid entry and defaults verified to false", () => {
    expect(CommunityEntry.parse(valid).verified).toBe(false);
  });
  it("rejects bad names, short SHAs and unknown keys", () => {
    expect(CommunityEntry.safeParse({ ...valid, name: "Bad_Name" }).success).toBe(false);
    expect(
      CommunityEntry.safeParse({ ...valid, versions: [{ version: "1.0.0", ref: "v", sha: "abc" }] })
        .success,
    ).toBe(false);
    expect(CommunityEntry.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});

describe("OfficialMeta / SkillFrontmatter", () => {
  it("validates meta", () => {
    expect(
      OfficialMeta.safeParse({
        version: "1.0.0",
        category: ["code"],
        clients: ["codex"],
        runs_scripts: false,
      }).success,
    ).toBe(true);
    expect(
      OfficialMeta.safeParse({ version: "1", category: [], clients: [], runs_scripts: false })
        .success,
    ).toBe(false);
  });
  it("allows extra frontmatter keys", () => {
    expect(
      SkillFrontmatter.safeParse({ name: "x", description: "d", "allowed-tools": "Read" }).success,
    ).toBe(true);
  });
});

describe("helpers", () => {
  it("splits frontmatter", () => {
    expect(splitFrontmatter("---\nname: a\n---\nbody")).toEqual({
      frontmatter: "name: a",
      body: "body",
    });
    expect(splitFrontmatter("no fm")).toBeNull();
  });
  it("compares semver", () => {
    expect(compareSemver("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareSemver("1.0.0-beta", "1.0.0")).toBeLessThan(0);
  });
});

describe("profiles and questions", () => {
  it("keeps older registries without profiles valid", () => {
    const idx = RegistryIndex.parse({ generatedAt: "2026-01-01T00:00:00.000Z", skills: [] });
    expect(idx.profiles).toEqual([]);
    expect(idx.questions).toEqual([]);
  });
  it("validates profiles and questions", () => {
    expect(
      Profile.safeParse({ id: "code", name: "Code", description: "d", skills: ["explore"] })
        .success,
    ).toBe(true);
    expect(
      Profile.safeParse({ id: "Code!", name: "Code", description: "d", skills: ["explore"] })
        .success,
    ).toBe(false);
    expect(
      Profile.safeParse({ id: "code", name: "Code", description: "d", skills: [] }).success,
    ).toBe(false);
    const q = {
      id: "kind",
      prompt: "What?",
      options: [
        { label: "A", adds: ["explore"] },
        { label: "B", adds: [] },
      ],
    };
    expect(Question.safeParse(q).success).toBe(true);
    expect(Question.safeParse({ ...q, options: [q.options[0]] }).success).toBe(false);
  });
});
