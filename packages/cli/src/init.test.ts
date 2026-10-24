import type { RegistryIndex } from "@agentsaisle/registry-schema";
import { describe, expect, it } from "vitest";
import { resolveProfile } from "./init.js";

const index: RegistryIndex = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  skills: [],
  questions: [],
  aisles: [],
  elsewhere: [],
  profiles: [
    { id: "code", name: "Code", description: "d", skills: ["explore"] },
    { id: "writing", name: "Writing", description: "d", skills: ["edit"] },
  ],
};

describe("resolveProfile", () => {
  it("finds a profile by id", () => {
    expect(resolveProfile(index, "code").name).toBe("Code");
  });
  it("suggests close ids and lists what is available", () => {
    expect(() => resolveProfile(index, "cod")).toThrow(
      /Did you mean: code\?.*Available: code, writing\./,
    );
  });
  it("lists available profiles when nothing is close", () => {
    expect(() => resolveProfile(index, "zzzzzzzz")).toThrow(/Available: code, writing\./);
  });
});
