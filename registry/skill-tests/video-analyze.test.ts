import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FF, ffPath, haveFF, makeClip, tmp } from "./video-edit-fixtures";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type M = {
  palette: (p: number[][], k?: number) => { hex: string; share: number }[];
  envelope: (s: Int16Array | number[], rate?: number) => number[];
  tempo: (e: number[]) => { bpm: number | null; confidence: number | null; note: string };
  speechStats: (w: Loose[], s: number) => Loose;
  movingShare: (c: number[], f?: number) => number | null;
  buildRecipe: (o: Loose) => Loose;
};
const m = () => loadScript<M>("video-analyze", "scripts/measure.mjs");

describe("analyze measurements", () => {
  it("finds the dominant colours, biggest first, the same every time", async () => {
    const { palette } = await m();
    const px = [
      ...Array(60).fill([255, 0, 0]),
      ...Array(30).fill([0, 0, 255]),
      ...Array(10).fill([250, 250, 250]),
    ];
    const p = palette(px, 3);
    expect(p).toEqual([
      { hex: "#ff0000", share: 0.6 },
      { hex: "#0000ff", share: 0.3 },
      { hex: "#fafafa", share: 0.1 },
    ]);
    expect(palette(px, 3)).toEqual(p);
    expect(() => palette([[0, 0, 0]], 3)).toThrow(/Too few/);
  });

  it("guesses 120 BPM from clicks every half second, and says when there is nothing to find", async () => {
    const { tempo, envelope } = await m();
    const rate = 8000;
    const samples = new Int16Array(rate * 20);
    for (let t = 0; t < 20; t += 0.5)
      for (let i = 0; i < 160; i++)
        samples[Math.round(t * rate) + i] = Math.round(12000 * Math.sin(i / 2));
    const r = tempo(envelope(samples));
    expect(r.bpm).toBe(120);
    expect(r.confidence).toBeGreaterThan(0.5);
    expect(r.note).toContain("heuristic");
    expect(tempo(envelope(new Int16Array(rate * 20))).bpm).toBeNull();
    expect(tempo(envelope(new Int16Array(rate * 3))).note).toContain("too short");
  });

  it("works out speech numbers from word times, and returns nulls without words", async () => {
    const { speechStats } = await m();
    const words = [
      { text: "Hello", start: 0, end: 0.5 },
      { text: "there.", start: 0.5, end: 1 },
      { text: "More", start: 4, end: 4.5 },
      { text: "words!", start: 4.5, end: 5 },
    ];
    expect(speechStats(words, 10)).toEqual({
      speechShare: 0.2,
      wordsPerMinute: 24,
      openingEndsAt: 1,
      lastSentenceStartsAt: 4,
    });
    expect(speechStats([], 10).speechShare).toBeNull();
  });

  it("counts the moving share, and keeps only numbers in the recipe (no words, no pixels)", async () => {
    const { movingShare, buildRecipe } = await m();
    expect(movingShare([0, 0, 5, 7], 1)).toBe(0.5);
    expect(movingShare([])).toBeNull();
    const r = buildRecipe({
      name: "ref",
      file: "a.mp4",
      sha256: "ab",
      rights: "own",
      info: { seconds: 20, width: 1080, height: 1920, fps: 30 },
      scenes: { cuts: 2, cutTimes: [3, 9], cutsPerMinute: 6, averageShotSeconds: 6.667 },
      shares: { moving: 0.4, sound: 0.9 },
      speech: {
        speechShare: null,
        wordsPerMinute: null,
        openingEndsAt: null,
        lastSentenceStartsAt: null,
      },
      colors: [{ hex: "#000000", share: 1 }],
      beat: { bpm: null, confidence: null, note: "x" },
    });
    expect(r.pace).toMatchObject({ cuts: 2, hookSeconds: 3 });
    expect(r.statement).toContain("No footage, audio, script, characters or text");
    expect(r.notMeasured).toContain("what is said");
    expect(r.reference.rightsNote).toContain("not verified");
  });
});

describe.skipIf(!haveFF)("analyze on a real file", () => {
  const dir = tmp("analyze");
  const clip = makeClip(path.join(dir, "ref.mp4"), [
    { color: "red", seconds: 3, tone: 440 },
    { color: "lime", seconds: 3, tone: null },
    { color: "blue", seconds: 4, tone: 660 },
  ]);
  const cli = (...a: string[]) =>
    spawnSync(process.execPath, [skillFile("video-analyze", "scripts/analyze.mjs"), ...a], {
      encoding: "utf8",
      cwd: dir,
      env: {
        ...process.env,
        PATH: ffPath,
        HOME: tmp("nohome"),
        ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000",
      },
    });

  it("refuses without a rights basis, with 'none', and with a bad name, and writes nothing", () => {
    expect(cli(clip, "--name", "ref").stdout).toContain("--rights own|permission|cc|public-domain");
    expect(cli(clip, "--name", "ref", "--rights", "none").stdout).toContain("will not analyse");
    expect(cli(clip, "--name", "Bad Name", "--rights", "own").stdout).toContain("--name must be");
    expect(cli(clip, "--name", "ref", "--rights", "own").status).toBe(0);
    expect(existsSync(path.join(dir, "recipes", "bad name.json"))).toBe(false);
  });

  it("measures pace, shares and palette of a known clip and stores numbers only", () => {
    const r = cli(clip, "--name", "known", "--rights", "own", "--force", "--no-transcript");
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(40);
    expect(r.stdout + r.stderr).not.toContain("sk-canary");
    const recipe = JSON.parse(readFileSync(path.join(dir, "recipes", "known.json"), "utf8"));
    expect(recipe.pace.cuts).toBe(2);
    expect(recipe.pace.hookSeconds).toBeCloseTo(3, 0);
    expect(recipe.pace.averageShotSeconds).toBeCloseTo(3.333, 1);
    expect(recipe.shares.sound).toBeCloseTo(0.7, 1); // 3 s of silence in 10 s
    expect(recipe.format).toEqual({ width: 320, height: 180, fps: 30 });
    // video compression moves each colour a little, so compare by channel
    const near = (hex: string, want: number[]) =>
      [1, 3, 5].every((k, c) => Math.abs(parseInt(hex.slice(k, k + 2), 16) - want[c]) < 12);
    for (const want of [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
    ])
      expect(
        recipe.palette.some((c: Loose) => near(c.hex, want)),
        JSON.stringify(want),
      ).toBe(true);
    expect(recipe.shares.speech).toBeNull();
    expect(recipe.reference).toMatchObject({ file: "ref.mp4", rights: "own" });
    expect(JSON.stringify(recipe)).not.toMatch(/\.mp4"\s*,\s*"path|\/var\/|\/private\//); // no machine paths
    expect(r.stdout).toContain("numbers only");
  });

  it("will not overwrite a recipe without --force, and refuses hostile names", () => {
    expect(cli(clip, "--name", "known", "--rights", "own", "--no-transcript").stderr).toContain(
      "--force",
    );
    expect(cli("concat:a.mp4|b.mp4", "--name", "x", "--rights", "own").status).toBe(2);
    expect(cli(path.join(dir, "missing.mp4"), "--name", "x", "--rights", "own").stdout).toContain(
      "does not exist",
    );
  });

  it("guesses the tempo of a click track and still stores only numbers", () => {
    const track = path.join(dir, "clicks.mp4");
    spawnSync(FF!, [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x303030:s=320x180:r=30:d=20",
      "-f",
      "lavfi",
      "-i",
      "aevalsrc='if(lt(mod(t,0.5),0.02),sin(2*PI*1000*t),0)':s=8000:d=20",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      track,
    ]);
    const r = cli(track, "--name", "clicks", "--rights", "cc", "--no-transcript");
    expect(r.status, r.stderr).toBe(0);
    const recipe = JSON.parse(readFileSync(path.join(dir, "recipes", "clicks.json"), "utf8"));
    expect(recipe.tempo.bpm).toBe(120);
  });
});

describe("the skill itself", () => {
  it("has no network access, byte-identical shared files, and a short SKILL.md", () => {
    expect(readFileSync(skillFile("video-analyze", "skill.meta.yaml"), "utf8")).toContain(
      "network: false",
    );
    expect(
      readFileSync(skillFile("video-analyze", "SKILL.md"), "utf8").split("\n").length,
    ).toBeLessThanOrEqual(150);
    for (const [f, from] of [
      ["scripts/run.mjs", "video-core"],
      ["scripts/_lib.mjs", "video-core"],
      ["scripts/ffwrap.mjs", "video-edit"],
      ["scripts/_whisper.mjs", "video-edit"],
    ] as const)
      expect(readFileSync(skillFile("video-analyze", f), "utf8")).toBe(
        readFileSync(skillFile(from, f), "utf8"),
      );
  });
});
