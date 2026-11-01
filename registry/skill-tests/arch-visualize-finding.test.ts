import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadLib, skillFile } from "./load";

type Model = {
  nodes: {
    id: string;
    label?: string;
    tech?: string;
    role?: string;
    evidence?: { file: string }[];
  }[];
  edges: { id: string; from: string; to: string; protocol?: string; sync?: boolean }[];
  risks?: { id: string; title?: string; nodes: string[] }[];
};
type Hit = { kind: string; id: string; field: string; score: number; nodes: string[] };
type Libs = {
  ArchSearch: { search: (m: Model, q: string, limit?: number) => Hit[] };
  ArchPaths: {
    findPaths: (
      m: Model,
      a: string,
      b: string,
      o?: { maxPaths?: number; maxHops?: number },
    ) => {
      paths: {
        nodes: string[];
        edges: string[];
        hops: number;
        sync: (boolean | null)[];
        asyncCount: number;
      }[];
      truncated: boolean;
    };
  };
  ArchHash: {
    parseHash: (h: string) => Record<string, string | number>;
    buildHash: (s: Record<string, string | number | undefined>) => string;
  };
};
const { ArchSearch, ArchPaths, ArchHash } = loadLib<Libs>("arch-visualize", [
  "assets/lib/search.js",
  "assets/lib/paths.js",
  "assets/lib/hash.js",
]);
const fixture = JSON.parse(
  readFileSync(skillFile("arch-visualize", "evals/fixture-model.json"), "utf8"),
) as Model;
const hostile = JSON.parse(
  readFileSync(skillFile("arch-visualize", "evals/hostile-model.json"), "utf8"),
) as Model;

describe("arch-visualize search", () => {
  it("finds a component by label, technology, id and file path", () => {
    expect(ArchSearch.search(fixture, "orders database")[0]).toMatchObject({
      kind: "node",
      id: "db",
    });
    expect(ArchSearch.search(fixture, "redis")[0]).toMatchObject({ kind: "node", id: "cache" });
    expect(ArchSearch.search(fixture, "docker-compose").some((r) => r.field === "file")).toBe(true);
    expect(ArchSearch.search(fixture, "stripe").map((r) => r.id)).toContain("stripe");
  });

  it("finds connections by protocol and risks by id, with the nodes to highlight", () => {
    const edge = ArchSearch.search(fixture, "tcp").find((r) => r.kind === "edge");
    expect(edge).toBeDefined();
    const risk = fixture.risks![0]!;
    const hit = ArchSearch.search(fixture, risk.id).find((r) => r.kind === "risk");
    expect(hit?.id).toBe(risk.id);
    expect(hit?.nodes).toEqual(risk.nodes);
  });

  it("needs every word to match, ignores case and an empty query, and honours the limit", () => {
    expect(ArchSearch.search(fixture, "")).toEqual([]);
    expect(ArchSearch.search(fixture, "   ")).toEqual([]);
    expect(ArchSearch.search(fixture, "REDIS Session")[0]?.id).toBe("cache");
    expect(ArchSearch.search(fixture, "redis zzzznothing")).toEqual([]);
    expect(ArchSearch.search(fixture, "e", 3).length).toBeLessThanOrEqual(3);
  });

  it("is deterministic and ranks a label that starts with the word first", () => {
    const a = ArchSearch.search(fixture, "s");
    expect(JSON.stringify(ArchSearch.search(fixture, "s"))).toBe(JSON.stringify(a));
    const starts = ArchSearch.search(fixture, "stor");
    expect(starts[0]?.id).toBe("web");
  });

  it("returns hostile text as data and does not choke on markup in a query", () => {
    expect(() => ArchSearch.search(hostile, "<img src=x onerror=1>")).not.toThrow();
    expect(() => ArchSearch.search(hostile, "[")).not.toThrow();
  });
});

describe("arch-visualize path trace", () => {
  const model: Model = {
    nodes: ["a", "b", "c", "d", "e"].map((id) => ({ id })),
    edges: [
      { id: "a-b", from: "a", to: "b", sync: true },
      { id: "b-c", from: "b", to: "c", sync: false },
      { id: "a-c", from: "a", to: "c" },
      { id: "c-d", from: "c", to: "d", sync: true },
      { id: "d-a", from: "d", to: "a", sync: true }, // a cycle back
      { id: "a-c-2", from: "a", to: "c", sync: true }, // a parallel connection
    ],
  };

  it("lists every directed path, shortest first, once per connection", () => {
    const r = ArchPaths.findPaths(model, "a", "d");
    expect(r.truncated).toBe(false);
    expect(r.paths.map((p) => p.edges.join(">"))).toEqual(["a-c>c-d", "a-c-2>c-d", "a-b>b-c>c-d"]);
    expect(r.paths.map((p) => p.hops)).toEqual([2, 2, 3]);
  });

  it("marks sync and async segments", () => {
    const via = ArchPaths.findPaths(model, "a", "d").paths.find((p) => p.edges[0] === "a-b")!;
    expect(via.sync).toEqual([true, false, true]);
    expect(via.asyncCount).toBe(1);
    expect(ArchPaths.findPaths(model, "a", "d").paths[0]!.sync).toEqual([null, true]);
  });

  it("never visits a component twice, so a cycle does not loop", () => {
    const r = ArchPaths.findPaths(model, "a", "a");
    expect(r.paths).toEqual([]);
    for (const p of ArchPaths.findPaths(model, "d", "c").paths)
      expect(new Set(p.nodes).size).toBe(p.nodes.length);
  });

  it("follows the direction of the connections and copes with unknown or unreachable ends", () => {
    expect(ArchPaths.findPaths(model, "d", "e").paths).toEqual([]);
    expect(ArchPaths.findPaths(model, "c", "b").paths.length).toBe(1); // c-d, d-a, a-b
    expect(ArchPaths.findPaths(model, "nope", "a").paths).toEqual([]);
    expect(ArchPaths.findPaths(model, "a", "nope").paths).toEqual([]);
  });

  it("honours the hop and path limits and says when the list is cut short", () => {
    expect(ArchPaths.findPaths(model, "a", "d", { maxHops: 2 }).paths.length).toBe(2);
    const cut = ArchPaths.findPaths(model, "a", "d", { maxPaths: 2 });
    expect(cut.paths.length).toBe(2);
    expect(cut.truncated).toBe(true);
  });

  it("works on the fixture", () => {
    const r = ArchPaths.findPaths(fixture, "web", "db");
    expect(r.paths.length).toBeGreaterThan(0);
    expect(r.paths[0]!.nodes[0]).toBe("web");
    expect(r.paths[0]!.nodes.at(-1)).toBe("db");
  });
});

describe("arch-visualize deep links", () => {
  it("round-trips a view", () => {
    const state = {
      lens: "failure",
      node: "redis",
      flow: "login",
      step: 3,
      x: 12.5,
      y: -40,
      k: 1.25,
    };
    const link = ArchHash.buildHash(state);
    expect(link.startsWith("#lens=failure&node=redis")).toBe(true);
    expect(ArchHash.parseHash(link)).toEqual(state);
  });

  it("drops unknown keys, bad ids, unknown lenses and non-numbers", () => {
    expect(ArchHash.parseHash("#node=Bad Id&lens=party&evil=1&k=abc&step=x")).toEqual({});
    expect(ArchHash.parseHash("#node=<script>&edge=a b")).toEqual({});
    expect(ArchHash.parseHash("#node=ok&node=second")).toEqual({ node: "ok" });
    expect(ArchHash.parseHash("#=&&a&node=%E0%A4%A")).toEqual({});
  });

  it("clamps numbers to a sane range", () => {
    expect(ArchHash.parseHash("#k=99&x=99999999&y=-99999999&step=5000")).toEqual({
      k: 3,
      x: 100000,
      y: -100000,
      step: 999,
    });
    expect(ArchHash.parseHash("#k=0")).toEqual({ k: 0.2 });
  });

  it("builds nothing for an empty or invalid state and uses a fixed key order", () => {
    expect(ArchHash.buildHash({})).toBe("");
    expect(ArchHash.buildHash({ node: "Bad Id", lens: "nope" })).toBe("");
    expect(ArchHash.buildHash({ k: 1, node: "a", lens: "system" })).toBe("#lens=system&node=a&k=1");
  });

  it("accepts the empty and missing hash", () => {
    expect(ArchHash.parseHash("")).toEqual({});
    expect(ArchHash.parseHash("#")).toEqual({});
    expect(ArchHash.parseHash(undefined as unknown as string)).toEqual({});
  });
});
