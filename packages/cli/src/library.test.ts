import type { RegistryIndex } from "@agentsaisle/registry-schema";
import { describe, expect, it } from "vitest";
import { expandLibraries, libraryOf, partsOf } from "./library.js";

const index = {
  skills: [
    { name: "video", requires: ["video-a", "video-b"] },
    { name: "video-a", partOf: "video" },
    { name: "video-b", partOf: "video" },
    { name: "plain" },
  ],
} as unknown as RegistryIndex;

describe("libraries", () => {
  it("puts the parts before the library and says what the library needs", () => {
    expect(expandLibraries(["video"], index)).toEqual([
      { input: "video-a", needs: [] },
      { input: "video-b", needs: [] },
      { input: "video", needs: ["video-a", "video-b"] },
    ]);
  });
  it("keeps other inputs in order, installs nothing twice and leaves GitHub specs alone", () => {
    const steps = expandLibraries(["plain", "video-a", "video", "o/r/path", "plain"], index);
    expect(steps.map((s) => s.input)).toEqual(["plain", "video-a", "video-b", "video", "o/r/path"]);
  });
  it("finds a library from name@version and ignores unknown or direct installs", () => {
    expect(libraryOf(index, "video@1.2.3")?.name).toBe("video");
    expect(libraryOf(index, "plain")).toBeUndefined();
    expect(libraryOf(index, "nope")).toBeUndefined();
    expect(libraryOf(index, "owner/repo")).toBeUndefined();
    expect(partsOf(index, "video")).toEqual(["video-a", "video-b"]);
    expect(partsOf(undefined, "video")).toEqual([]);
  });
});
