import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ffPath, haveFF, makeClip, seconds, tmp } from "./video-edit-fixtures";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Wrap = {
  checkPath: (p: unknown, what?: string, o?: Loose) => string;
  checkOutput: (o: string, i: string, f?: boolean) => string;
  input: (f: string) => string[];
  encode: (o?: Loose) => string[];
};
type Cmds = {
  trimArgs: (o: Loose, i: Loose) => string[];
  speedArgs: (o: Loose, i: Loose) => string[];
  joinArgs: (o: Loose, i: Loose[]) => string[];
  gifArgs: (o: Loose, i: Loose) => string[];
  scenesArgs: (o: Loose) => string[];
  parseScenes: (t: string) => number[];
  sceneReport: (c: number[], s: number) => Loose;
  atempoChain: (f: number) => string;
};
const wrap = () => loadScript<Wrap>("video-edit", "scripts/ffwrap.mjs");
const cmds = () => loadScript<Cmds>("video-edit", "scripts/commands.mjs");
const info = { seconds: 6, audio: true, width: 320, height: 180, fps: 30 };

describe("video-edit file name guard", () => {
  it("refuses options, URLs and pseudo-files, control characters and odd extensions", async () => {
    const { checkPath } = await wrap();
    for (const bad of [
      "-i",
      "--help.mp4",
      "concat:a.mp4|b.mp4",
      "http://example.com/a.mp4",
      "pipe:0",
      "lavfi",
      "file:a.mp4",
      "a\nb.mp4",
      "notes.txt",
      "",
      undefined,
    ])
      expect(() => checkPath(bad as string, "input"), String(bad)).toThrow();
    expect(checkPath('a b\'s "q".mp4', "input")).toMatch(/a b's "q"\.mp4$/);
    expect(checkPath("C:\\clips\\a.mp4", "input")).toContain("a.mp4");
    expect(() => checkPath("out.exe", "output", { output: true })).toThrow(/mp4/);
  });

  it("never overwrites the input or an existing file without --force", async () => {
    const { checkOutput } = await wrap();
    const dir = tmp("guard");
    const f = path.join(dir, "a.mp4");
    writeFileSync(f, "x");
    expect(() => checkOutput(f, f, true)).toThrow(/is the input/);
    expect(() => checkOutput(f, path.join(dir, "b.mp4"), false)).toThrow(/--force/);
    expect(checkOutput(f, path.join(dir, "b.mp4"), true)).toBe(f);
  });

  it("lets ffmpeg read only the file protocol and encodes the same way every time", async () => {
    const { input, encode } = await wrap();
    expect(input("/a.mp4")).toEqual(["-protocol_whitelist", "file", "-i", "/a.mp4"]);
    const e = encode().join(" ");
    expect(e).toContain("-c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p");
    expect(e).toContain("-c:a aac -b:a 192k -ar 48000");
    expect(e).toContain("-movflags +faststart -fflags +bitexact");
    expect(encode({ best: true }).join(" ")).toContain("-preset slow -crf 16");
    expect(encode({ audio: false })).toContain("-an");
  });
});

describe("video-edit argument builders", () => {
  it("builds trim, and refuses a range that makes no sense", async () => {
    const { trimArgs } = await cmds();
    const a = trimArgs({ file: "/a.mp4", out: "/o.mp4", from: "1", to: "3.5" }, info).join(" ");
    expect(a).toContain("-i /a.mp4 -ss 1 -to 3.5");
    expect(() => trimArgs({ file: "/a", out: "/o", from: 3, to: 2 }, info)).toThrow(/after/);
    expect(() => trimArgs({ file: "/a", out: "/o", from: 0, to: 9 }, info)).toThrow(/past the end/);
    expect(() => trimArgs({ file: "/a", out: "/o", from: "x" }, info)).toThrow(/number/);
  });

  it("chains atempo within its 0.5 to 2 range", async () => {
    const { atempoChain, speedArgs } = await cmds();
    expect(atempoChain(1.5)).toBe("atempo=1.5");
    expect(atempoChain(4)).toBe("atempo=2,atempo=2");
    expect(atempoChain(0.25)).toBe("atempo=0.5,atempo=0.5");
    expect(speedArgs({ file: "/a", out: "/o", factor: 3 }, info).join(" ")).toContain(
      "setpts=PTS/3",
    );
    expect(
      speedArgs({ file: "/a", out: "/o", factor: 2 }, { ...info, audio: false }).join(" "),
    ).not.toContain("atempo");
    expect(() => speedArgs({ file: "/a", out: "/o", factor: 8 }, info)).toThrow(/0.25 to 4/);
  });

  it("joins clips at the first clip's size, and refuses a mix of sound and silence", async () => {
    const { joinArgs } = await cmds();
    const a = joinArgs({ files: ["/a.mp4", "/b.mp4"], out: "/o.mp4" }, [info, info]).join(" ");
    expect(a).toContain("scale=320:180:force_original_aspect_ratio=decrease,pad=320:180");
    expect(a).toContain("concat=n=2:v=1:a=1");
    expect(() =>
      joinArgs({ files: ["/a", "/b"], out: "/o" }, [info, { ...info, audio: false }]),
    ).toThrow(/sound/);
    expect(() => joinArgs({ files: ["/a"], out: "/o" }, [info])).toThrow(/two files/);
  });

  it("limits a gif's length, width and frame rate", async () => {
    const { gifArgs } = await cmds();
    expect(gifArgs({ file: "/a", out: "/o.gif" }, info).join(" ")).toContain(
      "palettegen=stats_mode=diff",
    );
    expect(() =>
      gifArgs({ file: "/a", out: "/o.gif", from: 0, to: 20 }, { ...info, seconds: 30 }),
    ).toThrow(/15 seconds/);
    expect(() => gifArgs({ file: "/a", out: "/o.gif", width: 2000 }, info)).toThrow(/64 to 720/);
    expect(() => gifArgs({ file: "/a", out: "/o.gif", fps: 60 }, info)).toThrow(/5 to 20/);
  });

  it("reads scene cuts and reports shots", async () => {
    const { parseScenes, sceneReport } = await cmds();
    expect(
      parseScenes(
        "frame:0    pts:60      pts_time:2\nlavfi.scd.score=40\nframe:1    pts:120     pts_time:4",
      ),
    ).toEqual([2, 4]);
    const r = sceneReport([2, 4], 6);
    expect(r).toMatchObject({
      cuts: 2,
      shots: [2, 2, 2],
      averageShotSeconds: 2,
      cutsPerMinute: 20,
    });
    expect(sceneReport([], 5)).toMatchObject({ cuts: 0, shots: [5] });
  });
});

describe.skipIf(!haveFF)("video-edit on real files", () => {
  const dir = tmp("run");
  const clip = makeClip(path.join(dir, "in.mp4"), [
    { color: "red", seconds: 2 },
    { color: "lime", seconds: 2, tone: 660 },
    { color: "blue", seconds: 2 },
  ]);
  const cli = (...args: string[]) =>
    spawnSync(process.execPath, [skillFile("video-edit", "scripts/edit.mjs"), ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: ffPath, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
    });

  it("trims to the asked length and leaves the original alone", () => {
    const out = path.join(dir, "trim.mp4");
    const before = readFileSync(clip);
    const r = cli("trim", "--in", clip, "--out", out, "--from", "1", "--to", "3.5");
    expect(r.status, r.stderr).toBe(0);
    expect(seconds(out)).toBeCloseTo(2.5, 1);
    expect(readFileSync(clip).equals(before)).toBe(true);
    expect(r.stdout).not.toContain("sk-canary");
  });

  it("speeds up, joins and makes a gif", () => {
    const fast = path.join(dir, "fast.mp4");
    expect(cli("speed", "--in", clip, "--out", fast, "--factor", "2").status).toBe(0);
    expect(seconds(fast)).toBeCloseTo(3, 0);
    const joined = path.join(dir, "joined.mp4");
    expect(cli("join", "--in", `${clip},${fast}`, "--out", joined).status).toBe(0);
    expect(seconds(joined)).toBeCloseTo(9, 0);
    const gif = path.join(dir, "a.gif");
    expect(cli("gif", "--in", clip, "--out", gif, "--to", "3", "--width", "160").status).toBe(0);
    expect(readFileSync(gif).subarray(0, 6).toString("latin1")).toBe("GIF89a");
  });

  it("finds the two cuts in a three-colour clip and writes scenes.json", () => {
    const json = path.join(dir, "scenes.json");
    const r = cli("scenes", "--in", clip, "--out", json);
    expect(r.status, r.stderr).toBe(0);
    const report = JSON.parse(readFileSync(json, "utf8"));
    expect(report.cuts).toBe(2);
    expect(report.cutTimes[0]).toBeCloseTo(2, 0);
    expect(report.cutTimes[1]).toBeCloseTo(4, 0);
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(40);
  });

  it("gives the same bytes twice, refuses hostile names and an existing output", () => {
    const a = path.join(dir, "d1.mp4");
    const b = path.join(dir, "d2.mp4");
    cli("trim", "--in", clip, "--out", a, "--to", "2");
    cli("trim", "--in", clip, "--out", b, "--to", "2");
    expect(readFileSync(a).equals(readFileSync(b))).toBe(true);
    expect(cli("trim", "--in", "concat:a.mp4|b.mp4", "--out", path.join(dir, "x.mp4")).status).toBe(
      2,
    );
    expect(cli("trim", "--in", clip, "--out", a).stderr).toContain("--force");
    expect(cli("trim", "--in", clip, "--out", clip, "--force").stderr).toContain("is the input");
    expect(existsSync(path.join(dir, "x.mp4"))).toBe(false);
    expect(cli("nope", "--in", clip, "--out", path.join(dir, "n.mp4")).stderr).toContain(
      "Unknown command",
    );
  });
});
