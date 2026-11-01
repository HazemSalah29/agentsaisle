import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FF, ffPath, haveFF, tmp } from "./video-edit-fixtures";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type P = {
  fillGaps: (s: Loose[]) => Loose[] | null;
  smoothPath: (
    s: Loose[],
    o: Loose,
  ) => { points: { t: number; x: number }[]; coverage: number } | null;
  simplify: (p: { t: number; x: number }[], eps: number) => { t: number; x: number }[];
  keyframes: (p: { t: number; x: number }[], max?: number) => { t: number; x: number }[];
  cropExpr: (k: { t: number; x: number }[]) => string;
  fixedLeft: (m: string, o: Loose) => number;
  cropSize: (s: Loose, w: number, h: number) => { cropW: number; cropH: number };
};
type Cmds = {
  parseSize: (t: string) => number[];
  readDetections: (r: unknown) => Loose[];
  reframeArgs: (o: Loose, i: Loose) => string[];
};
const p = () => loadScript<P>("video-edit", "scripts/reframe-path.mjs");
const cmds = () => loadScript<Cmds>("video-edit", "scripts/commands.mjs");

const SRC = { srcW: 1920, srcH: 1080 };
/** A crop 9:16 of a 1920x1080 picture is 608 px wide. */
const CROP = 608;
// A synthetic speaker: walks from 20% to 80% of the width over 12 s, wobbles, is lost for a moment twice.
const subject = (t: number) => 0.2 + (0.6 * t) / 12 + 0.01 * Math.sin(t * 7);
const samples = (lost: (t: number) => boolean) =>
  Array.from({ length: 37 }, (_, i) => ({ t: i / 3, cx: lost(i / 3) ? null : subject(i / 3) }));

describe("reframe path maths", () => {
  it("holds the last place through a missing face and starts from the first one seen", async () => {
    const { fillGaps } = await p();
    const f = fillGaps([
      { t: 0, cx: null },
      { t: 1, cx: 0.3 },
      { t: 2, cx: null },
      { t: 3, cx: 0.6 },
    ])!;
    expect(f.map((s) => s.cx)).toEqual([0.3, 0.3, 0.3, 0.6]);
    expect(f.map((s) => s.seen)).toEqual([false, true, false, true]);
    expect(fillGaps([{ t: 0, cx: null }])).toBeNull();
  });

  it("keeps a moving speaker inside the crop all the time, with no jump", async () => {
    const { smoothPath } = await p();
    const r = smoothPath(
      samples((t) => (t > 3 && t < 3.7) || (t > 8 && t < 9)),
      { ...SRC, cropW: CROP },
    )!;
    for (const pt of r.points) {
      const face = subject(pt.t) * SRC.srcW;
      expect(face, `t=${pt.t}`).toBeGreaterThan(pt.x + 40);
      expect(face).toBeLessThan(pt.x + CROP - 40);
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(SRC.srcW - CROP);
    }
    // never faster than half a crop width a second
    r.points.slice(1).forEach((q, i) => {
      const dt = q.t - r.points[i].t;
      expect(Math.abs(q.x - r.points[i].x) / dt).toBeLessThanOrEqual(0.5 * CROP + 0.01);
    });
    expect(r.coverage).toBeGreaterThan(0.8);
  });

  it("ignores a one-sample wrong detection and a tiny wobble (dead band)", async () => {
    const { smoothPath } = await p();
    const still = Array.from({ length: 30 }, (_, i) => ({
      t: i / 3,
      cx: 0.5 + (i % 2 ? 0.01 : -0.01),
    }));
    const calm = smoothPath(still, { ...SRC, cropW: CROP })!;
    expect(new Set(calm.points.map((q) => Math.round(q.x))).size).toBeLessThanOrEqual(2);
    const glitch = still.map((s, i) => (i === 12 ? { ...s, cx: 0.95 } : s));
    const g = smoothPath(glitch, { ...SRC, cropW: CROP })!;
    expect(
      Math.max(...g.points.map((q) => q.x)) - Math.min(...g.points.map((q) => q.x)),
    ).toBeLessThan(40);
  });

  it("clamps the crop inside the picture when the face is at an edge", async () => {
    const { smoothPath } = await p();
    const left = smoothPath(
      Array.from({ length: 10 }, (_, i) => ({ t: i / 3, cx: 0.02 })),
      { ...SRC, cropW: CROP },
    )!;
    expect(left.points.every((q) => q.x === 0)).toBe(true);
    const right = smoothPath(
      Array.from({ length: 10 }, (_, i) => ({ t: i / 3, cx: 0.99 })),
      { ...SRC, cropW: CROP },
    )!;
    expect(right.points.every((q) => q.x === SRC.srcW - CROP)).toBe(true);
  });

  it("reduces a long path to few keyframes that stay close, and writes an expression ffmpeg can read", async () => {
    const { smoothPath, keyframes, cropExpr, simplify } = await p();
    const long = Array.from({ length: 3600 }, (_, i) => ({
      t: i / 3,
      cx: 0.3 + 0.4 * Math.sin(i / 200) ** 2,
    }));
    const r = smoothPath(long, { ...SRC, cropW: CROP })!;
    const keys = keyframes(r.points, 60);
    expect(keys.length).toBeLessThanOrEqual(60);
    expect(
      simplify(
        [
          { t: 0, x: 0 },
          { t: 1, x: 5 },
          { t: 2, x: 10 },
        ],
        1,
      ),
    ).toHaveLength(2);
    expect(cropExpr([{ t: 0, x: 100 }])).toBe("100");
    expect(
      cropExpr([
        { t: 0, x: 100 },
        { t: 2, x: 200 },
      ]),
    ).toBe("if(lt(t,2),100+(100)*(t-0)/2,200)");
    expect(() => cropExpr([])).toThrow(/no keyframes/);
  });

  it("sizes the crop for the target shape and refuses a picture that is already narrow", async () => {
    const { cropSize, fixedLeft } = await p();
    expect(cropSize(SRC.srcW ? { srcW: 1920, srcH: 1080 } : {}, 1080, 1920)).toEqual({
      cropW: 608,
      cropH: 1080,
    });
    expect(() => cropSize({ srcW: 1080, srcH: 1920 }, 1080, 1920)).toThrow(/already as narrow/);
    expect(() => cropSize({ srcW: undefined, srcH: 1080 } as Loose, 1080, 1920)).toThrow(
      /not known/,
    );
    expect(fixedLeft("center", { srcW: 1920, srcH: 1080, cropW: 608 } as Loose)).toBe(656);
    expect(fixedLeft("left", { srcW: 1920, cropW: 608 })).toBe(0);
    expect(fixedLeft("right", { srcW: 1920, cropW: 608 })).toBe(1312);
    expect(fixedLeft("x=0.5", { srcW: 1920, cropW: 608 })).toBe(656);
    expect(() => fixedLeft("x=2", { srcW: 1920, cropW: 608 })).toThrow(/Unknown --mode/);
    expect(() => fixedLeft("middle", { srcW: 1920, cropW: 608 })).toThrow(/Unknown --mode/);
  });

  it("checks sizes and detections files", async () => {
    const { parseSize, readDetections, reframeArgs } = await cmds();
    expect(parseSize("1080x1920")).toEqual([1080, 1920]);
    for (const bad of ["1081x1920", "100x100", "axb", "1080*1920", "9000x9000"])
      expect(() => parseSize(bad), bad).toThrow(/--size/);
    expect(
      readDetections([
        { t: 0, cx: 0.5 },
        { t: 1, cx: null },
      ]),
    ).toHaveLength(2);
    expect(() =>
      readDetections([
        { t: 1, cx: 0.5 },
        { t: 0, cx: 0.5 },
      ]),
    ).toThrow(/in order/);
    expect(() =>
      readDetections([
        { t: 0, cx: 2 },
        { t: 1, cx: 0.5 },
      ]),
    ).toThrow(/0 to 1/);
    expect(() => readDetections([])).toThrow(/2 to 20000/);
    const a = reframeArgs(
      {
        file: "/a.mp4",
        out: "/o.mp4",
        keys: [{ t: 0, x: 100 }],
        cropW: 608,
        cropH: 1080,
        size: [1080, 1920],
      },
      { audio: true },
    ).join(" ");
    expect(a).toContain("crop=w=608:h=1080:x='100':y=0,scale=1080:1920:flags=lanczos,setsar=1");
    expect(a).toContain("-c:a copy");
  });
});

describe.skipIf(!haveFF)("reframe on real files", () => {
  const dir = tmp("reframe");
  const wide = path.join(dir, "wide.mp4");
  // 16:9 picture with a bright vertical bar that walks left to right: the "speaker"
  spawnSync(FF!, [
    "-y",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x202020:s=640x360:r=30:d=6",
    "-f",
    "lavfi",
    "-i",
    "color=c=white:s=40x360:r=30:d=6",
    "-f",
    "lavfi",
    "-i",
    "sine=duration=6",
    "-filter_complex",
    "[0][1]overlay=x='40+90*t':y=0[v]",
    "-map",
    "[v]",
    "-map",
    "2:a",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    wide,
  ]);
  const cli = (...a: string[]) =>
    spawnSync(process.execPath, [skillFile("video-edit", "scripts/edit.mjs"), ...a], {
      encoding: "utf8",
      env: { ...process.env, PATH: ffPath },
    });
  const dims = (f: string) =>
    spawnSync(
      FF!.replace(/ffmpeg$/, "ffprobe"),
      ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", f],
      { encoding: "utf8" },
    )
      .stdout.trim()
      .split("\n")[0];
  /** Where the white bar is at time t in the output: the column with the highest brightness. */
  const barAt = (f: string, t: number) => {
    const r = spawnSync(
      FF!,
      [
        "-v",
        "error",
        "-ss",
        String(t),
        "-i",
        f,
        "-frames:v",
        "1",
        "-vf",
        "scale=90:160",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "gray",
        "-",
      ],
      { encoding: "buffer" },
    );
    const row = r.stdout.subarray(80 * 90, 81 * 90);
    return row.indexOf(Math.max(...row));
  };

  it("follows a moving subject: the bar stays in the picture the whole time", () => {
    const det = path.join(dir, "faces.json");
    // the bar's middle, as a fraction of the width, every 1/3 s (40 + 90 t + 20 px of 640)
    writeFileSync(
      det,
      JSON.stringify(
        Array.from({ length: 17 }, (_, i) => ({ t: i / 3, cx: (60 + 90 * (i / 3)) / 640 })),
      ),
    );
    const out = path.join(dir, "follow.mp4");
    const r = cli("reframe", "--in", wide, "--out", out, "--detections", det, "--size", "540x960");
    expect(r.status, r.stderr).toBe(0);
    expect(dims(out)).toBe("540,960");
    for (const t of [0.5, 2, 3.5, 5]) {
      const col = barAt(out, t);
      expect(col, `t=${t}`).toBeGreaterThan(5);
      expect(col).toBeLessThan(85);
    }
    // a fixed centre crop loses the bar early on (it is outside the middle third), the followed crop does not
    const centre = path.join(dir, "centre.mp4");
    expect(
      cli("reframe", "--in", wide, "--out", centre, "--mode", "center", "--size", "540x960").status,
    ).toBe(0);
    expect(barAt(centre, 0.5)).toBeLessThanOrEqual(1);
    expect(r.stdout).toContain("Face found in 100%");
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(40);
  });

  it("places a fixed crop, writes the path with --plan, and refuses a vertical source or too few faces", () => {
    const plan = path.join(dir, "path.json");
    const out = path.join(dir, "left.mp4");
    expect(
      cli("reframe", "--in", wide, "--out", out, "--mode", "left", "--plan", plan).status,
    ).toBe(0);
    expect(
      cli("reframe", "--in", out, "--out", path.join(dir, "again.mp4"), "--mode", "center").stderr,
    ).toContain("already as narrow");
    const none = path.join(dir, "none.json");
    writeFileSync(
      none,
      JSON.stringify(
        Array.from({ length: 10 }, (_, i) => ({ t: i / 3, cx: i === 0 ? 0.5 : null })),
      ),
    );
    expect(
      cli("reframe", "--in", wide, "--out", path.join(dir, "x.mp4"), "--detections", none).stderr,
    ).toContain("too few");
    writeFileSync(none, JSON.stringify(Array.from({ length: 4 }, (_, i) => ({ t: i, cx: null }))));
    expect(
      cli("reframe", "--in", wide, "--out", path.join(dir, "y.mp4"), "--detections", none).stderr,
    ).toContain("No face was found");
    expect(
      cli("reframe", "--in", wide, "--out", path.join(dir, "z.mp4"), "--mode", "middle").stderr,
    ).toContain("Unknown --mode");
    // a refused run leaves no half-written file behind
    expect(existsSync(path.join(dir, "z.mp4"))).toBe(false);
  });
});
