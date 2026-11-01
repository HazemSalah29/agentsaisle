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
};
type Qa = { qaProject: (o: Loose) => Promise<{ results: Loose[]; facts: Loose }> };
const checks = () => loadScript<Checks>("video-qa", "scripts/_checks.mjs");
const qa = () => loadScript<Qa>("video-qa", "scripts/qa.mjs");

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
const GOOD_V = `${seg(0)};${seg(1)};${seg(2)};[v0][v1][v2]concat=n=3:v=1:a=0[v]`;

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
