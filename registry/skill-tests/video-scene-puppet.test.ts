import { describe, expect, it } from "vitest";
import { loadScript } from "./load";
import { sampleRig } from "./video-puppet-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Scenes = {
  KINDS: string[];
  renderScene: (scene: Loose, ctx: Loose) => { html: string; plan: Loose[] };
};
type Puppet = {
  normalizeActs: (c: Loose) => { acts: Loose[]; problems: string[] };
  puppetProblems: (p: Loose, ids?: string[] | null) => string[];
  evalPose: (c: Loose, acts: Loose[], t: number, blinks?: number[]) => Loose;
  mouthIntervals: (speaks: string[], lines: Loose[], v: Map<string, Loose[]>) => Loose[];
  blinkTimes: (seconds: number, index: number) => number[];
};
const scenes = () => loadScript<Scenes>("video-core", "assets/engine/hyperframes/scenes.mjs");
const puppet = () => loadScript<Puppet>("video-core", "assets/engine/hyperframes/puppet.mjs");

const char = (o: Loose = {}) => ({ rig: "nour", x: 0.3, y: 0.8, height: 0.5, ...o });
const props = (o: Loose = {}) => ({ backdrop: { preset: "meadow" }, cast: [char()], ...o });
const ctx = (o: Loose = {}) => ({
  prefix: "sc-a",
  at: 2,
  seconds: 10,
  lines: [{ id: "l1", start: 1, seconds: 3 }],
  lang: "en",
  first: false,
  rise: 24,
  size: [1080, 1920],
  assets: new Map(),
  rigs: new Map([["nour", sampleRig()]]),
  visemes: new Map(),
  ...o,
});

describe("puppet props", () => {
  it("accepts a normal scene", async () => {
    const { puppetProblems } = await puppet();
    expect(
      puppetProblems(
        props({
          cast: [
            char({
              speaks: ["l1"],
              acts: [
                { at: 1, do: "walk", to: 0.6 },
                { at: 5, do: "wave" },
                { at: 7, do: "emote", mood: "happy" },
              ],
            }),
          ],
        }),
        ["l1"],
      ),
    ).toEqual([]);
  });
  it.each([
    ["no cast", { cast: [] }],
    ["five characters", { cast: [1, 2, 3, 4, 5].map(() => char()) }],
    ["an unknown backdrop", { backdrop: { preset: "moon-base" } }],
    ["a rig path", { cast: [char({ rig: "../x" })] }],
    ["feet off the stage", { cast: [char({ y: 3 })] }],
    ["a tiny character", { cast: [char({ height: 0.01 })] }],
    ["an unknown act", { cast: [char({ acts: [{ at: 0, do: "fly" }] })] }],
    ["a walk with no target", { cast: [char({ acts: [{ at: 0, do: "walk" }] })] }],
    ["an unknown mood", { cast: [char({ acts: [{ at: 0, do: "emote", mood: "angry" }] })] }],
    [
      "overlapping acts",
      {
        cast: [
          char({
            acts: [
              { at: 0, do: "wave", dur: 3 },
              { at: 1, do: "nod" },
            ],
          }),
        ],
      },
    ],
    ["too many acts", { cast: [char({ acts: new Array(61).fill({ at: 0, do: "nod" }) })] }],
    ["a speaker line not in the scene", { cast: [char({ speaks: ["zz"] })] }],
  ])("rejects %s", async (_n, over) => {
    const { puppetProblems } = await puppet();
    expect(puppetProblems(props(over as Loose), ["l1"]).length).toBeGreaterThan(0);
  });
});

describe("puppet motion", () => {
  it("fills in walk lengths from the distance and chains start places", async () => {
    const { normalizeActs } = await puppet();
    const { acts, problems } = normalizeActs(
      char({
        acts: [
          { at: 5, do: "walk", to: 0.9 },
          { at: 0, do: "walk", to: 0.5 },
        ],
      }),
    );
    expect(problems).toEqual([]);
    expect(acts.map((a) => [a.at, a.x0, a.to])).toEqual([
      [0, 0.3, 0.5],
      [5, 0.5, 0.9],
    ]);
    expect(acts[0].dur).toBeGreaterThanOrEqual(0.8);
  });
  it("walks to the target, faces the way it goes and swings its legs", async () => {
    const { normalizeActs, evalPose } = await puppet();
    const c = char({ acts: [{ at: 1, do: "walk", to: 0.1, dur: 2 }] });
    const { acts } = normalizeActs(c);
    expect(evalPose(c, acts, 0).x).toBe(0.3);
    expect(evalPose(c, acts, 0).face).toBe(1);
    const mid = evalPose(c, acts, 2);
    expect(mid.x).toBeCloseTo(0.2, 2);
    expect(mid.face).toBe(-1);
    expect(Math.abs(mid.legs.l)).toBeGreaterThan(1);
    expect(evalPose(c, acts, 3.5).x).toBeCloseTo(0.1, 5);
    expect(evalPose(c, acts, 3.5).legs.l).toBe(0);
  });
  it("jump leaves the ground and squashes at take-off and landing", async () => {
    const { normalizeActs, evalPose } = await puppet();
    const c = char({ acts: [{ at: 0, do: "jump", dur: 1 }] });
    const { acts } = normalizeActs(c);
    expect(evalPose(c, acts, 0.5).lift).toBeGreaterThan(0.09);
    expect(evalPose(c, acts, 0.1).sy).toBeLessThan(1);
    expect(evalPose(c, acts, 0.95).sy).toBeLessThan(1);
    expect(evalPose(c, acts, 2).lift).toBe(0);
  });
  it("wave raises the right arm; emote sets brows and sleepy closes the eyes", async () => {
    const { normalizeActs, evalPose } = await puppet();
    const c = char({
      acts: [
        { at: 0, do: "wave", dur: 2 },
        { at: 3, do: "emote", mood: "surprised" },
        { at: 5, do: "emote", mood: "sleepy" },
      ],
    });
    const { acts } = normalizeActs(c);
    expect(evalPose(c, acts, 1).arms.r).toBeLessThan(-100);
    expect(evalPose(c, acts, 4).brows).toBeCloseTo(-9, 1);
    expect(evalPose(c, acts, 6).closed).toBe(1);
    expect(evalPose(c, acts, 4).closed).toBe(0);
  });
  it("is a pure function of time", async () => {
    const { normalizeActs, evalPose } = await puppet();
    const c = char({ acts: [{ at: 0, do: "dance" }] });
    const { acts } = normalizeActs(c);
    expect(evalPose(c, acts, 1.3)).toEqual(evalPose(c, acts, 1.3));
  });
  it("blinks at fixed times, offset per character", async () => {
    const { blinkTimes } = await puppet();
    expect(blinkTimes(10, 0)).toEqual([0.9, 4.3, 7.7]);
    expect(blinkTimes(10, 1)[0]).toBe(1.5);
  });
  it("turns viseme events into mouth spans in scene time", async () => {
    const { mouthIntervals } = await puppet();
    const spans = mouthIntervals(
      ["l1"],
      [{ id: "l1", start: 1, seconds: 2 }],
      new Map([
        [
          "l1",
          [
            { t: 0, v: "a" },
            { t: 0.5, v: "mbp" },
            { t: 1, v: "bogus" },
          ],
        ],
      ]),
    );
    expect(spans).toEqual([
      { from: 1, to: 1.5, v: "a" },
      { from: 1.5, to: 2, v: "mbp" },
      { from: 2, to: 3, v: "rest" },
    ]);
  });
});

describe("puppet scene markup", () => {
  it("is a known kind and renders characters, backdrop and animations", async () => {
    const { KINDS, renderScene } = await scenes();
    expect(KINDS).toContain("puppet");
    const r = renderScene(
      { kind: "puppet", props: props({ cast: [char({ acts: [{ at: 1, do: "wave" }] })] }) },
      ctx(),
    );
    expect(r.html).toContain('id="sc-a-c0"');
    expect(r.html).toContain('id="sc-a-c0-arm-r"');
    expect(r.html).toContain('id="sc-a-bg0"');
    const ids = r.plan.map((p) => p.id);
    expect(ids).toContain("sc-a-c0-arm-r");
    expect(ids).toContain("sc-a-c0-eyes-closed");
    // Every animated element exists in the markup.
    for (const id of ids) expect(r.html).toContain(`id="${id}"`);
    for (const p of r.plan) {
      expect(p.at).toBe(2);
      expect(p.dur).toBe(10);
      let last = 0;
      for (const f of p.frames.filter((x: Loose) => x.offset !== undefined)) {
        expect(f.offset).toBeGreaterThanOrEqual(last);
        expect(f.offset).toBeLessThanOrEqual(1);
        last = f.offset;
      }
    }
  });
  it("is deterministic: the same props give the same bytes", async () => {
    const { renderScene } = await scenes();
    const s = {
      kind: "puppet",
      props: props({ cast: [char({ acts: [{ at: 1, do: "dance" }] })] }),
    };
    expect(JSON.stringify(renderScene(s, ctx()))).toBe(JSON.stringify(renderScene(s, ctx())));
  });
  it("animates the speaking mouths only when there are viseme events", async () => {
    const { renderScene } = await scenes();
    const s = { kind: "puppet", props: props({ cast: [char({ speaks: ["l1"] })] }) };
    const quiet = renderScene(s, ctx());
    expect(quiet.plan.some((p) => p.id.includes("mouth-"))).toBe(false);
    const talk = renderScene(
      s,
      ctx({
        visemes: new Map([
          [
            "l1",
            [
              { t: 0, v: "a" },
              { t: 1, v: "mbp" },
              { t: 2, v: "rest" },
            ],
          ],
        ]),
      }),
    );
    // Line l1 starts 1 s into the scene: "a" is the shape from 1 to 2, and rest fills the time before.
    const a = talk.plan.find((p) => p.id === "sc-a-c0-mouth-a");
    expect(a?.frames.some((f: Loose) => f.opacity === "1")).toBe(true);
    const rest = talk.plan.find((p) => p.id === "sc-a-c0-mouth-rest");
    expect(rest?.frames[0].opacity).toBe("1");
  });
  it("refuses a broken or missing rig", async () => {
    const { renderScene } = await scenes();
    const bad = sampleRig();
    bad.parts[0].svg = "<script>alert(1)</script>";
    expect(() =>
      renderScene({ kind: "puppet", props: props() }, ctx({ rigs: new Map([["nour", bad]]) })),
    ).toThrow(/Character "nour"/);
    expect(() => renderScene({ kind: "puppet", props: props() }, ctx({ rigs: new Map() }))).toThrow(
      /puppet\.json/,
    );
  });
});
