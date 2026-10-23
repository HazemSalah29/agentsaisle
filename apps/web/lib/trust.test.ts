import { describe, expect, it } from "vitest";
import { isUntested } from "./trust";

const tested = {
  model: "m",
  date: "2026-01-01",
  tasks: 30,
  tokenSavingsMedian: 0.4,
  successRate: 0.9,
  baselineSuccessRate: 0.7,
  preferredInBlindTest: 0.6,
};

describe("isUntested", () => {
  it("is true for an official skill with no results", () => {
    expect(isUntested({ source: "official" })).toBe(true);
  });
  it("is false once the skill has results", () => {
    expect(isUntested({ source: "official", tested })).toBe(false);
  });
  it("is false for community skills, which have the Unverified label instead", () => {
    expect(isUntested({ source: "community" })).toBe(false);
  });
});
