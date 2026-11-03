import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { wav } from "./video-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type Timing = {
  wavSeconds: (b: Buffer) => number | null;
  buildTiming: (v: Loose, measure: (id: string) => number, pad?: number) => Loose;
};

const video = (scenes: unknown[], fps = 30) => ({
  version: 1,
  meta: { title: "t", type: "explainer", format: "reel-9x16", fps, lang: "en" },
  scenes,
});

describe("video-core timing", () => {
  it("reads exact WAV lengths, including files with extra chunks", async () => {
    const { wavSeconds } = await loadScript<Timing>("video-core", "scripts/timing.mjs");
    expect(wavSeconds(wav(1.5))).toBe(1.5);
    expect(wavSeconds(wav(2, 24000, true))).toBe(2);
    expect(wavSeconds(Buffer.from("not audio at all, definitely not audio"))).toBeNull();
  });

  it("sets scene lengths from the voice, adds the pad and snaps to whole frames", async () => {
    const { buildTiming } = await loadScript<Timing>("video-core", "scripts/timing.mjs");
    const lens: Record<string, number> = { l1: 1.5, l2: 2.0, l3: 0.7 };
    const t = buildTiming(
      video([
        { id: "a", kind: "title", narration: ["l1", "l2"] },
        { id: "b", kind: "title", durationFrom: "fixed", seconds: 2 },
        { id: "c", kind: "title", narration: ["l3"] },
      ]),
      (id) => lens[id]!,
      0.3,
    );
    expect(t.scenes.map((s: Loose) => s.frames)).toEqual([114, 60, 30]); // 3.8s, 2s, 1.0s at 30 fps
    expect(t.scenes.map((s: Loose) => s.startFrame)).toEqual([0, 114, 174]);
    expect(t.totalFrames).toBe(204);
    expect(t.totalSeconds).toBe(6.8);
    expect(t.scenes[0].lines).toEqual([
      { id: "l1", start: 0, seconds: 1.5 },
      { id: "l2", start: 1.5, seconds: 2 },
    ]);
  });

  it("never makes a scene shorter than its own `seconds`", async () => {
    const { buildTiming } = await loadScript<Timing>("video-core", "scripts/timing.mjs");
    const t = buildTiming(
      video([{ id: "a", kind: "title", seconds: 5, narration: ["l1"] }]),
      () => 1,
      0.3,
    );
    expect(t.scenes[0].seconds).toBe(5);
  });

  it("runs as a process on fixture audio and writes timing.json", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-timing-"));
    mkdirSync(path.join(dir, "voice"));
    writeFileSync(path.join(dir, "voice", "l1.wav"), wav(2.5));
    writeFileSync(
      path.join(dir, "video.json"),
      JSON.stringify(video([{ id: "a", kind: "title", narration: ["l1"], props: { text: "x" } }])),
    );
    const script = skillFile("video-core", "scripts/timing.mjs");
    const r = spawnSync("node", [script, dir], { encoding: "utf8" });
    expect(r.status).toBe(0);
    const t = JSON.parse(readFileSync(path.join(dir, "timing.json"), "utf8"));
    expect(t.scenes[0].seconds).toBeCloseTo(2.8, 2);
    const again = spawnSync("node", [script, dir], { encoding: "utf8" });
    expect(readFileSync(path.join(dir, "timing.json"), "utf8")).toBe(
      JSON.stringify(t, null, 2) + "\n",
    );
    expect(again.stdout).toBe(r.stdout);
  });

  it("fails clearly when a voice file is missing", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-timing-"));
    writeFileSync(
      path.join(dir, "video.json"),
      JSON.stringify(video([{ id: "a", kind: "title", narration: ["l9"], props: { text: "x" } }])),
    );
    const r = spawnSync("node", [skillFile("video-core", "scripts/timing.mjs"), dir], {
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/missing voice\/l9\.wav/);
  });
});
