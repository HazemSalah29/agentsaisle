import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const tr = () => loadScript<Loose>("video-core", "assets/engine/hyperframes/transitions.mjs");
const project = () => loadScript<Loose>("video-core", "scripts/project.mjs");
const timing = () => loadScript<Loose>("video-core", "scripts/timing.mjs");
const W = 1080;
const H = 1920;
const copy = (tag: string) => ({
  html: `<div id="c-${tag}">x</div>`,
  plan: [{ id: `c-${tag}`, frames: [{ opacity: 1 }], at: 1, dur: 1, ease: "out" }],
});

describe("transition geometry", () => {
  it("splits the frame into two halves that together cover it, on either side of the line", async () => {
    const { slashHalves, area } = await tr();
    for (const deg of [-62, -30, 0, 45, 58]) {
      const [a, b] = slashHalves(W, H, deg);
      expect(area(a.poly) + area(b.poly)).toBeCloseTo(W * H, 0);
      expect(a.n[0] + b.n[0]).toBeCloseTo(0);
      expect(area(a.poly)).toBeGreaterThan(W * H * 0.3); // a diagonal through the centre splits it roughly in half
    }
  });
  it("slides each half far enough to clear the frame", async () => {
    const { slashHalves, clearance } = await tr();
    const [a] = slashHalves(W, H, -62);
    const R = clearance(W, H, a.n);
    for (const [x, y] of a.poly)
      expect((x - W / 2) * a.n[0] + (y - H / 2) * a.n[1] - R).toBeLessThanOrEqual(0.001);
    expect(R).toBeGreaterThan(Math.min(W, H) / 2);
  });
  it("makes wedge shards that tile the frame", async () => {
    const { wedges, area } = await tr();
    const shards = wedges(W, H, 9, 5);
    expect(shards.length).toBeGreaterThanOrEqual(6);
    expect(shards.reduce((s: number, x: Loose) => s + area(x.poly), 0)).toBeCloseTo(W * H, -2);
    expect(JSON.stringify(wedges(W, H, 9, 5))).toBe(JSON.stringify(shards));
  });
});

describe("transitionParts", () => {
  it("slash: two clipped copies sliding apart, a glowing line and a spark, all inside the window", async () => {
    const { transitionParts } = await tr();
    const { html, plan } = transitionParts({
      style: "slash",
      id: "tr1",
      kind: "kinetic",
      copy,
      size: [W, H],
      at: 5,
      dur: 0.5,
    });
    expect(html.match(/tr-copy/g)).toHaveLength(2);
    expect(html).toContain("clip-path:polygon(");
    expect(html).toContain('id="tr1-line"');
    expect(html).toContain('data-start="5"');
    expect(html).toContain('data-duration="0.5"');
    const half = plan.find((p: Loose) => p.id === "tr1-h0")!;
    expect(half.frames[0].transform).toContain("translate(0px, 0px)");
    const last = half.frames.at(-1).transform as string;
    expect(
      Math.hypot(
        ...(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(last)!.slice(1).map(Number) as [
          number,
          number,
        ]),
      ),
    ).toBeGreaterThan(Math.min(W, H) / 2);
    for (const p of plan) expect(p.at).toBeGreaterThanOrEqual(1);
    expect(plan.filter((p: Loose) => p.id.startsWith("c-")).length).toBe(2); // the copies keep their own animations
  });
  it("shatter, whip and zoom-through draw the outgoing scene again and move it away", async () => {
    const { transitionParts } = await tr();
    const shatter = transitionParts({
      style: "shatter",
      id: "t",
      copy,
      size: [W, H],
      at: 2,
      dur: 0.55,
    });
    expect(shatter.html.match(/tr-copy/g)!.length).toBeGreaterThanOrEqual(6);
    expect(shatter.plan.find((p: Loose) => p.id === "t-s0")!.frames.at(-1).opacity).toBe(0);
    const whip = transitionParts({ style: "whip", id: "t", copy, size: [W, H], at: 2 });
    expect(whip.plan.find((p: Loose) => p.id === "t-w")!.frames.at(-1).filter).toContain("blur");
    const zoom = transitionParts({ style: "zoom-through", id: "t", copy, size: [W, H], at: 2 });
    expect(zoom.plan.find((p: Loose) => p.id === "t-z")!.frames.at(-1).transform).toContain(
      "scale(2.6)",
    );
    expect(() => transitionParts({ style: "wipe", id: "t", copy, size: [W, H], at: 2 })).toThrow(
      "not built",
    );
  });
  it("keeps the window between 0.25 and 0.8 seconds", async () => {
    const { transitionParts } = await tr();
    expect(
      transitionParts({ style: "whip", id: "t", copy, size: [W, H], at: 2, dur: 5 }).html,
    ).toContain('data-duration="0.8"');
    expect(
      transitionParts({ style: "whip", id: "t", copy, size: [W, H], at: 2, dur: 0.01 }).html,
    ).toContain('data-duration="0.25"');
  });
});

describe("transitions in a project", () => {
  const video = (styles: (string | undefined)[], seconds = 3) => ({
    version: 1,
    meta: { title: "t", type: "custom", format: "reel-9x16", fps: 30, lang: "en" },
    voice: { provider: "none" },
    scenes: styles.map((s, i) => ({
      id: `s${i + 1}`,
      kind: "title",
      durationFrom: "fixed",
      seconds,
      props: { text: `T${i + 1}` },
      ...(s ? { transitionIn: s } : {}),
    })),
  });
  const build = async (v: Loose) => {
    const { buildParts } = await project();
    const { buildTiming } = await timing();
    return buildParts({ video: v, timing: buildTiming(v, () => 1) });
  };
  it("adds copies of the outgoing scene on top at the cut, and no note", async () => {
    const r = await build(video([undefined, "slash"]));
    expect(r.notes).toEqual([]);
    expect(r.body.match(/tr-copy/g)).toHaveLength(2);
    expect(r.body.indexOf('id="sc-s2"')).toBeLessThan(r.body.indexOf("tr1-h0")); // copies come after the scenes, so they sit on top
    expect(r.body).toContain('data-start="3"');
    expect(r.css).toContain(".tr-line");
  });
  it("turns a slash that comes too soon after another into a whip, with a note", async () => {
    const r = await build(video([undefined, "slash", "slash"], 1.2));
    expect(r.notes.join(" ")).toContain("would strobe");
    expect(r.body).toContain("tr2-w");
    expect(r.body).not.toContain("tr2-h0");
    const ok = await build(video([undefined, "slash", "slash"], 3));
    expect(ok.notes).toEqual([]);
  });
  it("still says which transitions are not built", async () => {
    const r = await build(video([undefined, "match"]));
    expect(r.notes[0]).toContain('"match" is not built');
  });
});
