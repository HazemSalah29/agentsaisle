import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadLib, skillFile } from "./load";

type Rect = { x: number; y: number; w: number; h: number };
type Item = { id: string; tier?: string; group?: string; from?: string; to?: string };
type Model = {
  nodes: Item[];
  edges: (Item & { protocol?: string })[];
  groups?: { id: string; label?: string; parent?: string }[];
};
type Result = {
  pos: Record<string, Rect & { layer: number }>;
  layers: { tier: string; x: number; nodes: string[] }[];
  routes: Record<string, { points: number[][]; d: string }>;
  groups: (Rect & { id: string; parent: string | null })[];
  labels: Record<string, Rect>;
  size: { w: number; h: number };
  stats: { crossings: number; dummies: number; labelsPlaced: number; labelsOmitted: number };
};
type Lib = {
  ArchGeometry: {
    rectsOverlap: (a: Rect, b: Rect, gap?: number) => boolean;
    rectInside: (a: Rect, b: Rect) => boolean;
    segmentCross: (a: number[], b: number[], c: number[], d: number[]) => number[] | null;
    segmentHitsRect: (a: number[], b: number[], r: Rect, inset?: number) => boolean;
    polylineCrossings: (l: number[][][], o?: { endTolerance?: number }) => number;
    edgesThroughNodes: (r: Record<string, number[][]>, n: Record<string, Rect>) => string[];
    simplify: (p: number[][]) => number[][];
    roundedPath: (p: number[][], r?: number) => string;
    hash: (s: string) => string;
  };
  ArchLayout: {
    layout: (m: Model, o?: Record<string, unknown>) => Result;
    layoutHash: (r: Result) => string;
    mirror: (r: Result) => Result;
  };
};

const lib = loadLib<Lib>("arch-visualize", ["assets/lib/geometry.js", "assets/lib/layout.js"]);
const G = lib.ArchGeometry;
const { layout, layoutHash, mirror } = lib.ArchLayout;
const readJson = (rel: string) =>
  JSON.parse(readFileSync(skillFile("arch-visualize", rel), "utf8")) as Model;

const MODELS: Record<string, Model> = {
  fixture: readJson("evals/fixture-model.json"),
  "fixture v2": readJson("evals/fixture-model-v2.json"),
  devpath: readJson("evals/demo/devpath.architecture.json"),
  hostile: readJson("evals/hostile-model.json"),
};

/** A seeded pseudo-random graph: n nodes over the tiers, m edges, some in groups. */
function synthetic(n: number, m: number): Model {
  let seed = 12345;
  const rnd = (k: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % k;
  };
  const tiers = ["clients", "edge", "frontend", "backend", "async", "data", "external"];
  const nodes: Item[] = [];
  for (let i = 0; i < n; i++)
    nodes.push({
      id: `n${String(i).padStart(3, "0")}`,
      tier: tiers[rnd(tiers.length)],
      ...(i % 3 === 0 ? { group: `g${i % 4}` } : {}),
    });
  const edges: Model["edges"] = [];
  for (let i = 0; i < m; i++) {
    const a = nodes[rnd(n)]!;
    const b = nodes[rnd(n)]!;
    edges.push({ id: `e${String(i).padStart(3, "0")}`, from: a.id, to: b.id, protocol: "HTTP" });
  }
  return {
    nodes,
    edges,
    groups: [0, 1, 2, 3].map((i) => ({ id: `g${i}`, label: `Group ${i}` })),
  };
}

const rectOf = (r: Result, id: string): Rect => r.pos[id]!;
const allModels = (): [string, Model][] => [
  ...Object.entries(MODELS),
  ["synthetic 150/300", synthetic(150, 300)],
];

describe("arch-visualize geometry", () => {
  it("finds a proper crossing and ignores touching ends and parallel lines", () => {
    expect(G.segmentCross([0, 0], [10, 10], [0, 10], [10, 0])).toEqual([5, 5]);
    expect(G.segmentCross([0, 0], [10, 0], [10, 0], [20, 5])).toBeNull();
    expect(G.segmentCross([0, 0], [10, 0], [0, 5], [10, 5])).toBeNull();
  });

  it("counts crossings between polylines, not near their ends", () => {
    const a = [
      [0, 0],
      [100, 100],
    ];
    const b = [
      [0, 100],
      [100, 0],
    ];
    expect(G.polylineCrossings([a, b])).toBe(1);
    expect(G.polylineCrossings([a, b], { endTolerance: 60 })).toBe(0);
    expect(G.polylineCrossings([a, a])).toBe(0);
  });

  it("detects a segment through a box but not one that only touches it", () => {
    const box = { x: 10, y: 10, w: 20, h: 20 };
    expect(G.segmentHitsRect([0, 20], [40, 20], box)).toBe(true);
    expect(G.segmentHitsRect([0, 10], [40, 10], box)).toBe(false);
    expect(G.segmentHitsRect([0, 50], [40, 50], box)).toBe(false);
    expect(
      G.edgesThroughNodes(
        {
          e: [
            [0, 20],
            [40, 20],
          ],
        },
        { n: box },
      ),
    ).toEqual(["e"]);
  });

  it("rects: overlap needs real overlap, inside allows touching", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(G.rectsOverlap(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(G.rectsOverlap(a, { x: 9, y: 0, w: 5, h: 5 })).toBe(true);
    expect(G.rectInside({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(true);
  });

  it("simplifies straight runs and rounds corners within half a side", () => {
    expect(
      G.simplify([
        [0, 0],
        [5, 0],
        [10, 0],
        [10, 10],
      ]),
    ).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    const d = G.roundedPath(
      [
        [0, 0],
        [20, 0],
        [20, 4],
        [40, 4],
      ],
      8,
    );
    expect(d.startsWith("M0 0")).toBe(true);
    expect(d).toContain("Q20 0 20 2"); // radius clipped to half of the 4 px side
    expect(G.hash("a")).toMatch(/^[0-9a-f]{8}$/);
    expect(G.hash("a")).not.toBe(G.hash("b"));
  });
});

describe("arch-visualize layout", () => {
  for (const [name, model] of allModels()) {
    describe(name, () => {
      const r = layout(model);
      const ids = model.nodes.map((n) => n.id);

      it("places every node and no two boxes overlap", () => {
        expect(Object.keys(r.pos).sort()).toEqual([...ids].sort());
        for (let i = 0; i < ids.length; i++)
          for (let j = i + 1; j < ids.length; j++)
            expect(
              G.rectsOverlap(rectOf(r, ids[i]!), rectOf(r, ids[j]!)),
              `${ids[i]} ${ids[j]}`,
            ).toBe(false);
      });

      it("keeps groups around their members and nobody else", () => {
        for (const g of r.groups) {
          for (const n of model.nodes) {
            const inside = G.rectsOverlap(rectOf(r, n.id), g);
            const member = memberOf(model, n.id, g.id);
            if (member) expect(G.rectInside(rectOf(r, n.id), g), `${n.id} in ${g.id}`).toBe(true);
            else expect(inside, `${n.id} outside ${g.id}`).toBe(false);
          }
          if (g.parent) {
            const p = r.groups.find((x) => x.id === g.parent)!;
            expect(G.rectInside(g, p)).toBe(true);
          }
        }
      });

      it("routes only with horizontal and vertical segments", () => {
        for (const [id, route] of Object.entries(r.routes))
          for (let i = 0; i + 1 < route.points.length; i++) {
            const [a, b] = [route.points[i]!, route.points[i + 1]!];
            expect(a[0] === b[0] || a[1] === b[1], `${id} segment ${i}`).toBe(true);
          }
      });

      it("never runs an edge through a box", () => {
        const lines = Object.fromEntries(Object.entries(r.routes).map(([k, v]) => [k, v.points]));
        const rects = Object.fromEntries(ids.map((id) => [id, rectOf(r, id)]));
        expect(G.edgesThroughNodes(lines, rects)).toEqual([]);
      });

      it("starts and ends edges on the side of their boxes", () => {
        for (const e of model.edges) {
          const route = r.routes[e.id]!;
          const a = route.points[0]!;
          const b = route.points[route.points.length - 1]!;
          const onSide = (p: number[], id: string) => {
            const box = rectOf(r, id);
            return (
              (p[0] === box.x || p[0] === box.x + box.w) && p[1]! >= box.y && p[1]! <= box.y + box.h
            );
          };
          expect(onSide(a, e.from!), `${e.id} start`).toBe(true);
          expect(onSide(b, e.to!), `${e.id} end`).toBe(true);
        }
      });

      it("places labels clear of boxes and of each other", () => {
        const labels = Object.entries(r.labels);
        for (const [id, l] of labels) {
          for (const n of ids) expect(G.rectsOverlap(l, rectOf(r, n)), `${id} ${n}`).toBe(false);
        }
        for (let i = 0; i < labels.length; i++)
          for (let j = i + 1; j < labels.length; j++)
            expect(G.rectsOverlap(labels[i]![1], labels[j]![1])).toBe(false);
      });

      it("stays inside its reported size", () => {
        for (const id of ids) {
          const b = rectOf(r, id);
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.y).toBeGreaterThanOrEqual(0);
          expect(b.x + b.w).toBeLessThanOrEqual(r.size.w);
          expect(b.y + b.h).toBeLessThanOrEqual(r.size.h);
        }
      });
    });
  }

  it("is deterministic: same input, same result and hash", () => {
    for (const [, model] of allModels()) {
      const a = layout(model);
      const b = layout(model);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(layoutHash(a)).toBe(layoutHash(b));
    }
  });

  it("does not depend on the order of nodes and edges, and does not change its input", () => {
    for (const [, model] of allModels()) {
      const copy = JSON.stringify(model);
      const shuffled: Model = {
        ...model,
        nodes: [...model.nodes].reverse(),
        edges: [...model.edges].reverse(),
        groups: model.groups ? [...model.groups].reverse() : undefined,
      };
      expect(layoutHash(layout(shuffled))).toBe(layoutHash(layout(model)));
      expect(JSON.stringify(model)).toBe(copy);
    }
  });

  it("keeps a pinned layout for the fixture", () => {
    expect(layoutHash(layout(MODELS.fixture!))).toBe("ba08529d");
    expect(layoutHash(layout(MODELS["fixture v2"]!))).toBe("a9ba4d2f");
    expect(layoutHash(layout(MODELS.devpath!))).toBe("a07378d6");
  });

  it("lays out 150 nodes and 300 edges in under 300 ms", () => {
    const model = synthetic(150, 300);
    layout(model); // warm up the engine
    const t = performance.now();
    layout(model);
    expect(performance.now() - t).toBeLessThan(300);
  });

  it("crosses less than the 0.1.1 layout did (9 on the fixture, 26 on DevPath)", () => {
    expect(layout(MODELS.fixture!).stats.crossings).toBeLessThanOrEqual(9);
    expect(layout(MODELS.devpath!).stats.crossings).toBeLessThanOrEqual(26);
  });

  it("copes with odd input", () => {
    expect(layout({ nodes: [], edges: [] }).size.w).toBeGreaterThan(0);
    const one = layout({ nodes: [{ id: "a", tier: "backend" }], edges: [] });
    expect(Object.keys(one.pos)).toEqual(["a"]);
    const odd = layout({
      nodes: [
        { id: "a", tier: "backend" },
        { id: "b", tier: "backend" },
        { id: "c", tier: "data" },
        { id: "d", tier: "mystery" },
      ],
      edges: [
        { id: "self", from: "a", to: "a" },
        { id: "same", from: "a", to: "b", protocol: "RPC" },
        { id: "back", from: "c", to: "a" },
        { id: "cycle", from: "a", to: "c" },
        { id: "dangling", from: "a", to: "nope" },
      ],
    });
    expect(Object.keys(odd.routes).sort()).toEqual(["back", "cycle", "same", "self"]);
    expect(odd.pos.d!.layer).toBeGreaterThan(odd.pos.c!.layer);
    const back = odd.routes.back!.points;
    // a reversed edge is drawn from its real source: it ends on the right side of the earlier column
    expect(back[back.length - 1]![0]).toBe(odd.pos.a!.x + odd.pos.a!.w);
    const lines = Object.fromEntries(Object.entries(odd.routes).map(([k, v]) => [k, v.points]));
    const rects = Object.fromEntries(Object.entries(odd.pos).map(([k, v]) => [k, v as Rect]));
    expect(G.edgesThroughNodes(lines, rects)).toEqual([]);
  });

  it("handles nested groups and an unknown group id", () => {
    const m: Model = {
      nodes: [
        { id: "a", tier: "backend", group: "inner" },
        { id: "b", tier: "data", group: "outer" },
        { id: "c", tier: "data", group: "ghost" },
        { id: "d", tier: "frontend" },
      ],
      edges: [
        { id: "d-a", from: "d", to: "a" },
        { id: "a-b", from: "a", to: "b" },
        { id: "a-c", from: "a", to: "c" },
      ],
      groups: [
        { id: "outer", label: "Outer" },
        { id: "inner", label: "Inner", parent: "outer" },
      ],
    };
    const r = layout(m);
    const inner = r.groups.find((g) => g.id === "inner")!;
    const outer = r.groups.find((g) => g.id === "outer")!;
    expect(G.rectInside(inner, outer)).toBe(true);
    expect(G.rectInside(rectOf(r, "a"), inner)).toBe(true);
    expect(G.rectInside(rectOf(r, "b"), outer)).toBe(true);
    expect(G.rectsOverlap(rectOf(r, "c"), outer)).toBe(false);
    expect(G.rectsOverlap(rectOf(r, "d"), outer)).toBe(false);
  });
});

describe("arch-visualize mirrored layout", () => {
  it("reflects x, keeps y, and mirroring twice gives the original", () => {
    for (const [, model] of allModels()) {
      const r = layout(model);
      const m = mirror(r);
      const copy = JSON.stringify(r);
      expect(JSON.stringify(mirror(m))).toBe(copy);
      expect(JSON.stringify(r)).toBe(copy);
      for (const id of Object.keys(r.pos)) {
        expect(m.pos[id]!.y).toBe(r.pos[id]!.y);
        expect(m.pos[id]!.x + m.pos[id]!.w).toBe(r.size.w - r.pos[id]!.x);
      }
    }
  });

  it("keeps the rules: no overlaps, right angles, no edge through a box", () => {
    for (const [, model] of allModels()) {
      const m = mirror(layout(model));
      const ids = model.nodes.map((n) => n.id);
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++)
          expect(G.rectsOverlap(rectOf(m, ids[i]!), rectOf(m, ids[j]!))).toBe(false);
      const lines = Object.fromEntries(Object.entries(m.routes).map(([k, v]) => [k, v.points]));
      const rects = Object.fromEntries(ids.map((id) => [id, rectOf(m, id)]));
      expect(G.edgesThroughNodes(lines, rects)).toEqual([]);
      for (const route of Object.values(m.routes))
        for (let i = 0; i + 1 < route.points.length; i++)
          expect(
            route.points[i]![0] === route.points[i + 1]![0] ||
              route.points[i]![1] === route.points[i + 1]![1],
          ).toBe(true);
    }
  });
});

describe("arch-visualize layout files", () => {
  it("are plain browser scripts with no DOM, network, timers or script tags", () => {
    for (const f of readdirSync(skillFile("arch-visualize", "assets/lib")).filter((n) =>
      n.endsWith(".js"),
    )) {
      const src = readFileSync(skillFile("arch-visualize", `assets/lib/${f}`), "utf8");
      expect(src, f).not.toMatch(
        /\b(document|window|fetch|XMLHttpRequest|setTimeout|setInterval|requestAnimationFrame|eval|import|require)\b\s*[(.]|<\/script|https?:\/\/|\bnew Function\b/,
      );
      expect(src, f).not.toMatch(/\bexport\b/);
    }
  });
});

/** True when the node is in the group or in one of its sub-groups. */
function memberOf(model: Model, nodeId: string, groupId: string): boolean {
  const byId = Object.fromEntries((model.groups ?? []).map((g) => [g.id, g]));
  let gid = model.nodes.find((n) => n.id === nodeId)?.group;
  for (let hops = 0; gid && byId[gid] && hops < 20; hops++) {
    if (gid === groupId) return true;
    gid = byId[gid]!.parent;
  }
  return false;
}
