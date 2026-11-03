import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Scenes = { renderScene: (scene: Loose, ctx: Loose) => { html: string; plan: Loose[] } };
type Imp = { importFlow: (m: unknown, id: string) => Loose; flowIds: (m: unknown) => string[] };
type Flow = { flowProblems: (p: Loose) => string[] };
const scenes = () => loadScript<Scenes>("video-core", "assets/engine/hyperframes/scenes.mjs");
const imp = () => loadScript<Imp>("video-core", "assets/arch/import.mjs");
const flow = () => loadScript<Flow>("video-core", "assets/engine/hyperframes/request-flow.mjs");
const model = () =>
  JSON.parse(readFileSync(skillFile("arch-visualize", "evals/fixture-model.json"), "utf8"));

const ctx = (o: Record<string, unknown> = {}) => ({
  prefix: "sc-a",
  at: 1,
  seconds: 12,
  lines: [],
  lang: "en",
  first: false,
  rise: 24,
  assets: new Map(),
  ...o,
});

describe("arch import", () => {
  it("keeps only what the flow touches, with labels and file:line evidence from the model", async () => {
    const { importFlow } = await imp();
    const props = importFlow(model(), "load-profile");
    expect(props.title).toBe("User loads their profile");
    expect(props.nodes.map((n: Loose) => n.id).sort()).toEqual(["api", "cache", "db", "web"]);
    expect(props.edges.map((e: Loose) => e.id).sort()).toEqual(["api-cache", "api-db", "web-api"]);
    expect(props.steps).toHaveLength(7);
    expect(props.steps[0]).toMatchObject({
      edge: "web-api",
      label: "GET /api/me",
      evidence: "docker-compose.yml:7",
    });
    expect(props.steps[2]).toEqual({ event: "cache-miss", node: "cache" });
    expect(props.steps[4]).toMatchObject({ edge: "api-db", reverse: true });
    expect(props.shown).toEqual({ nodes: 4, of: 9 });
    // nothing that is not in the model: no ms, no invented labels
    expect(JSON.stringify(props)).not.toContain('"ms"');
  });

  it("explains a missing flow, a bad model and a dangling step", async () => {
    const { importFlow } = await imp();
    expect(() => importFlow(model(), "nope")).toThrow(/No flow "nope".*load-profile/);
    expect(() => importFlow({ version: 9 }, "x")).toThrow(/arch-visualize model/);
    const m = model();
    m.flows[0].steps.push({ edge: "ghost" });
    expect(() => importFlow(m, "load-profile")).toThrow(/"ghost"/);
  });

  it("strips control and bidi characters from labels", async () => {
    const { importFlow } = await imp();
    // Built from char codes so no bidi control character sits in this file.
    const bad = (t: string) => `${t}${String.fromCharCode(7, 0x202e, 0)}`;
    const m = model();
    m.nodes[0].label = bad("Vercel");
    m.flows[0].steps[0].label = bad("GET /x");
    const props = importFlow(m, "load-profile");
    for (const ch of JSON.stringify(props)) {
      const c = ch.charCodeAt(0);
      expect(c < 32 || (c >= 0x202a && c <= 0x202e)).toBe(false);
    }
    expect(props.steps[0].label).toBe("GET /x");
  });
});

describe("request-flow scene", () => {
  it("draws the components and one packet, highlight and caption per step", async () => {
    const { importFlow } = await imp();
    const { renderScene } = await scenes();
    const props = importFlow(model(), "load-profile");
    const r = renderScene({ kind: "request-flow", props }, ctx());
    expect(r.html.match(/class="nb"/g)).toHaveLength(4);
    expect(r.html.match(/class="cn"/g)).toHaveLength(3);
    expect(r.html).toContain("GET /api/me");
    expect(r.html).toContain("docker-compose.yml:7");
    expect(r.html).toContain("4 of 9 components shown");
    expect(r.plan.filter((p) => /-s\d+-p$/.test(p.id))).toHaveLength(7);
    // steps play in order and each caption lasts until the next
    const caps = r.plan.filter((p) => /-s\d+-c$/.test(p.id));
    expect(caps.map((c) => c.at)).toEqual([...caps.map((c) => c.at)].sort((a, b) => a - b));
    for (const p of r.plan) {
      const offs = p.frames.map((f: Loose) => f.offset).filter((o: unknown) => o !== undefined);
      expect(offs).toEqual([...offs].sort((a, b) => a - b));
    }
  });

  it("is identical for the same props and refuses a model path", async () => {
    const { importFlow } = await imp();
    const { renderScene } = await scenes();
    const { flowProblems } = await flow();
    const props = importFlow(model(), "load-profile");
    const run = () => JSON.stringify(renderScene({ kind: "request-flow", props }, ctx()));
    expect(run()).toBe(run());
    expect(flowProblems({ model: "docs/architecture.json", flow: "x" }).join()).toContain(
      "arch-import",
    );
  });

  it("shows hostile labels as text", async () => {
    const { importFlow } = await imp();
    const { renderScene } = await scenes();
    const m = model();
    m.nodes[1].label = "<img onerror=x>";
    m.flows[0].steps[0].label = "</script><b>";
    const r = renderScene({ kind: "request-flow", props: importFlow(m, "load-profile") }, ctx());
    expect(r.html).not.toContain("<img");
    expect(r.html).not.toContain("</script");
    expect(r.html).toContain("&lt;img");
  });

  it("lays a hub and its connections out as a fan, so no line crosses a box", async () => {
    const { renderScene } = await scenes();
    const node = (id: string, tier: string) => ({ id, label: id, role: "backend", tier });
    const props = {
      nodes: [
        node("cli", "clients"),
        node("site", "edge"),
        node("audit", "backend"),
        node("folder", "data"),
        node("gh", "external"),
      ],
      edges: ["site", "audit", "folder", "gh"].map((to) => ({ id: `cli-${to}`, from: "cli", to })),
      steps: [{ edge: "cli-site" }, { edge: "cli-gh", reverse: true }],
    };
    const r = renderScene({ kind: "request-flow", props }, ctx());
    const boxes = [...r.html.matchAll(/<rect class="nb" x="([\d.]+)" y="([\d.]+)"/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(boxes).toHaveLength(5);
    const hub = boxes[0];
    const spokes = boxes.slice(1);
    expect(new Set(spokes.map((b) => b[0])).size).toBe(1); // one column
    expect(new Set(spokes.map((b) => b[1])).size).toBe(4); // one row each
    expect(spokes[0]![0]).toBeGreaterThan(hub![0]! + 20); // to the right of the hub
  });

  it("describes what is wrong with hand-written props", async () => {
    const { flowProblems } = await flow();
    const p = flowProblems({
      nodes: [
        { id: "a", label: "A", tier: "edge" },
        { id: "a", label: "", tier: "moon" },
      ],
      edges: [{ id: "e", from: "a", to: "zzz" }],
      steps: [{ edge: "nope" }, {}],
    }).join("\n");
    for (const part of [
      "used twice",
      "label",
      "tier",
      "from and to",
      "not in edges",
      "give an edge",
    ])
      expect(p).toContain(part);
  });
});
