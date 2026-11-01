import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Scenes = {
  renderScene: (scene: Loose, ctx: Loose) => { html: string; plan: Loose[] };
};
type Check = { checkProject: (video: unknown, dir: string) => string[] };

const ctx = (o: Record<string, unknown> = {}) => ({
  prefix: "sc-a",
  at: 2,
  seconds: 10,
  lines: [],
  lang: "en",
  first: false,
  rise: 24,
  assets: new Map(),
  ...o,
});
const props = (o: Loose = {}) => ({
  title: "Token bucket",
  seed: 42,
  count: 60,
  pattern: { type: "poisson", ratePerSec: 5 },
  algos: [{ algo: "token-bucket", capacity: 5, refillPerSec: 2 }],
  ...o,
});
const scenes = () => loadScript<Scenes>("video-core", "assets/engine/hyperframes/scenes.mjs");

describe("rate-limit scene", () => {
  it("draws one dot per request and the counters end on the simulator's totals", async () => {
    const { renderScene } = await scenes();
    const r = renderScene({ kind: "rate-limit", props: props() }, ctx());
    expect(r.html.match(/class="dot"/g)).toHaveLength(60);
    const dots = r.plan.filter((p) => /-d\d+$/.test(p.id));
    expect(dots).toHaveLength(60);
    // each counter ends on its last row, and the two rows add up to the request count
    const rows = (id: string) => {
      const f = r.plan.find((p) => p.id.endsWith(id))!.frames;
      return -parseFloat(f[f.length - 1].transform.match(/-?\d+(\.\d+)?/)[0]) / 5;
    };
    expect(rows("-ca") + rows("-cr")).toBe(60);
    expect(r.html).toContain("seed 42 · 60 requests");
    expect(r.html).toContain("random arrivals, about 5 a second");
  });

  it("keeps every animation inside the scene and every keyframe offset in order", async () => {
    const { renderScene } = await scenes();
    const r = renderScene({ kind: "rate-limit", props: props() }, ctx());
    for (const p of r.plan) {
      expect(p.at).toBeGreaterThanOrEqual(2);
      const offs = p.frames.map((f: Loose) => f.offset).filter((o: unknown) => o !== undefined);
      expect(offs).toEqual([...offs].sort((a, b) => a - b));
      expect(offs.every((o: number) => o >= 0 && o <= 1)).toBe(true);
    }
    const ends = r.plan.map((p) => p.at + p.dur);
    expect(Math.max(...ends)).toBeLessThanOrEqual(2 + 10 + 0.01);
  });

  it("is identical for the same props and different for another seed", async () => {
    const { renderScene } = await scenes();
    const run = (seed: number) =>
      JSON.stringify(renderScene({ kind: "rate-limit", props: props({ seed }) }, ctx()));
    expect(run(42)).toBe(run(42));
    expect(run(42)).not.toBe(run(43));
  });

  it("draws two algorithms side by side on the same arrivals, and flashes 429 on rejections", async () => {
    const { renderScene } = await scenes();
    const r = renderScene(
      {
        kind: "rate-limit",
        props: props({
          algos: [
            { algo: "token-bucket", capacity: 3, refillPerSec: 1 },
            { algo: "fixed-window", limit: 3, windowSec: 1 },
          ],
        }),
      },
      ctx(),
    );
    expect(r.html.match(/<svg id="sc-a-p\d"/g)).toHaveLength(2);
    expect(r.html).toContain("Token bucket");
    expect(r.html).toContain("Fixed window");
    expect(r.plan.some((p) => p.id === "sc-a-p0-429")).toBe(true);
  });

  it("shows hostile text as text", async () => {
    const { renderScene } = await scenes();
    const bad = `<img src=x onerror=alert(1)></script><script>alert(2)</script>`;
    const r = renderScene({ kind: "rate-limit", props: props({ title: bad }) }, ctx());
    expect(r.html).not.toContain("<img");
    expect(r.html).not.toContain("<script");
    expect(r.html).toContain("&lt;img");
  });

  it("is fully visible at frame 0 when it is the first scene", async () => {
    const { renderScene } = await scenes();
    const r = renderScene(
      { kind: "rate-limit", props: props({ title: undefined }) },
      ctx({ first: true }),
    );
    expect(r.plan.find((p) => p.id === "sc-a-p0")!.frames[0].opacity).toBe(1);
  });
});

describe("rate-limit in check", () => {
  const video = (p: Loose) => ({
    version: 1,
    meta: { title: "t", type: "explainer", format: "reel-9x16", fps: 30, lang: "en" },
    scenes: [{ id: "s1", kind: "rate-limit", durationFrom: "fixed", seconds: 8, props: p }],
  });
  it("accepts a good spec", async () => {
    const { checkProject } = await loadScript<Check>("video-core", "scripts/check.mjs");
    expect(checkProject(video(props()), ".")).toEqual([]);
  });
  it("rejects typed-in results, too many requests and bad parameters", async () => {
    const { checkProject } = await loadScript<Check>("video-core", "scripts/check.mjs");
    const p = checkProject(
      video(props({ log: [1], count: 900, algos: [{ algo: "token-bucket", capacity: 0 }] })),
      ".",
    ).join("\n");
    expect(p).toContain("props.log");
    expect(p).toContain("draws at most 600");
    expect(p).toContain("capacity");
    expect(p).toContain("refillPerSec");
  });
});
