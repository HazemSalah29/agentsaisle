import { describe, expect, it } from "vitest";
import { badgeMarkdown } from "./badge";

describe("badgeMarkdown", () => {
  it("builds a shields.io endpoint badge that links back to the skill page", () => {
    expect(badgeMarkdown("https://example.com/", "arabic-rtl")).toBe(
      "[![aisle audit](https://img.shields.io/endpoint?url=https%3A%2F%2Fexample.com%2Fbadges%2Farabic-rtl.json)](https://example.com/skills/arabic-rtl)",
    );
  });
});
