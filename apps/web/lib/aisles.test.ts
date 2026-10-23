import type { Aisle, RegistryIndex, RegistrySkill } from "@agentsaisle/registry-schema";
import { describe, expect, it } from "vitest";
import { groupAisle, groupAisles, inAisle, summarizeAisle } from "./aisles";

const sha = "a".repeat(40);
const skill = (name: string, over: Partial<RegistrySkill> = {}): RegistrySkill => ({
  name,
  description: "d",
  source: "official",
  author: "a",
  repo: "o/r",
  path: `p/${name}`,
  latest: "1.0.0",
  versions: [{ version: "1.0.0", sha }],
  category: ["x"],
  clients: ["claude-code"],
  runsScripts: false,
  verified: true,
  ...over,
});
const db: Aisle = { id: "database", name: "Database", description: "d", niches: ["db"] };
const testing: Aisle = {
  id: "testing",
  name: "Testing",
  description: "d",
  niches: ["test", "debug"],
};
const media: Aisle = { id: "media", name: "Media", description: "d", niches: ["image", "video"] };

const index = (skills: RegistrySkill[], extra: Partial<RegistryIndex> = {}): RegistryIndex => ({
  generatedAt: "2026-01-01T00:00:00.000Z",
  skills,
  profiles: [],
  questions: [],
  aisles: [db, testing, media],
  elsewhere: [],
  ...extra,
});

describe("inAisle", () => {
  it("places an official skill by its niche only", () => {
    expect(inAisle(skill("db-schema", { niche: "db" }), db)).toBe(true);
    expect(inAisle(skill("db-schema", { niche: "db" }), testing)).toBe(false);
    expect(inAisle(skill("old-skill", { category: ["db"] }), db)).toBe(false); // official with no niche
  });

  it("places a community skill by its niche, a matching category or the aisle id", () => {
    expect(inAisle(skill("c", { source: "community", category: ["db"] }), db)).toBe(true);
    expect(inAisle(skill("c", { source: "community", category: ["testing"] }), testing)).toBe(true);
    expect(inAisle(skill("c", { source: "community", category: ["writing"] }), db)).toBe(false);
    expect(inAisle(skill("c", { source: "community", niche: "debug" }), testing)).toBe(true);
  });
});

describe("groupAisle", () => {
  const skills = [
    skill("db-seed", { niche: "db", tier: "specialty" }),
    skill("db-baseline", { niche: "db", tier: "baseline" }),
    skill("db-core", { niche: "db", tier: "core" }),
    skill("db-none", { niche: "db" }),
    skill("comm-verified", { source: "community", verified: true, category: ["db"] }),
    skill("comm-open", { source: "community", verified: false, category: ["db"] }),
    skill("elsewhere-free", { niche: "test" }),
  ];

  it("orders official skills by tier, then name, and separates community by trust", () => {
    const g = groupAisle(db, index(skills));
    expect(g.official.map((s) => s.name)).toEqual(["db-baseline", "db-core", "db-seed", "db-none"]);
    expect(g.verified.map((s) => s.name)).toEqual(["comm-verified"]);
    expect(g.community.map((s) => s.name)).toEqual(["comm-open"]);
    expect(g.comingSoon).toBe(false);
  });

  it("attaches the aisle's Elsewhere entries and kits, and no one else's", () => {
    const e = (name: string, aisle: string) => ({
      name,
      author: "a",
      repo: "o/r",
      path: name,
      description: "d",
      license: "MIT",
      aisle,
    });
    const kit = (id: string, aisle?: string) => ({
      id,
      name: id,
      description: "d",
      skills: ["db-seed"],
      ...(aisle ? { aisle } : {}),
    });
    const g = groupAisle(
      db,
      index(skills, {
        elsewhere: [e("z", "database"), e("a", "database"), e("t", "testing")],
        profiles: [kit("db-kit", "database"), kit("other-kit", "testing"), kit("plain")],
      }),
    );
    expect(g.elsewhere.map((x) => x.name)).toEqual(["a", "z"]);
    expect(g.kits.map((k) => k.id)).toEqual(["db-kit"]);
  });

  it("marks an aisle with no skills as coming soon, even if it lists Elsewhere entries", () => {
    const g = groupAisle(media, index(skills));
    expect(g.comingSoon).toBe(true);
    expect(g.official).toEqual([]);
  });

  it("groups every aisle in the registry's order", () => {
    expect(groupAisles(index(skills)).map((g) => g.aisle.id)).toEqual([
      "database",
      "testing",
      "media",
    ]);
  });
});

describe("summarizeAisle", () => {
  const e = {
    name: "a",
    author: "a",
    repo: "o/r",
    path: "",
    description: "d",
    license: "MIT",
    aisle: "database",
  };
  it("counts what is on the shelves", () => {
    const g = groupAisle(
      db,
      index(
        [skill("db-a", { niche: "db" }), skill("c", { source: "community", category: ["db"] })],
        { elsewhere: [e, e] },
      ),
    );
    expect(summarizeAisle(g)).toBe("1 official, 1 community, 2 elsewhere");
  });
  it("says coming later for an empty aisle and still counts Elsewhere when it has some", () => {
    expect(summarizeAisle(groupAisle(media, index([])))).toBe("Coming later");
    expect(summarizeAisle(groupAisle(db, index([], { elsewhere: [e] })))).toBe("1 elsewhere");
  });
});
