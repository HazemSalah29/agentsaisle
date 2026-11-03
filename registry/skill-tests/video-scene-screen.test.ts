import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Scenes = {
  renderScene: (scene: Loose, ctx: Loose) => { html: string; plan: Loose[]; root?: string };
};
type Screen = {
  screenProblems: (p: Loose) => string[];
  cameraTransform: (x: number, y: number, s: number) => string;
  cameraFrames: (zoom: Loose[], seconds: number) => Loose[];
};
const scenes = () => loadScript<Scenes>("video-core", "assets/engine/hyperframes/scenes.mjs");
const screen = () => loadScript<Screen>("video-core", "assets/engine/hyperframes/screen.mjs");

const ctx = (o: Record<string, unknown> = {}) => ({
  prefix: "sc-a",
  at: 1,
  seconds: 10,
  lines: [],
  lang: "en",
  first: false,
  rise: 24,
  size: [1080, 1920],
  assets: new Map([["rec", { file: "rec.mp4" }]]),
  ...o,
});
const props = (o: Loose = {}) => ({
  asset: "rec",
  device: "browser",
  viewport: { w: 1280, h: 720 },
  zoom: [{ at: 2, dur: 1, x: 0.7, y: 0.3, scale: 2 }],
  cursor: [
    { t: 0, x: 0.1, y: 0.1 },
    { t: 2, x: 0.7, y: 0.3 },
  ],
  ripples: [{ t: 2, x: 0.7, y: 0.3 }],
  ...o,
});

describe("screen scene props", () => {
  it("accepts a normal spec", async () => {
    expect((await screen()).screenProblems(props())).toEqual([]);
  });
  it("rejects bad values with readable text", async () => {
    const { screenProblems } = await screen();
    expect(screenProblems(props({ asset: "Bad Id" }))[0]).toMatch(/^asset/);
    expect(screenProblems(props({ device: "tv" }))[0]).toMatch(/^device/);
    expect(screenProblems(props({ zoom: [{ at: 0, dur: 1, x: 2, y: 0.5, scale: 2 }] }))[0]).toMatch(
      /x and y/,
    );
    expect(
      screenProblems(props({ zoom: [{ at: 0, dur: 1, x: 0.5, y: 0.5, scale: 5 }] }))[0],
    ).toMatch(/scale/);
    expect(
      screenProblems(
        props({
          zoom: [
            { at: 0, dur: 2, x: 0.5, y: 0.5, scale: 2 },
            { at: 1, dur: 1, x: 0.5, y: 0.5, scale: 2 },
          ],
        }),
      ).join(),
    ).toMatch(/before the previous zoom ends/);
    expect(
      screenProblems(
        props({
          cursor: [
            { t: 2, x: 0, y: 0 },
            { t: 1, x: 0, y: 0 },
          ],
        }),
      ).join(),
    ).toMatch(/time order/);
  });
});

describe("camera", () => {
  it("never looks outside the recording", async () => {
    const { cameraTransform } = await screen();
    // Focus on the far corner at 2x: the view is clamped so the right and bottom edges line up.
    expect(cameraTransform(1, 1, 2)).toBe("translate(-100%, -100%) scale(2)");
    expect(cameraTransform(0, 0, 2)).toBe("translate(0%, 0%) scale(2)");
    expect(cameraTransform(0.5, 0.5, 1)).toBe("translate(0%, 0%) scale(1)");
  });
  it("holds, eases, then holds, with non-decreasing offsets", async () => {
    const { cameraFrames } = await screen();
    const f = cameraFrames([{ at: 2, dur: 1, x: 0.5, y: 0.5, scale: 2 }], 10);
    expect(f.map((k) => k.offset)).toEqual([0, 0.2, 0.3, 1]);
    expect(f[0]!.transform).toBe(f[1]!.transform);
    expect(f[2]!.transform).toBe(f[3]!.transform);
    expect(f[2]!.transform).not.toBe(f[1]!.transform);
  });
});

describe("screen renderer", () => {
  it("draws the mask, a cursor and one ripple, with the recording as its own top-level clip", async () => {
    const { renderScene } = await scenes();
    const r = renderScene({ id: "a", kind: "screen", props: props() }, ctx());
    expect(r.html).toContain("scr-over");
    expect(r.html).toContain("scr-cursor");
    expect(r.html).toContain("sc-a-rp0");
    expect(r.html).not.toContain("<video");
    expect(r.root).toMatch(
      /<video id="sc-a-vid" class="clip scr-vid" data-start="1" data-duration="10"/,
    );
    expect(r.root).toContain('src="assets/media/rec.mp4"');
    const ids = r.plan.map((p) => p.id);
    expect(ids).toEqual(["sc-a-cam", "sc-a-vid", "sc-a-cur", "sc-a-rp0"]);
    expect(r.plan[3]!.at).toBe(3);
    expect(r.plan[0]!.frames).toEqual(r.plan[1]!.frames);
  });
  it("is the same output twice", async () => {
    const { renderScene } = await scenes();
    const a = renderScene({ id: "a", kind: "screen", props: props() }, ctx());
    const b = renderScene({ id: "a", kind: "screen", props: props() }, ctx());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it("shows hostile text as text", async () => {
    const { renderScene } = await scenes();
    const r = renderScene(
      { id: "a", kind: "screen", props: props({ title: '<img src=x onerror="alert(1)">' }) },
      ctx(),
    );
    expect(r.html).not.toContain("<img src=x");
    expect(r.html).toContain("&lt;img");
  });
  it("fits every device inside the frame", async () => {
    const { renderScene } = await scenes();
    for (const device of ["phone", "laptop", "browser", "none"]) {
      for (const size of [
        [1080, 1920],
        [1920, 1080],
      ]) {
        const r = renderScene({ id: "a", kind: "screen", props: props({ device }) }, ctx({ size }));
        const m =
          /left:calc\(var\(--u\)\*([\d.]+)\);top:calc\(var\(--u\)\*([\d.]+)\);width:calc\(var\(--u\)\*([\d.]+)\);height:calc\(var\(--u\)\*([\d.]+)\)/.exec(
            r.root!,
          )!;
        const [x, y, w, h] = m.slice(1).map(Number);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x! + w!).toBeLessThanOrEqual(100);
        expect(y! + h!).toBeLessThanOrEqual((size[1]! / size[0]!) * 100);
        expect(w! / h!).toBeCloseTo(1280 / 720, 1);
      }
    }
  });
  it("refuses an invalid scene instead of drawing it", async () => {
    const { renderScene } = await scenes();
    expect(() =>
      renderScene({ id: "a", kind: "screen", props: props({ device: "x" }) }, ctx()),
    ).toThrow(/cannot be drawn/);
  });
});
