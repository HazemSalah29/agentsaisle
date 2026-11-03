import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Checks = {
  parseEbur128: (s: string) => { lufs: number | null; truePeak: number | null } | null;
  parseBlack: (s: string) => Loose[];
  parseFreeze: (s: string) => Loose[];
  parseSignalstats: (s: string) => Loose[];
  flashes: (f: Loose[], change?: number) => { worst: number; at: number };
  contrast: (a: string, b: string) => number;
  textProblems: (s: string) => { level: string; text: string }[];
  sheetTimes: (t: Loose, max?: number) => number[];
  idleStretches: (m: Loose[], o: Loose) => Loose[];
  changedCells: (b: Uint8Array, w: number, h: number, o?: Loose) => { t: number; cells: number }[];
  fastRuns: (m: Loose[], o: Loose) => Loose[];
  hardSwaps: (m: Loose[], b: Loose[], o: Loose) => Loose[];
  shortScenes: (t: Loose | null, min: number) => Loose[];
  transitionWindows: (t: Loose, v: Loose) => number[][];
  applyLessons: (r: Loose, l: unknown) => { rules: Loose; applied: string[]; ignored: string[] };
};
type Qa = { qaProject: (o: Loose) => Promise<{ results: Loose[]; facts: Loose }> };
const checks = () => loadScript<Checks>("video-qa", "scripts/_checks.mjs");
const qa = () => loadScript<Qa>("video-qa", "scripts/qa.mjs");

describe("transition windows", () => {
  it("covers only the moving transitions, from just before a scene to the end of its transition", async () => {
    const { transitionWindows } = await checks();
    const timing = {
      scenes: [
        { id: "a", start: 0, seconds: 4 },
        { id: "b", start: 4, seconds: 4 },
        { id: "c", start: 8, seconds: 4 },
        { id: "d", start: 12, seconds: 4 },
      ],
    };
    const video = {
      scenes: [
        { id: "a" },
        { id: "b", transitionIn: "slash" },
        { id: "c", transitionIn: "fade" },
        { id: "d", transitionIn: "whip", transitionSeconds: 0.4 },
      ],
    };
    const w = transitionWindows(timing, video);
    expect(w).toHaveLength(2); // the fade is not a moving transition
    expect(w[0][0]).toBeCloseTo(3.85);
    expect(w[0][1]).toBeCloseTo(4.95);
    expect(w[1][1]).toBeCloseTo(12.55);
    expect(transitionWindows(null, video)).toEqual([]);
  });
});

describe("changed cells", () => {
  const frame = (w: number, h: number, v: number, dots: [number, number][] = []) => {
    const f = new Uint8Array(w * h).fill(v);
    for (const [x, y] of dots) f[y * w + x] = 255;
    return f;
  };
  const cat = (...fs: Uint8Array[]) => Uint8Array.from(fs.flatMap((f) => [...f]));
  it("is zero for a still picture, whatever the level, and counts every cell that moved", async () => {
    const { changedCells } = await checks();
    const still = changedCells(cat(frame(4, 4, 20), frame(4, 4, 20), frame(4, 4, 20)), 4, 4);
    expect(still.map((c) => c.cells)).toEqual([0, 0]);
    const moved = changedCells(cat(frame(4, 4, 20, [[0, 0]]), frame(4, 4, 20, [[1, 0]])), 4, 4);
    expect(moved).toEqual([{ t: 0.1, cells: 2 }]); // one cell lit, one cell dark again
  });
  it("ignores small noise but not a real change, and uses the sample spacing for time", async () => {
    const { changedCells } = await checks();
    const noisy = changedCells(cat(frame(4, 4, 100), frame(4, 4, 104)), 4, 4, { cellDiff: 10 });
    expect(noisy[0].cells).toBe(0);
    const real = changedCells(cat(frame(4, 4, 100), frame(4, 4, 140)), 4, 4, {
      cellDiff: 10,
      dt: 0.5,
    });
    expect(real).toEqual([{ t: 0.5, cells: 16 }]);
    expect(changedCells(new Uint8Array(10), 4, 4)).toEqual([]); // less than two frames
  });
  it("feeds idleStretches through the key option", async () => {
    const { idleStretches } = await checks();
    const series = [...Array(15).fill(0), 9, 9, ...Array(5).fill(0)].map((cells, i) => ({
      t: (i + 1) / 10,
      cells,
    }));
    expect(idleStretches(series, { epsilon: 3, key: "cells", minSeconds: 1.2 })).toEqual([
      { start: 0, seconds: expect.closeTo(1.5) },
    ]);
  });
});

describe("video-qa motion checks", () => {
  const m = (ys: number[], dt = 0.1) => ys.map((YAVG, i) => ({ t: (i + 1) * dt, YAVG }));
  it("finds a long run with no change, but not a short one, an ignored one or the end hold", async () => {
    const { idleStretches } = await checks();
    const moving = Array(10).fill(2);
    const rows = m([...moving, ...Array(15).fill(0.05), ...moving]);
    expect(idleStretches(rows, { epsilon: 0.3, minSeconds: 1.2 })).toEqual([
      { start: 1, seconds: expect.closeTo(1.5) },
    ]);
    expect(idleStretches(rows, { epsilon: 0.3, minSeconds: 1.6 })).toEqual([]);
    expect(idleStretches(rows, { epsilon: 0.3, minSeconds: 1.2, ignore: [[1.5, 2.6]] })).toEqual(
      [],
    );
  });
  it("tells a sustained fast move from a single cut", async () => {
    const { fastRuns } = await checks();
    const rows = m([1, 1, 90, 1, 1, 60, 70, 65, 1, 1]);
    const out = fastRuns(rows, { limit: 30, minSamples: 3 });
    expect(out).toHaveLength(1);
    expect(out[0].start).toBeCloseTo(0.5);
    expect(fastRuns(rows, { limit: 30, minSamples: 3, ignore: [[0.6, 0.8]] })).toEqual([]);
  });
  it("reports a one-frame swap but not a transition spread over several samples", async () => {
    const { hardSwaps } = await checks();
    const rule = { floor: 20, ratio: 4 };
    const cut = m([1, 1, 1, 1, 1, 80, 1, 1, 1, 1, 1, 1]);
    expect(hardSwaps(cut, [{ t: 0.6, id: "b" }], rule)).toHaveLength(1);
    const wipe = m([1, 1, 1, 1, 30, 40, 35, 30, 1, 1, 1, 1]);
    expect(hardSwaps(wipe, [{ t: 0.6, id: "b" }], rule)).toEqual([]);
  });
  it("lists short scenes", async () => {
    const { shortScenes } = await checks();
    const timing = {
      scenes: [
        { id: "a", seconds: 1.4 },
        { id: "b", seconds: 3 },
      ],
    };
    expect(shortScenes(timing, 2)).toEqual([{ id: "a", seconds: 1.4 }]);
    expect(shortScenes(null, 2)).toEqual([]);
  });
  it("applies only known, in-range lessons", async () => {
    const { applyLessons } = await checks();
    const rules = JSON.parse(
      readFileSync(
        path.join(__dirname, "..", "official", "video-qa", "assets", "rules.json"),
        "utf8",
      ),
    );
    const out = applyLessons(rules, {
      maxIdleSeconds: 2,
      minSceneSeconds: 99,
      nope: 1,
      maxFastDiff: "x",
    });
    expect(out.rules.motion.idle.maxSeconds).toBe(2);
    expect(out.rules.motion.minSceneSeconds).toBe(2); // 99 is out of range
    expect(out.ignored.sort()).toEqual(["maxFastDiff", "minSceneSeconds", "nope"]);
    expect(rules.motion.idle.maxSeconds).toBe(1.2); // the originals are untouched
    expect(applyLessons(rules, null).applied).toEqual([]);
  });
});

describe("video-qa parsers", () => {
  it("reads loudness and true peak from an ebur128 summary", async () => {
    const { parseEbur128 } = await checks();
    const log = `[Parsed_ebur128_0 @ 0x1] Summary:\n\n  Integrated loudness:\n    I:         -14.3 LUFS\n    Threshold: -24.3 LUFS\n\n  True peak:\n    Peak:       -1.8 dBFS\n`;
    expect(parseEbur128(log)).toEqual({ lufs: -14.3, truePeak: -1.8 });
    expect(parseEbur128("nothing here")).toBeNull();
  });

  it("reads black, freeze and per-frame stats", async () => {
    const { parseBlack, parseFreeze, parseSignalstats } = await checks();
    expect(
      parseBlack("[blackdetect @ 0x1] black_start:2 black_end:3.2 black_duration:1.2"),
    ).toEqual([{ start: 2, end: 3.2, seconds: 1.2 }]);
    expect(
      parseFreeze(
        "lavfi.freezedetect.freeze_start: 1.5\nlavfi.freezedetect.freeze_duration: 4\nlavfi.freezedetect.freeze_end: 5.5",
      ),
    ).toEqual([{ start: 1.5, seconds: 4 }]);
    const stats =
      "frame:0    pts:0       pts_time:0\nlavfi.signalstats.YMIN=16\nlavfi.signalstats.YMAX=235\nframe:1    pts:1       pts_time:0.0333\nlavfi.signalstats.YMIN=16";
    expect(parseSignalstats(stats)).toEqual([
      { t: 0, YMIN: 16, YMAX: 235 },
      { t: 0.0333, YMIN: 16 },
    ]);
  });

  it("counts flashes: a rise and fall of at least 10% each, per second", async () => {
    const { flashes } = await checks();
    const frames = (ys: number[], dt = 1 / 30) => ys.map((YAVG, i) => ({ t: i * dt, YAVG }));
    const strobe = frames(Array.from({ length: 30 }, (_, i) => (i % 2 ? 230 : 20)));
    expect(flashes(strobe).worst).toBeGreaterThan(3);
    const fade = frames(Array.from({ length: 30 }, (_, i) => 20 + i * 2)); // slow change
    expect(flashes(fade).worst).toBe(0);
    const once = frames([20, 20, 230, 230, 20, 20]);
    expect(flashes(once).worst).toBeLessThanOrEqual(3);
  });

  it("computes WCAG contrast, finds placeholders and plans the contact sheet", async () => {
    const { contrast, textProblems, sheetTimes } = await checks();
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#808080")).toBeLessThan(1.2);
    expect(textProblems("Fix this TODO later")[0]).toMatchObject({ level: "fail" });
    expect(textProblems("a claim [needs-source]")[0].level).toBe("fail");
    expect(textProblems("the the cache")[0]).toMatchObject({ level: "warn" });
    expect(textProblems("A clean sentence.")).toEqual([]);
    const timing = {
      totalSeconds: 10,
      scenes: [
        { start: 0, seconds: 4 },
        { start: 4, seconds: 6 },
      ],
    };
    const t = sheetTimes(timing);
    expect(t).toContain(2.8);
    expect(t).toContain(8.2);
    expect([...t].sort((a, b) => a - b)).toEqual(t);
    expect(sheetTimes({ totalSeconds: 200, scenes: timing.scenes }, 24).length).toBeLessThanOrEqual(
      24,
    );
  });
});

describe("video-qa runner copy", () => {
  it("is byte-identical to the video-core runner, which refuses other programs", () => {
    expect(readFileSync(skillFile("video-qa", "scripts/run.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "scripts/run.mjs"), "utf8"),
    );
  });
});

// Fixtures made with ffmpeg itself, each with one deliberate defect. Skipped on machines without ffmpeg.
const FF = [process.env.FFMPEG, "ffmpeg", path.join(os.homedir(), "bin", "ffmpeg")].find(
  (p) => p && spawnSync(p, ["-version"]).status === 0,
);
const x264 = FF
  ? spawnSync(FF, ["-hide_banner", "-encoders"], { encoding: "utf8" }).stdout.includes("libx264")
  : false;
const FFDIR = FF ? path.dirname(path.resolve(FF === "ffmpeg" ? "/usr/bin/ffmpeg" : FF)) : "";

const W = 304;
const H = 540;
const seg = (i: number, extra = "", color = "0x0F1115") =>
  `color=c=${color}:s=${W}x${H}:r=30:d=2,drawbox=x=${60 + i * 50}:y=200:w=60:h=60:color=white:t=fill${extra}[v${i}]`;
// A box that swings side to side for the whole six seconds: always moving, no swap between scenes.
const GOOD_V = `color=c=0x0F1115:s=${W}x${H}:r=30:d=6[bg];color=c=white:s=60x60:r=30:d=6[sq];[bg][sq]overlay=x='100+80*sin(PI*t)':y=200[v]`;

function fixture(name: string, o: { graph?: string; audio?: string | null; voice?: boolean } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), `qa-${name}-`));
  mkdirSync(path.join(dir, "out"));
  const out = path.join(dir, "out", `${path.basename(dir)}-draft.mp4`);
  const audio = o.audio === undefined ? "sine=frequency=440:duration=6,volume=2.5" : o.audio;
  const args = [
    "-y",
    "-loglevel",
    "error",
    "-filter_complex",
    o.graph ?? GOOD_V,
    ...(audio ? ["-f", "lavfi", "-i", audio] : []),
  ];
  args.push("-map", "[v]", ...(audio ? ["-map", "0:a"] : []));
  // the audio input is the only -i, so it is input 0
  const r = spawnSync(
    FF!,
    [
      ...args,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      ...(audio ? ["-c:a", "aac", "-shortest"] : []),
      out,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`fixture ${name}: ${r.stderr}`);
  writeFileSync(
    path.join(dir, "video.json"),
    JSON.stringify({
      version: 1,
      meta: { title: "t", type: "explainer", format: "reel-9x16", fps: 30, lang: "en" },
      ...(o.voice ? { voice: { provider: "kokoro" } } : {}),
      scenes: [0, 1, 2].map((i) => ({
        id: `s${i}`,
        kind: "title",
        durationFrom: "fixed",
        seconds: 2,
        props: { text: `Scene ${i}` },
      })),
    }),
  );
  writeFileSync(
    path.join(dir, "timing.json"),
    JSON.stringify({
      version: 1,
      fps: 30,
      totalFrames: 180,
      totalSeconds: 6,
      scenes: [0, 1, 2].map((i) => ({
        id: `s${i}`,
        startFrame: i * 60,
        frames: 60,
        start: i * 2,
        seconds: 2,
        lines: [],
      })),
    }),
  );
  return { dir, out };
}
const levels = (r: { results: Loose[] }, id: string) =>
  r.results.filter((x) => x.id === id).map((x) => x.level);

describe.skipIf(!FF || !x264)("video-qa on fixture videos", () => {
  const env = { PATH: `${FFDIR}${path.delimiter}${process.env.PATH}` };
  const go = async (f: { dir: string; out: string }) => {
    const prev = process.env.PATH;
    process.env.PATH = env.PATH;
    try {
      const { qaProject } = await qa();
      return await qaProject({ dir: f.dir, file: f.out, draft: true });
    } finally {
      process.env.PATH = prev;
    }
  };

  it("passes a clean video and writes a contact sheet", { timeout: 120_000 }, async () => {
    const f = fixture("good");
    const r = await go(f);
    const bad = r.results.filter((x) => x.level !== "pass");
    expect(bad, JSON.stringify(bad)).toEqual([]);
    expect(existsSync(path.join(f.dir, "qa", "contact-sheet.png"))).toBe(true);
    expect(r.facts.sheet.times.length).toBeGreaterThanOrEqual(3);
  });

  it(
    "warns when nothing moves, and when the picture swaps in one frame",
    { timeout: 120_000 },
    async () => {
      const still = await go(
        fixture("still", {
          graph: `color=c=0x0F1115:s=${W}x${H}:r=30:d=6,drawbox=x=100:y=200:w=60:h=60:color=white:t=fill[v]`,
        }),
      );
      expect(levels(still, "idle")).toContain("warn");
      const swap = await go(
        fixture("swap", {
          graph: `${seg(0)};${seg(1, "", "0xE0E0E0")};${seg(2)};[v0][v1][v2]concat=n=3:v=1:a=0[v]`,
        }),
      );
      expect(levels(swap, "joins")).toContain("warn");
      expect(levels(await go(fixture("clean-motion")), "idle")).toEqual(["pass"]);
      expect(levels(await go(fixture("clean-joins")), "joins")).toEqual(["pass"]);
    },
  );

  it(
    "sees a thin moving bar as motion, but not a still picture with compression noise",
    { timeout: 180_000 },
    async () => {
      const bar = await go(
        fixture("bar", {
          graph: `color=c=0x0F1115:s=${W}x${H}:r=30:d=6[bg];color=c=white:s=200x8:r=30:d=6[b];[bg][b]overlay=x='-100+90*t':y=260[v]`,
        }),
      );
      expect(levels(bar, "idle")).toEqual(["pass"]);
      const noisy = await go(
        fixture("noisy", {
          graph: `color=c=0x0F1115:s=${W}x${H}:r=30:d=6,drawbox=x=100:y=200:w=60:h=60:color=white:t=fill,noise=alls=5:allf=t[v]`,
        }),
      );
      expect(levels(noisy, "idle")).toEqual(["warn"]);
      expect(noisy.results.find((x) => x.id === "idle")!.text).toMatch(/scene s0/);
    },
  );

  it("applies the project's lessons and says what it ignored", { timeout: 120_000 }, async () => {
    const f = fixture("lessons", {
      graph: `color=c=0x0F1115:s=${W}x${H}:r=30:d=6,drawbox=x=100:y=200:w=60:h=60:color=white:t=fill[v]`,
    });
    writeFileSync(
      path.join(f.dir, "lessons.json"),
      JSON.stringify({ maxIdleSeconds: 9, minSceneSeconds: 3, bogus: 1 }),
    );
    const r = await go(f);
    expect(levels(r, "idle")).toEqual(["pass"]);
    expect(levels(r, "scene-length")).toEqual(["warn"]); // the three scenes last 2 s each
    expect(r.results.find((x) => x.id === "lessons")!.text).toContain("bogus");
  });

  it("catches a black stretch", { timeout: 120_000 }, async () => {
    const f = fixture("black", {
      graph: `${seg(0)};color=c=black:s=${W}x${H}:r=30:d=2[v1];${seg(2)};[v0][v1][v2]concat=n=3:v=1:a=0[v]`,
    });
    expect(levels(await go(f), "black")).toContain("fail");
  });

  it("catches fast flashing", { timeout: 120_000 }, async () => {
    const f = fixture("flash", {
      graph: `color=c=gray:s=${W}x${H}:r=30:d=6,geq=lum='255*mod(N,2)':cb=128:cr=128[v]`,
    });
    expect(levels(await go(f), "flashing")).toContain("fail");
  });

  it("catches something drawn in the margin", { timeout: 120_000 }, async () => {
    const f = fixture("margin", {
      graph: `${seg(0, `,drawbox=x=${W - 10}:y=100:w=10:h=300:color=white:t=fill`)};${seg(1)};${seg(2)};[v0][v1][v2]concat=n=3:v=1:a=0[v]`,
    });
    const r = await go(f);
    expect(levels(r, "safe-zone")).toContain("fail");
    expect(r.results.find((x) => x.id === "safe-zone")!.text).toContain("right margin");
  });

  it("warns when nothing changes for a long time", { timeout: 120_000 }, async () => {
    const f = fixture("freeze", {
      graph: `color=c=0x0F1115:s=${W}x${H}:r=30:d=6,drawbox=x=100:y=200:w=60:h=60:color=white:t=fill[v]`,
    });
    expect(levels(await go(f), "freeze")).toContain("warn");
  });

  it("catches clipping, silence and a missing audio track", { timeout: 180_000 }, async () => {
    expect(
      levels(
        await go(fixture("loud", { audio: "sine=frequency=440:duration=6,volume=12" })),
        "clipping",
      ),
    ).toContain("fail");
    expect(
      levels(
        await go(fixture("quiet", { audio: "sine=frequency=440:duration=6,volume=0.001" })),
        "loudness",
      ),
    ).toContain("fail");
    const none = await go(fixture("noaudio", { audio: null, voice: true }));
    expect(levels(none, "audio")).toContain("fail");
  });

  it("flags a missing voice line and a leftover placeholder", { timeout: 120_000 }, async () => {
    const f = fixture("content", { voice: true });
    const v = JSON.parse(readFileSync(path.join(f.dir, "video.json"), "utf8"));
    v.scenes[0].narration = ["l1"];
    v.scenes[0].props.text = "TODO write this";
    writeFileSync(path.join(f.dir, "video.json"), JSON.stringify(v));
    const r = await go(f);
    expect(levels(r, "voiced")).toContain("fail");
    expect(r.results.some((x) => x.id === "text" && x.level === "fail")).toBe(true);
  });

  it(
    "exits 1 on a failure, 0 on a pass and 2 when it cannot run, and never prints a key",
    { timeout: 180_000 },
    () => {
      const script = skillFile("video-qa", "scripts/qa.mjs");
      const run = (dir: string) =>
        spawnSync(process.execPath, [script, dir], {
          encoding: "utf8",
          env: { ...process.env, ...env, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
        });
      const good = run(fixture("cli-good").dir);
      expect(good.status).toBe(0);
      expect(good.stdout).toContain("QA PASS");
      expect(good.stdout.split("\n").length).toBeLessThanOrEqual(40);
      const bad = run(
        fixture("cli-bad", {
          graph: `color=c=gray:s=${W}x${H}:r=30:d=6,geq=lum='255*mod(N,2)':cb=128:cr=128[v]`,
        }).dir,
      );
      expect(bad.status).toBe(1);
      expect(bad.stdout).toContain("FAIL");
      expect(bad.stdout + good.stdout).not.toContain("sk-canary");
      const empty = mkdtempSync(path.join(os.tmpdir(), "qa-empty-"));
      expect(run(empty).status).toBe(2);
    },
  );
});
