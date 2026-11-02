import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const scenes = () =>
  loadScript<{
    renderScene: (s: Loose, c: Loose) => { html: string; plan: Loose[] };
    KINDS: string[];
  }>("video-core", "assets/engine/hyperframes/scenes.mjs");
const dg = () => loadScript<Loose>("video-core", "assets/engine/hyperframes/diagrams.mjs");
const W = (text: string, start: number) => ({ text, start, end: start + 0.3, line: "l1" });
const words = [
  W("Requests", 0.3),
  W("arrive", 0.7),
  W("then", 1.2),
  W("we", 1.4),
  W("check", 1.6),
  W("limits", 2.0),
  W("block", 3.0),
  W("bots", 3.3),
  W("and", 3.8),
  W("log", 4.2),
];
const ctx = (o: Loose = {}) => ({
  prefix: "sc-a",
  at: 10,
  seconds: 8,
  lines: [],
  lang: "en",
  first: false,
  rise: 24,
  assets: new Map(),
  words,
  ...o,
});
const at = (plan: Loose[], id: string) => plan.find((p) => p.id === id)?.at;

const GOOD: Record<string, Loose> = {
  number: { value: 94.5, unit: "%", label: "of requests pass" },
  callout: { stat: "3x", label: "faster than before", note: "measured on one laptop" },
  versus: {
    title: "Two ways",
    left: { title: "Fixed window", points: ["Simple", "Bursty at edges"] },
    right: { title: "Token bucket", points: ["Smooth", "Allows bursts"] },
    verdict: "Pick smooth",
  },
  steps: {
    title: "How",
    steps: [
      { label: "Requests arrive" },
      { label: "Check limits", detail: "per key" },
      { label: "Block bots" },
    ],
  },
  cycle: { title: "Loop", nodes: ["Request", "Check", "Block", "Log"], center: "Gateway" },
  funnel: {
    stages: [
      { label: "Requests", value: "1,000" },
      { label: "Checked" },
      { label: "Allowed", value: "940" },
    ],
  },
  matrix: {
    x: { low: "Cheap", high: "Costly" },
    y: { low: "Slow", high: "Fast" },
    items: [
      { label: "Cache", x: 0.2, y: 0.8 },
      { label: "Queue", x: 0.7, y: 0.4 },
    ],
  },
  nodes: {
    nodes: [
      { id: "a", label: "Client" },
      { id: "b", label: "Gateway" },
      { id: "c", label: "Service" },
      { id: "d", label: "Log" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "b", to: "d" },
    ],
  },
};

describe("diagram scenes", () => {
  it("are registered and valid", async () => {
    const { KINDS } = await scenes();
    const { diagramProblems, DIAGRAM_KINDS } = await dg();
    for (const k of DIAGRAM_KINDS) {
      expect(KINDS).toContain(k);
      expect(diagramProblems(k, GOOD[k]), k).toEqual([]);
    }
    expect(DIAGRAM_KINDS).toHaveLength(8);
  });
  it("draw every kind, with every animation pointing at an element in the markup", async () => {
    const { renderScene } = await scenes();
    for (const [kind, props] of Object.entries(GOOD)) {
      const { html, plan } = renderScene({ id: "s", kind, props }, ctx());
      expect(plan.length, kind).toBeGreaterThan(1);
      for (const p of plan) {
        expect(html, `${kind}: ${p.id}`).toContain(`id="${p.id}"`);
        expect(p.at, `${kind}: ${p.id}`).toBeGreaterThanOrEqual(10);
        expect(p.at, `${kind}: ${p.id}`).toBeLessThanOrEqual(18);
        expect(p.frames.length).toBeGreaterThanOrEqual(2);
      }
      const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size, `${kind}: duplicate ids`).toBe(ids.length);
    }
  });
  it("bring steps, funnel stages, nodes and matrix items in on their words, in order", async () => {
    const { renderScene } = await scenes();
    const s = renderScene({ id: "s", kind: "steps", props: GOOD.steps }, ctx());
    expect(at(s.plan, "sc-a-s0")).toBeCloseTo(10.3 - 0.06); // "requests"
    expect(at(s.plan, "sc-a-s1")).toBeCloseTo(11.6 - 0.06); // "check"
    expect(at(s.plan, "sc-a-s2")).toBeCloseTo(13.0 - 0.06); // "block"
    const f = renderScene({ id: "s", kind: "funnel", props: GOOD.funnel }, ctx());
    const t = ["sc-a-f0", "sc-a-f1", "sc-a-f2"].map((id) => at(f.plan, id));
    expect(t).toEqual([...t].sort((a, b) => a - b));
    const m = renderScene({ id: "s", kind: "matrix", props: GOOD.matrix }, ctx());
    expect(m.html).toContain("left:");
  });
  it("spaces things evenly with no voice", async () => {
    const { renderScene } = await scenes();
    const { plan } = renderScene({ id: "s", kind: "steps", props: GOOD.steps }, ctx({ words: [] }));
    const t = [0, 1, 2].map((i) => at(plan, `sc-a-s${i}`));
    expect(t[0]).toBeGreaterThanOrEqual(10);
    expect(t[1]).toBeGreaterThan(t[0]);
    expect(t[2]).toBeGreaterThan(t[1]);
  });
  it("counts a number up to exactly the value given, once, and shows it at the end", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene({ id: "s", kind: "number", props: GOOD.number }, ctx());
    const shown = [...html.matchAll(/class="num-step">([^<]*)</g)].map((m) => m[1]);
    expect(shown).toHaveLength(11);
    expect(shown[0]).toBe("0.0");
    expect(shown.at(-1)).toBe("94.5");
    const nums = shown.map(Number);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    // the last value is never hidden again
    expect(plan.find((p) => p.id === "sc-a-n10w")).toBeUndefined();
    expect(plan.find((p) => p.id === "sc-a-n9w")).toBeTruthy();
  });
  it("rejects bad props with a readable reason", async () => {
    const { diagramProblems } = await dg();
    expect(diagramProblems("number", { value: "9", label: "x" })[0]).toContain("value");
    expect(diagramProblems("steps", { steps: [{ label: "one" }] })[0]).toContain("steps");
    expect(
      diagramProblems("matrix", { ...GOOD.matrix, items: [{ label: "a", x: 2, y: 0 }] })[0],
    ).toContain("x");
    expect(
      diagramProblems("nodes", { ...GOOD.nodes, edges: [{ from: "a", to: "zzz" }] })[0],
    ).toContain("edges[0]");
    expect(
      diagramProblems("versus", { left: { title: "a", points: [] }, right: GOOD.versus.right })[0],
    ).toContain("left.points");
    expect(diagramProblems("callout", { stat: "x".repeat(20), label: "l" })[0]).toContain("stat");
  });
  it("escapes hostile text in every kind", async () => {
    const { renderScene } = await scenes();
    const bad = "<img src=x onerror=alert(1)>";
    const hostile: Record<string, Loose> = {
      number: { ...GOOD.number, label: bad, unit: bad.slice(0, 12) },
      callout: { stat: "<b>1", label: bad, note: bad },
      versus: { ...GOOD.versus, title: bad, left: { title: bad, points: [bad] } },
      steps: { steps: [{ label: bad, detail: bad }, { label: bad }] },
      cycle: { nodes: [bad, bad, bad], center: bad },
      funnel: { stages: [{ label: bad, value: bad.slice(0, 16) }, { label: bad }, { label: bad }] },
      matrix: {
        ...GOOD.matrix,
        x: { low: bad.slice(0, 24), high: "h" },
        items: [{ label: bad, x: 0.5, y: 0.5 }],
      },
      nodes: {
        nodes: [
          { id: "a", label: bad },
          { id: "b", label: bad },
        ],
        edges: [{ from: "a", to: "b" }],
      },
    };
    for (const [kind, props] of Object.entries(hostile)) {
      const { html } = renderScene({ id: "s", kind, props }, ctx());
      expect(html, kind).not.toContain("<img");
      expect(html, kind).not.toContain("<b>1");
    }
  });
  it("lay nodes in layers from their edges, even when they form a loop", async () => {
    const { renderScene } = await scenes();
    const { html } = renderScene(
      {
        id: "s",
        kind: "nodes",
        props: {
          nodes: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
          edges: [
            { from: "a", to: "b" },
            { from: "b", to: "a" },
          ],
        },
      },
      ctx(),
    );
    expect(html).toContain("nd-node");
  });
});

describe("the scene catalog and the docs", () => {
  const read = (...p: string[]) =>
    readFileSync(path.join(__dirname, "..", "official", ...p), "utf8");
  it("lists every idea kind with phrases and props that pass the validator", async () => {
    const { diagramProblems, DIAGRAM_KINDS } = await dg();
    const cat = JSON.parse(read("video-core", "assets", "scene-catalog.json"));
    for (const k of DIAGRAM_KINDS) {
      expect(cat.kinds[k], k).toBeTruthy();
      expect(cat.kinds[k].use_when.length, k).toBeGreaterThanOrEqual(3);
    }
    // the example props in the catalog are the shape to copy: real kinds with filled values must pass
    for (const k of ["number", "callout", "steps", "cycle", "funnel", "nodes"])
      expect(diagramProblems(k, cat.kinds[k].props), k).toEqual([]);
  });
  it("documents every kind in the schema, scene-kinds.md and video-write", async () => {
    const { DIAGRAM_KINDS } = await dg();
    const schema = read("video-core", "assets", "video.schema.json");
    const docs = read("video-core", "references", "scene-kinds.md");
    const write = read("video-write", "scripts", "write-check.mjs");
    for (const k of DIAGRAM_KINDS) {
      expect(schema, k).toContain(`"${k}"`);
      expect(docs, k).toContain(`\`${k}\``);
      expect(write, k).toContain(`"${k}"`);
    }
  });
});
