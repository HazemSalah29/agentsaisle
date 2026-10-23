import { describe, expect, it } from "vitest";
import { closestMatches, parseSpec } from "./spec.js";

describe("parseSpec", () => {
  it("parses names and versions", () => {
    expect(parseSpec("explore")).toEqual({ kind: "registry", name: "explore", version: undefined });
    expect(parseSpec("explore@1.2.0")).toEqual({
      kind: "registry",
      name: "explore",
      version: "1.2.0",
    });
  });
  it("parses GitHub specs", () => {
    expect(parseSpec("me/repo")).toEqual({
      kind: "github",
      repo: "me/repo",
      path: "",
      ref: undefined,
    });
    expect(parseSpec("me/repo/skills/a/b@v2")).toEqual({
      kind: "github",
      repo: "me/repo",
      path: "skills/a/b",
      ref: "v2",
    });
  });
  it("rejects bad input and path traversal", () => {
    expect(() => parseSpec("Bad_Name")).toThrow(/Invalid skill name/);
    expect(() => parseSpec("me/repo/../x")).toThrow(/Invalid GitHub spec/);
    expect(() => parseSpec("me/")).toThrow(/Invalid GitHub spec/);
  });
});

describe("closestMatches", () => {
  const names = ["explore", "commit", "review", "plan"];
  it("suggests near names", () => {
    expect(closestMatches("explor", names)).toEqual(["explore"]);
    expect(closestMatches("comit", names)).toEqual(["commit"]);
  });
  it("returns nothing for unrelated input", () => {
    expect(closestMatches("zzzzzzzz", names)).toEqual([]);
  });
});
