import { describe, expect, it } from "vitest";
import { defaultFilters, type Filters } from "./filters";
import {
  applyFilters,
  filterOptions,
  filterSkills,
  searchSkills,
  sortSkills,
  type CatalogSkill,
} from "./search";

const sha = "a".repeat(40);
const skill = (over: Partial<CatalogSkill> & { name: string }): CatalogSkill => ({
  description: "A skill.",
  source: "community",
  author: "someone",
  repo: "a/b",
  path: over.name,
  latest: "1.0.0",
  versions: [{ version: "1.0.0", sha }],
  category: ["code"],
  clients: ["claude-code"],
  runsScripts: false,
  verified: false,
  ...over,
});

const explore = skill({
  name: "explore",
  source: "official",
  verified: true,
  description: "Map a codebase before editing.",
  stars: 5,
  updatedAt: "2026-03-01",
});
const commit = skill({
  name: "commit",
  source: "official",
  verified: true,
  category: ["code", "git"],
  description: "Write a clear git commit.",
  clients: ["claude-code", "codex"],
  stars: 20,
  updatedAt: "2026-01-01",
});
const reel = skill({
  name: "reel-scriptwriter",
  author: "reel-lab",
  category: ["video"],
  description: "Write short video scripts.",
  runsScripts: true,
  stars: 20,
  updatedAt: "2026-06-01",
});
const all = [explore, commit, reel];
const f = (patch: Partial<Filters> = {}): Filters => ({ ...defaultFilters, ...patch });
const names = (s: CatalogSkill[]) => s.map((x) => x.name);

describe("searchSkills", () => {
  it("returns everything for an empty query", () => {
    expect(searchSkills(all, "  ")).toEqual(all);
  });
  it("ranks name matches above description matches", () => {
    // "write" is in two descriptions; "commit" prefix-matches a name
    expect(names(searchSkills(all, "commit"))[0]).toBe("commit");
    expect(names(searchSkills(all, "git"))).toEqual(["commit"]);
  });
  it("matches aisle and author, case-insensitively", () => {
    expect(names(searchSkills(all, "VIDEO"))).toEqual(["reel-scriptwriter"]);
    expect(names(searchSkills(all, "reel-lab"))).toEqual(["reel-scriptwriter"]);
  });
  it("requires every word to match", () => {
    expect(names(searchSkills(all, "write video"))).toEqual(["reel-scriptwriter"]);
    expect(searchSkills(all, "write zzz")).toEqual([]);
  });
});

describe("filterSkills", () => {
  it("filters by aisle (any of), client (any of), source, trust and scripts", () => {
    expect(names(filterSkills(all, f({ aisles: ["git", "video"] })))).toEqual([
      "commit",
      "reel-scriptwriter",
    ]);
    expect(names(filterSkills(all, f({ clients: ["codex"] })))).toEqual(["commit"]);
    expect(names(filterSkills(all, f({ source: "community" })))).toEqual(["reel-scriptwriter"]);
    expect(names(filterSkills(all, f({ verifiedOnly: true })))).toEqual(["explore", "commit"]);
    expect(names(filterSkills(all, f({ hideScripts: true })))).toEqual(["explore", "commit"]);
  });
  it("combines filters", () => {
    expect(
      names(filterSkills(all, f({ aisles: ["code"], source: "official", clients: ["codex"] }))),
    ).toEqual(["commit"]);
    expect(filterSkills(all, f({ aisles: ["video"], verifiedOnly: true }))).toEqual([]);
  });
});

describe("sortSkills", () => {
  it("sorts by name", () => {
    expect(names(sortSkills(all, "name"))).toEqual(["commit", "explore", "reel-scriptwriter"]);
  });
  it("sorts newest first by update date", () => {
    expect(names(sortSkills(all, "newest"))).toEqual(["reel-scriptwriter", "explore", "commit"]);
  });
  it("sorts popular by stars, then official first, then name; works without any numbers", () => {
    expect(names(sortSkills(all, "popular"))).toEqual(["commit", "reel-scriptwriter", "explore"]);
    const bare = [reel, explore, commit].map((x) => ({
      ...x,
      stars: undefined,
      updatedAt: undefined,
    }));
    expect(names(sortSkills(bare, "popular"))).toEqual(["commit", "explore", "reel-scriptwriter"]);
  });
  it("does not mutate its input", () => {
    const copy = [...all];
    sortSkills(all, "name");
    expect(all).toEqual(copy);
  });
});

describe("applyFilters", () => {
  it("keeps relevance order for popular with a query", () => {
    const s = [
      skill({ name: "alpha", description: "git helper", stars: 100 }),
      skill({ name: "git-tools", stars: 1 }),
    ];
    expect(names(applyFilters(s, f({ query: "git" })))).toEqual(["git-tools", "alpha"]);
  });
  it("re-sorts by name with a query when asked", () => {
    const s = [skill({ name: "zeta-git" }), skill({ name: "git-tools" })];
    expect(names(applyFilters(s, f({ query: "git", sort: "name" })))).toEqual([
      "git-tools",
      "zeta-git",
    ]);
  });
  it("returns an empty list when nothing matches", () => {
    expect(applyFilters(all, f({ query: "nothing-like-this" }))).toEqual([]);
  });
});

describe("filterOptions", () => {
  it("derives sorted unique aisles and clients", () => {
    expect(filterOptions(all)).toEqual({
      aisles: ["code", "git", "video"],
      clients: ["claude-code", "codex"],
    });
  });
});
