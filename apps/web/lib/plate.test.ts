import { describe, expect, it } from "vitest";
import { PLATE_COLS, PLATE_ROWS, aisleColor, plateCells } from "./plate";

describe("plateCells", () => {
  it("is deterministic and differs by name", () => {
    expect(plateCells("explore")).toEqual(plateCells("explore"));
    expect(plateCells("explore")).not.toEqual(plateCells("commit"));
  });
  it("has the right shape, is mirrored, and uses levels 0 to 3", () => {
    const cells = plateCells("explore");
    expect(cells).toHaveLength(PLATE_ROWS);
    for (const row of cells) {
      expect(row).toHaveLength(PLATE_COLS);
      expect(row).toEqual([...row].reverse());
      for (const v of row) expect([0, 1, 2, 3]).toContain(v);
    }
  });
});

describe("aisleColor", () => {
  it("uses the first known aisle", () => {
    expect(aisleColor(["misc", "git", "code"])).toBe("var(--aisle-git)");
  });
  it("falls back to the accent", () => {
    expect(aisleColor(["misc"])).toBe("var(--accent-ink)");
    expect(aisleColor([])).toBe("var(--accent-ink)");
  });
});
