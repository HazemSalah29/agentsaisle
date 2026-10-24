import type { AuditReport } from "@agentsaisle/registry-schema";
import { describe, expect, it } from "vitest";
import { exceeds } from "./audit.js";
import { isPathLike } from "./audit-target.js";

const report = (counts: Partial<AuditReport["counts"]>) =>
  ({ counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0, ...counts } }) as AuditReport;

describe("exceeds (--fail-on)", () => {
  it("compares against the threshold", () => {
    expect(exceeds(report({ high: 1 }), "high")).toBe(true);
    expect(exceeds(report({ high: 1 }), "critical")).toBe(false);
    expect(exceeds(report({ critical: 1 }), "high")).toBe(true);
    expect(exceeds(report({ low: 1 }), "medium")).toBe(false);
    expect(exceeds(report({ low: 1 }), "low")).toBe(true);
  });
  it("ignores info findings and honours none", () => {
    expect(exceeds(report({ info: 5 }), "low")).toBe(false);
    expect(exceeds(report({ critical: 3 }), "none")).toBe(false);
  });
});

describe("isPathLike", () => {
  it("treats only explicit paths as local", () => {
    for (const p of ["./a", "../a", "/a", "~/a", ".", "..", "C:\\a", "C:/a"])
      expect(isPathLike(p)).toBe(true);
    for (const p of ["explore", "explore@1.0.0", "owner/repo", "owner/repo/path@main"])
      expect(isPathLike(p)).toBe(false);
  });
});
