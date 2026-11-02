import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const scenes = () =>
  loadScript<{ renderScene: (s: Loose, c: Loose) => { html: string; plan: Loose[] } }>(
    "video-core",
    "assets/engine/hyperframes/scenes.mjs",
  );
const shotMod = () => loadScript<Loose>("video-core", "assets/engine/hyperframes/shot.mjs");
const assets = new Map([
  ["photo", { file: "photo.jpg" }],
  ["cut", { file: "cut.png" }],
]);
const ctx = (o: Loose = {}) => ({
  prefix: "sc-a",
  at: 2,
  seconds: 3,
  lines: [],
  lang: "en",
  first: false,
  rise: 24,
  assets,
  ...o,
});
const props = (o: Loose = {}) => ({
  layers: [
    { asset: "photo", role: "bg" },
    { asset: "cut", role: "subject" },
  ],
  camera: { move: "push" },
  ...o,
});

describe("shot scene", () => {
  it("moves nearer layers further than farther ones (parallax) and starts at the scene's time", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene({ id: "s1", kind: "shot", props: props() }, ctx());
    expect(html).toContain('src="assets/media/photo.jpg"');
    expect(html).toContain('src="assets/media/cut.png"');
    const scaleAt = (id: string) =>
      Number(/scale\(([\d.]+)\)/.exec(plan.find((p) => p.id === id)!.frames.at(-1)!.transform)![1]);
    expect(scaleAt("sc-a-L1")).toBeGreaterThan(scaleAt("sc-a-L0"));
    for (const p of plan) expect(p.at).toBe(2);
  });

  it("is a pure function of its input: the same scene gives the same markup and plan", async () => {
    const { renderScene } = await scenes();
    const s = {
      id: "s1",
      kind: "shot",
      props: props({ fx: { grain: true, glitch: [1], shake: [0.5], flash: [2] } }),
    };
    expect(JSON.stringify(renderScene(s, ctx()))).toBe(JSON.stringify(renderScene(s, ctx())));
  });

  it("builds type, cards, grade and effects, and escapes hostile text", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene(
      {
        id: "s1",
        kind: "shot",
        props: props({
          type: [
            { text: "<img src=x onerror=alert(1)>", at: 0.4, style: "slam" },
            { text: "new drop", at: 1, style: "stagger", anchor: "bottom" },
          ],
          cards: [{ text: "$29", sub: "free shipping", at: 1.2, x: 70, y: 30, style: "card" }],
          fx: { grain: true, vignette: true, grade: "punch", flash: [1.5] },
          enter: { style: "whip-l" },
        }),
      },
      ctx(),
    );
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
    expect(html).toContain("contrast(1.12)");
    expect(html).toContain("shot-grain");
    expect(html).toContain("shot-vignette");
    expect(plan.find((p) => p.id === "sc-a-t0")!.at).toBeCloseTo(2.4);
    expect(plan.find((p) => p.id === "sc-a-t1-w1")!.at).toBeCloseTo(3.09);
    expect(plan.find((p) => p.id === "sc-a-cam")!.frames[0].transform).toContain("-38%");
    expect(plan.find((p) => p.id === "sc-a-fl")).toBeTruthy();
  });

  it("speed-ramps the camera and keeps every move inside safe bounds", async () => {
    const { camState } = await shotMod();
    const plain = (u: number) => camState({ move: "push", ease: "linear" }, u).s;
    const ramp = (u: number) =>
      camState({ move: "push", ease: "linear", ramp: [0.4, 0.6, 3] }, u).s;
    expect(ramp(0)).toBeCloseTo(1);
    expect(ramp(1)).toBeCloseTo(1.2);
    expect(ramp(0.4) - 1).toBeLessThan(plain(0.4) - 1); // slower before the ramp, so it covers less ground
    expect(ramp(0.6) - ramp(0.4)).toBeGreaterThan(plain(0.6) - plain(0.4)); // faster inside
    for (const move of [
      "push",
      "pull",
      "pan-l",
      "pan-r",
      "tilt-up",
      "tilt-down",
      "whip-l",
      "whip-r",
      "orbit",
      "hold",
    ])
      for (let k = 0; k <= 10; k++) {
        const c = camState({ move }, k / 10);
        expect(c.s).toBeGreaterThanOrEqual(1);
        expect(Math.abs(c.x)).toBeLessThanOrEqual(4.01);
        expect(Math.abs(c.y)).toBeLessThanOrEqual(4.01);
      }
  });

  it("shakes and glitches are repeatable and fade out", async () => {
    const { jitterAt } = await shotMod();
    expect(jitterAt(1.05, [1], [])).toEqual(jitterAt(1.05, [1], []));
    expect(jitterAt(0.5, [1], [])).toEqual({ x: 0, y: 0, skew: 0 });
    expect(jitterAt(1.4, [1], [])).toEqual({ x: 0, y: 0, skew: 0 });
    expect(Math.abs(jitterAt(1.01, [1], []).x)).toBeLessThanOrEqual(0.9);
  });

  it("lists problems, including unsafe fast flashing", async () => {
    const { shotProblems } = await shotMod();
    expect(shotProblems(props(), 3)).toEqual([]);
    expect(shotProblems({ layers: [] })[0]).toContain("1 to 4");
    expect(shotProblems(props({ camera: { move: "spin" } }))[0]).toContain("camera.move");
    expect(shotProblems(props({ camera: { move: "push", ramp: [0.6, 0.4, 2] } }))[0]).toContain(
      "camera.ramp",
    );
    expect(shotProblems(props({ fx: { flash: [1, 1.2] } }))[0]).toContain("0.4 s apart");
    expect(shotProblems(props({ fx: { glitch: [5] } }), 3)[0]).toContain("inside the scene");
    expect(
      shotProblems(props({ type: [{ text: "x".repeat(60), at: 0, style: "slam" }] }))[0],
    ).toContain("1 to 48");
    expect(shotProblems(props({ cards: [{ text: "a", at: 0, x: 2, y: 50 }] }))[0]).toContain(
      "cards[0].x",
    );
    expect(shotProblems(props({ enter: { style: "wipe" } }))[0]).toContain("enter.style");
  });

  it("refuses a layer whose asset is not listed", async () => {
    const { renderScene } = await scenes();
    expect(() =>
      renderScene({ id: "s1", kind: "shot", props: { layers: [{ asset: "ghost" }] } }, ctx()),
    ).toThrow("not listed");
  });

  it("check.mjs reports a shot with a bad effect or a layer asset that is not listed", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "shot-check-"));
    const video = {
      version: 1,
      meta: { title: "t", type: "showcase", format: "reel-9x16", fps: 30, lang: "en" },
      voice: { provider: "none" },
      assets: [{ id: "photo", path: "p.jpg", kind: "image", source: "user", licence: "own" }],
      scenes: [
        {
          id: "s1",
          kind: "shot",
          durationFrom: "fixed",
          seconds: 2,
          props: { layers: [{ asset: "ghost" }], fx: { flash: [0.1, 0.2] } },
        },
      ],
    };
    writeFileSync(path.join(dir, "video.json"), JSON.stringify(video));
    writeFileSync(path.join(dir, "p.jpg"), "x");
    const r = spawnSync(process.execPath, [skillFile("video-core", "scripts/check.mjs"), dir], {
      encoding: "utf8",
    });
    expect(r.stdout + r.stderr).toContain('asset "ghost" is not listed');
    expect(r.stdout + r.stderr).toContain("flashes at least 0.4 s apart");
  });
});
