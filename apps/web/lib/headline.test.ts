import { describe, expect, it } from "vitest";
import { firstSentence, splitHeadline } from "./headline";

describe("splitHeadline", () => {
  it("puts the last sentence in the accent", () => {
    expect(splitHeadline("Say what video you want. Get it made.")).toEqual({
      lines: ["Say what video you want."],
      accent: "Get it made.",
    });
  });
  it("keeps one sentence as plain lines", () => {
    expect(splitHeadline("Find a skill")).toEqual({ lines: ["Find a skill"], accent: "" });
  });
  it("handles three sentences", () => {
    expect(splitHeadline("One. Two. Three!")).toEqual({
      lines: ["One.", "Two."],
      accent: "Three!",
    });
  });
});

describe("firstSentence", () => {
  it("keeps only the first sentence", () => {
    expect(firstSentence("Map a codebase. Use when asked to survey it.")).toBe("Map a codebase.");
  });
  it("cuts a very long sentence at a word", () => {
    const out = firstSentence("word ".repeat(80), 40);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out.endsWith("…")).toBe(true);
  });
  it("returns short text unchanged", () => {
    expect(firstSentence("Short")).toBe("Short");
  });
});
