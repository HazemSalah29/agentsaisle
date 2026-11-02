import type { RegistryIndex, RegistrySkill } from "@agentsaisle/registry-schema";
import { describe, expect, it } from "vitest";
import { libraryOfPart, listedSkills, partsOfLibrary, shortDescription } from "./library";

const sk = (name: string, o: Partial<RegistrySkill> = {}) => ({ name, ...o }) as RegistrySkill;
const index = {
  skills: [
    sk("video", { requires: ["video-b", "video-a"] }),
    sk("video-b", { partOf: "video" }),
    sk("video-a", { partOf: "video" }),
    sk("commit"),
  ],
} as unknown as RegistryIndex;

describe("libraries on the site", () => {
  it("lists a library once and hides its parts", () => {
    expect(listedSkills(index.skills).map((s) => s.name)).toEqual(["video", "commit"]);
  });
  it("finds the parts of a library in name order and the library of a part", () => {
    expect(partsOfLibrary(index, index.skills[0]!).map((s) => s.name)).toEqual([
      "video-a",
      "video-b",
    ]);
    expect(partsOfLibrary(index, index.skills[3]!)).toEqual([]);
    expect(libraryOfPart(index, index.skills[1]!)?.name).toBe("video");
    expect(libraryOfPart(index, index.skills[3]!)).toBeUndefined();
  });
  it("shortens a part's description to its first sentence without the library prefix", () => {
    expect(
      shortDescription(
        "Part of the video library, used by the video skill (not run directly). Make captions from timings. Use after voice.",
      ),
    ).toBe("Make captions from timings.");
    expect(shortDescription("x".repeat(300)).length).toBeLessThanOrEqual(140);
  });
});
