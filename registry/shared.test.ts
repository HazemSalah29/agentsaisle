import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const shared = path.join(path.dirname(fileURLToPath(import.meta.url)), "_shared");
const read = (name: string) => readFileSync(path.join(shared, name), "utf8");

// A rough token estimate (4 characters per token), enough to catch a block that has grown too big.
const tokens = (text: string) => Math.ceil(text.length / 4);

describe("registry/_shared", () => {
  it("keeps the house rules block under about 350 tokens", () => {
    expect(tokens(read("house-rules.md"))).toBeLessThanOrEqual(350);
  });

  it("house rules cover every rule the brief lists", () => {
    const text = read("house-rules.md").toLowerCase();
    for (const phrase of [
      "search before",
      "line ranges",
      "only what the task needs",
      "assumption",
      "recap",
      "checks",
      "design.md",
    ]) {
      expect(text).toContain(phrase);
    }
  });

  it("house rules never contain the block markers or an include", () => {
    const text = read("house-rules.md");
    expect(text).not.toContain("agent-aisle:start");
    expect(text).not.toContain("agent-aisle:end");
    expect(text).not.toContain("<!-- include:");
  });

  it("no fragment includes another", () => {
    for (const name of ["house-rules.md", "read-budget.md"])
      expect(read(name)).not.toContain("<!-- include:");
  });
});
