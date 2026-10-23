import { describe, expect, it } from "vitest";
import { parseFilters, serializeFilters } from "./filter-url";
import { defaultFilters, type Filters } from "./filters";

describe("filter URL round trip", () => {
  it("serializes defaults to an empty string", () => {
    expect(serializeFilters(defaultFilters)).toBe("");
    expect(parseFilters(new URLSearchParams(""))).toEqual(defaultFilters);
  });
  it("round-trips every field", () => {
    const f: Filters = {
      query: "git commit",
      aisles: ["code", "git"],
      clients: ["codex"],
      source: "official",
      verifiedOnly: true,
      hideScripts: true,
      sort: "newest",
    };
    expect(parseFilters(new URLSearchParams(serializeFilters(f)))).toEqual(f);
  });
  it("ignores invalid source and sort values", () => {
    const f = parseFilters(new URLSearchParams("source=evil&sort=random&verified=yes"));
    expect(f.source).toBe("all");
    expect(f.sort).toBe("popular");
    expect(f.verifiedOnly).toBe(false);
  });
  it("omits a blank query", () => {
    expect(serializeFilters({ ...defaultFilters, query: "   " })).toBe("");
  });
});
