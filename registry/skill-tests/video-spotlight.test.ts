import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const scenes = () =>
  loadScript<{ renderScene: (s: Loose, c: Loose) => { html: string; plan: Loose[] } }>(
    "video-core",
    "assets/engine/hyperframes/scenes.mjs",
  );
const sp = () => loadScript<Loose>("video-core", "assets/engine/hyperframes/spotlight.mjs");
const dg = () => loadScript<Loose>("video-core", "assets/engine/hyperframes/diagrams.mjs");
const W = (text: string, start: number) => ({ text, start, end: start + 0.3, line: "l1" });
const words = [W("alpha", 0.5), W("beta", 2.5), W("gamma", 4.5), W("delta", 6.5)];
const ctx = (o: Loose = {}) => ({
  prefix: "sc-a",
  at: 10,
  seconds: 8,
  lines: [],
  lang: "en",
  first: false,
  rise: 24,
  assets: new Map(),
  size: [1080, 1920],
  words,
  ...o,
});
const entries = (plan: Loose[], id: string) => plan.filter((p) => p.id === id);

describe("spotlight layout", () => {
  const props = {
    heading: "Four",
    items: ["alpha", "beta", "gamma", "delta"],
    layout: "spotlight",
  };
  it("shows one item at a time on its word, and each leaves just before the next arrives (the last stays)", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene({ id: "s", kind: "list", props }, ctx());
    for (let i = 0; i < 4; i++) expect(html).toContain(`id="sc-a-p${i}"`);
    expect(entries(plan, "sc-a-p0")[0]!.at).toBeCloseTo(10.44); // 10.5 - 0.06 lead
    expect(entries(plan, "sc-a-p1")[0]!.at).toBeCloseTo(12.44);
    const out0 = entries(plan, "sc-a-p0-x")[0];
    expect(out0!.at + out0!.dur).toBeLessThanOrEqual(entries(plan, "sc-a-p1")[0]!.at); // gone before the next arrives
    expect(entries(plan, "sc-a-p3-x")).toHaveLength(0); // the last one stays
    expect(html.match(/class="sp-dot"/g)).toHaveLength(4);
  });
  it("fills a rail for the whole time an item is spoken", async () => {
    const { renderScene } = await scenes();
    const { plan } = renderScene({ id: "s", kind: "list", props }, ctx());
    const r = entries(plan, "sc-a-p1-r")[0];
    expect(r!.at).toBeCloseTo(12.44);
    expect(r!.at + r!.dur).toBeCloseTo(14.44, 1);
    const last = entries(plan, "sc-a-p3-r")[0];
    expect(last!.at + last!.dur).toBeCloseTo(18 - 0.15, 1);
  });
  it("works for steps (with the detail) and funnel (with the value) and keeps the heading", async () => {
    const { renderScene } = await scenes();
    const st = renderScene(
      {
        id: "s",
        kind: "steps",
        props: {
          title: "How",
          layout: "spotlight",
          steps: [{ label: "Alpha", detail: "first" }, { label: "Beta" }],
        },
      },
      ctx(),
    );
    expect(st.html).toContain("Step 1 of 2");
    expect(st.html).toContain("first");
    expect(st.html).toContain("How");
    const fn = renderScene(
      {
        id: "s",
        kind: "funnel",
        props: {
          layout: "spotlight",
          stages: [{ label: "Alpha", value: "1,000" }, { label: "Beta" }, { label: "Gamma" }],
        },
      },
      ctx(),
    );
    expect(fn.html).toContain("1,000");
    expect(fn.html).toContain("Stage 3 of 3");
  });
  it("never leaves the first frame empty and escapes hostile text", async () => {
    const { renderScene } = await scenes();
    const bad = "<img src=x onerror=1>";
    const { html, plan } = renderScene(
      { id: "s", kind: "list", props: { items: [bad, "beta"], layout: "spotlight" } },
      ctx({ words: [W("beta", 4)] }),
    );
    expect(html).not.toContain("<img");
    expect(entries(plan, "sc-a-p0")[0]!.at).toBeLessThanOrEqual(10.5); // no heading: it comes in at once (0.4 s when its word is never said)
  });
  it("sizes long labels smaller, and wide frames smaller than tall ones", async () => {
    const { sizeFor } = await sp();
    expect(sizeFor("Go")).toBeGreaterThan(sizeFor("A sentence of about twenty chars"));
    expect(sizeFor("x".repeat(100))).toBeGreaterThanOrEqual(7);
    expect(sizeFor("Hello", false)).toBeLessThan(sizeFor("Hello", true));
  });
  it("is validated: only stack or spotlight", async () => {
    const { diagramProblems } = await dg();
    const steps = { steps: [{ label: "a" }, { label: "b" }] };
    expect(diagramProblems("steps", { ...steps, layout: "spotlight" })).toEqual([]);
    expect(diagramProblems("steps", { ...steps, layout: "carousel" })[0]).toContain("layout");
  });
});
