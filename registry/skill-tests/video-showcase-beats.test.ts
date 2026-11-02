import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { ffPath, haveFF, tmp } from "./video-edit-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Beats = {
  analyse: (
    s: Float32Array,
    rate: number,
  ) => { bpm: number | null; beats: number[]; onsets: number[]; duration: number };
  snapScenes: (d: number[], beats: number[], o?: Loose) => number[];
};
const beats = () => loadScript<Beats>("video-showcase", "scripts/_beats.mjs");
const RATE = 22050;

/** A click track: a short decaying noise burst on every beat over a quiet 100 Hz hum. Seeded, so always the same. */
function track(bpm: number, seconds: number, first = 0.1) {
  const s = new Float32Array(Math.floor(seconds * RATE));
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (let i = 0; i < s.length; i++) s[i] = 0.02 * Math.sin((2 * Math.PI * 100 * i) / RATE);
  const times: number[] = [];
  for (let t = first; t < seconds - 0.05; t += 60 / bpm) {
    times.push(t);
    const o = Math.floor(t * RATE);
    for (let i = 0; i < 0.03 * RATE; i++) s[o + i] += 0.8 * rnd() * Math.exp(-i / (0.006 * RATE));
  }
  return { s, times };
}
const nearest = (list: number[], t: number) => Math.min(...list.map((b) => Math.abs(b - t)));

describe("beat detection", () => {
  for (const bpm of [90, 120, 140]) {
    it(`finds ${bpm} BPM within 2 and every beat within 50 ms`, async () => {
      const { analyse } = await beats();
      const { s, times } = track(bpm, 16);
      const r = analyse(s, RATE);
      expect(r.bpm).not.toBeNull();
      expect(Math.abs(r.bpm! - bpm)).toBeLessThan(2);
      for (const t of times) expect(nearest(r.beats, t)).toBeLessThan(0.05);
      expect(r.beats.length).toBeGreaterThanOrEqual(times.length - 1);
    });
  }
  it("is the same result twice", async () => {
    const { analyse } = await beats();
    const { s } = track(120, 10);
    expect(JSON.stringify(analyse(s, RATE))).toBe(JSON.stringify(analyse(s, RATE)));
  });
  it("finds no tempo in silence or in a steady hum", async () => {
    const { analyse } = await beats();
    expect(analyse(new Float32Array(RATE * 8), RATE).bpm).toBeNull();
    const hum = new Float32Array(RATE * 8).map(
      (_, i) => 0.3 * Math.sin((2 * Math.PI * 200 * i) / RATE),
    );
    expect(analyse(hum, RATE).beats).toEqual([]);
  });
});

describe("snapping scenes to beats", () => {
  const grid = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  it("moves a boundary to the nearest beat and keeps the total", async () => {
    const { snapScenes } = await beats();
    const out = snapScenes([1.1, 1.9, 2], grid);
    expect(out).toEqual([1, 2, 2]);
    expect(out.reduce((a, b) => a + b)).toBeCloseTo(5, 6);
  });
  it("leaves a boundary alone when no beat is within the tolerance", async () => {
    const { snapScenes } = await beats();
    expect(snapScenes([1.25, 3.75], grid, { tolerance: 0.1 })).toEqual([1.25, 3.75]);
  });
  it("only moves a boundary when both scenes beside it can change", async () => {
    const { snapScenes } = await beats();
    expect(snapScenes([1.1, 1.9, 2], grid, { movable: [true, false, true] })).toEqual([
      1.1, 1.9, 2,
    ]);
  });
  it("never makes a scene shorter than the minimum", async () => {
    const { snapScenes } = await beats();
    expect(snapScenes([0.9, 2], [0.5, 2.9], { minLen: 0.8, tolerance: 0.5 })).toEqual([0.9, 2]);
  });
});

function wavBytes(samples: Float32Array) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) =>
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2),
  );
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

describe.skipIf(!haveFF)("beats.mjs", () => {
  const run = (args: string[]) =>
    spawnSync(process.execPath, [skillFile("video-showcase", "scripts/beats.mjs"), ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: ffPath, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
    });
  it("reads a track, writes beats.json and snaps fixed scenes", () => {
    const dir = tmp("beats");
    writeFileSync(path.join(dir, "t.wav"), wavBytes(track(120, 12).s));
    const scenes = [
      { id: "a", kind: "title", durationFrom: "fixed", seconds: 2.1, props: { text: "A" } },
      { id: "b", kind: "title", durationFrom: "fixed", seconds: 3.9, props: { text: "B" } },
      { id: "c", kind: "screen", durationFrom: "fixed", seconds: 4, props: { asset: "x" } },
    ];
    writeFileSync(
      path.join(dir, "video.json"),
      JSON.stringify({
        version: 1,
        meta: { title: "t", type: "showcase", format: "youtube-16x9", fps: 30, lang: "en" },
        scenes,
      }),
    );
    const r = run([
      "--audio",
      path.join(dir, "t.wav"),
      "--out",
      path.join(dir, "beats.json"),
      "--into",
      path.join(dir, "video.json"),
      "--snap",
      "--offset",
      "0",
    ]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).not.toContain("sk-canary");
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(40);
    const b = JSON.parse(readFileSync(path.join(dir, "beats.json"), "utf8"));
    expect(Math.abs(b.bpm - 120)).toBeLessThan(2);
    const v = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
    // The first boundary (2.1 s) sits near a beat (2.1 = 0.1 + 4 x 0.5) and stays; the screen scene never moves.
    expect(v.scenes[2].seconds).toBe(4);
    expect(v.scenes[0].seconds + v.scenes[1].seconds).toBeCloseTo(6, 6);
  });
  it("refuses a URL as the audio", () => {
    const r = run(["--audio", "http://example.com/a.mp3"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/Refused/);
  });
});
