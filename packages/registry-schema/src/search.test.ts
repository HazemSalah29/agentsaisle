import { describe, expect, it } from "vitest";
import { searchSkills } from "./search";

const s = (name: string, extra: Partial<{ category: string[]; author: string; description: string }> = {}) => ({
  name,
  category: ["code"],
  author: "someone",
  description: "A skill.",
  ...extra,
});
const names = (r: Array<{ name: string }>) => r.map((x) => x.name);

describe("searchSkills", () => {
  const all = [
    s("explore", { description: "Map a codebase." }),
    s("commit", { category: ["code", "git"], description: "Write a git commit." }),
    s("reel-scriptwriter", { category: ["video"], author: "reel-lab", description: "Write video scripts." }),
  ];
  it("returns everything for an empty query", () => {
    expect(searchSkills(all, "  ")).toBe(all);
  });
  it("ranks a name match above a description match", () => {
    expect(names(searchSkills(all, "commit"))[0]).toBe("commit");
  });
  it("matches aisle and author case-insensitively", () => {
    expect(names(searchSkills(all, "VIDEO"))).toEqual(["reel-scriptwriter"]);
    expect(names(searchSkills(all, "reel-lab"))).toEqual(["reel-scriptwriter"]);
  });
  it("requires every word to match", () => {
    expect(names(searchSkills(all, "write video"))).toEqual(["reel-scriptwriter"]);
    expect(searchSkills(all, "write zzz")).toEqual([]);
  });
});
