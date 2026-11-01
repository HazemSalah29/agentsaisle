import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FF, ffPath, haveFF, makeClip, seconds, tmp } from "./video-edit-fixtures";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Cmds = {
  LOUDNESS: Loose;
  filterPath: (p: string) => string;
  audioGraph: (o: Loose) => { graph: string; inputs: string[] };
  loudnormMeasureArgs: (o: Loose, i: Loose) => string[];
  loudnormApplyArgs: (o: Loose, i: Loose, m: Loose) => string[];
  parseLoudnorm: (s: string) => Loose | null;
  colorArgs: (o: Loose, i: Loose) => string[];
  LOOKS: Record<string, string>;
};
type Qa = { parseEbur128: (s: string) => { lufs: number | null; truePeak: number | null } | null };
const cmds = () => loadScript<Cmds>("video-edit", "scripts/commands.mjs");
const info = { seconds: 6, audio: true, width: 320, height: 180, fps: 30 };

describe("video-edit audio and color builders", () => {
  it("uses the same loudness target as the renderer", async () => {
    const { LOUDNESS } = await cmds();
    const render = readFileSync(skillFile("video-core", "scripts/render.mjs"), "utf8");
    expect(render).toContain(`lufs: ${LOUDNESS.lufs}, truePeak: ${LOUDNESS.truePeak}`);
  });

  it("builds the sound graph with or without denoise, music and ducking", async () => {
    const { audioGraph } = await cmds();
    expect(audioGraph({ seconds: 6 })).toEqual({ graph: "[0:a]anull[mix]", inputs: [] });
    expect(audioGraph({ denoise: true, seconds: 6 }).graph).toBe("[0:a]afftdn=nr=12[mix]");
    const plain = audioGraph({ music: "/m.mp3", seconds: 6 });
    expect(plain.graph).toContain("volume=-18dB[m];[vo][m]amix");
    expect(plain.graph).not.toContain("sidechaincompress");
    const duck = audioGraph({ music: "/m.mp3", duck: true, seconds: 6.25 });
    expect(duck.graph).toContain("sidechaincompress=threshold=0.05:ratio=8");
    expect(duck.graph).toContain("atrim=0:6.25");
    expect(duck.inputs).toEqual(["/m.mp3"]);
  });

  it("measures first and applies the measured gain linearly, copying the picture", async () => {
    const { loudnormMeasureArgs, loudnormApplyArgs, parseLoudnorm } = await cmds();
    const measure = loudnormMeasureArgs({ file: "/a.mp4" }, info).join(" ");
    expect(measure).toContain("loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json");
    expect(measure).toContain("-f null -");
    const m = parseLoudnorm(
      'noise\n{\n\t"input_i" : "-24.10",\n\t"input_tp" : "-9.80",\n\t"input_lra" : "0.10",\n\t"input_thresh" : "-34.10",\n\t"target_offset" : "0.30"\n}',
    );
    expect(m).toEqual({ i: -24.1, tp: -9.8, lra: 0.1, thresh: -34.1, offset: 0.3 });
    const apply = loudnormApplyArgs({ file: "/a.mp4", out: "/o.mp4" }, info, m!).join(" ");
    expect(apply).toContain(
      "measured_I=-24.1:measured_TP=-9.8:measured_LRA=0.1:measured_thresh=-34.1:offset=0.3:linear=true",
    );
    expect(apply).toContain("-c:v copy");
    expect(parseLoudnorm("no json here")).toBeNull();
    expect(() => loudnormApplyArgs({ file: "/a", out: "/o" }, info, { i: -Infinity })).toThrow(
      /silent/,
    );
    expect(() => loudnormMeasureArgs({ file: "/a", target: "5" }, info)).toThrow(/-30 to -8/);
  });

  it("escapes a LUT path for the filter, and refuses a bad colour request", async () => {
    const { filterPath, colorArgs, LOOKS } = await cmds();
    expect(filterPath("/a b/it's,[x];y:z.cube")).toBe("/a b/it\\'s\\,\\[x\\]\\;y\\:z.cube");
    expect(filterPath("C:\\luts\\a.cube")).toBe("C\\:/luts/a.cube");
    expect(colorArgs({ file: "/a", out: "/o", look: "warm" }, info).join(" ")).toContain(
      LOOKS.warm,
    );
    expect(
      colorArgs({ file: "/a", out: "/o", autoWb: true, look: "film" }, info).join(" "),
    ).toContain("grayworld");
    expect(colorArgs({ file: "/a", out: "/o", lut: "/x.cube" }, info).join(" ")).toContain(
      "lut3d=file=/x.cube",
    );
    expect(() => colorArgs({ file: "/a", out: "/o", look: "warm", lut: "/x.cube" }, info)).toThrow(
      /either/,
    );
    expect(() => colorArgs({ file: "/a", out: "/o" }, info)).toThrow(/Give --look/);
    expect(() => colorArgs({ file: "/a", out: "/o", look: "neon" }, info)).toThrow(/Unknown look/);
    expect(() => colorArgs({ file: "/a", out: "/o", lut: "/x.txt" }, info)).toThrow(/\.cube/);
  });
});

describe.skipIf(!haveFF)("video-edit audio and color on real files", () => {
  const dir = tmp("ac");
  const cli = (...args: string[]) =>
    spawnSync(process.execPath, [skillFile("video-edit", "scripts/edit.mjs"), ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: ffPath },
    });
  const lufs = async (file: string) => {
    const { parseEbur128 } = await loadScript<Qa>("video-qa", "scripts/_checks.mjs");
    const r = spawnSync(
      FF!,
      [
        "-hide_banner",
        "-nostats",
        "-i",
        file,
        "-vn",
        "-af",
        "ebur128=peak=true",
        "-f",
        "null",
        "-",
      ],
      { encoding: "utf8" },
    );
    return parseEbur128(r.stderr)!;
  };
  const stat = (file: string, key: string) => {
    const r = spawnSync(
      FF!,
      [
        "-hide_banner",
        "-nostats",
        "-v",
        "error",
        "-i",
        file,
        "-vf",
        "signalstats,metadata=mode=print:file=-",
        "-f",
        "null",
        "-",
      ],
      { encoding: "utf8" },
    );
    return Number(r.stdout.match(new RegExp(`signalstats.${key}=([\\d.]+)`))![1]);
  };

  it("brings quiet sound to -14 LUFS within 1 LU, keeps the length and does not touch the picture", async () => {
    // the sine source is quiet (about -22 LUFS), so this clip is well under the target
    const clip = makeClip(path.join(dir, "quiet.mp4"), [
      { color: "0x303030", seconds: 3 },
      { color: "0x606060", seconds: 3 },
    ]);
    const out = path.join(dir, "level.mp4");
    const r = cli("audio", "--in", clip, "--out", out);
    expect(r.status, r.stderr).toBe(0);
    expect(Math.abs((await lufs(out)).lufs! - -14)).toBeLessThan(1);
    expect((await lufs(out)).truePeak!).toBeLessThan(-1);
    expect(seconds(out)).toBeCloseTo(6, 0);
    expect(Math.abs((await lufs(clip)).lufs! - -14)).toBeGreaterThan(3);
    const other = path.join(dir, "minus20.mp4");
    expect(cli("audio", "--in", clip, "--out", other, "--target", "-20").status).toBe(0);
    expect(Math.abs((await lufs(other)).lufs! - -20)).toBeLessThan(1);
  });

  it("denoises, mixes music under the voice, and refuses silence and a clip with no sound", () => {
    const clip = makeClip(path.join(dir, "v.mp4"), [{ color: "0x303030", seconds: 3 }]);
    const music = path.join(dir, "music.wav");
    spawnSync(FF!, [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=220:duration=2",
      music,
    ]);
    const mixed = path.join(dir, "mixed.mp4");
    const r = cli("audio", "--in", clip, "--out", mixed, "--denoise", "--music", music, "--duck");
    expect(r.status, r.stderr).toBe(0);
    expect(seconds(mixed)).toBeCloseTo(3, 0);
    const quiet = makeClip(path.join(dir, "silent.mp4"), [
      { color: "0x303030", seconds: 2, tone: null },
    ]);
    expect(cli("audio", "--in", quiet, "--out", path.join(dir, "s.mp4")).stderr).toMatch(/silent/);
    const none = makeClip(path.join(dir, "none.mp4"), [{ color: "0x303030", seconds: 2 }], {
      audio: false,
    });
    expect(cli("audio", "--in", none, "--out", path.join(dir, "n.mp4")).stderr).toContain(
      "no sound",
    );
  });

  it("warms and cools the picture, and puts a tinted picture back to neutral", () => {
    const grey = makeClip(path.join(dir, "grey.mp4"), [{ color: "0x808080", seconds: 1 }], {
      audio: false,
    });
    const warm = path.join(dir, "warm.mp4");
    expect(cli("color", "--in", grey, "--out", warm, "--look", "warm").status).toBe(0);
    expect(stat(warm, "VAVG")).toBeGreaterThan(stat(grey, "VAVG") + 2); // more red
    expect(stat(warm, "UAVG")).toBeLessThan(stat(grey, "UAVG") - 2); // less blue
    const cool = path.join(dir, "cool.mp4");
    expect(cli("color", "--in", grey, "--out", cool, "--look", "cool").status).toBe(0);
    expect(stat(cool, "UAVG")).toBeGreaterThan(stat(grey, "UAVG") + 2);
    const tinted = makeClip(path.join(dir, "tint.mp4"), [{ color: "0xC09070", seconds: 1 }], {
      audio: false,
    });
    const fixed = path.join(dir, "wb.mp4");
    expect(cli("color", "--in", tinted, "--out", fixed, "--auto-wb").status).toBe(0);
    expect(Math.abs(stat(fixed, "UAVG") - 128)).toBeLessThan(4);
    expect(Math.abs(stat(fixed, "VAVG") - 128)).toBeLessThan(4);
  });

  it("applies a user's LUT file and refuses a missing one", () => {
    const grey = makeClip(path.join(dir, "g2.mp4"), [{ color: "0x808080", seconds: 1 }], {
      audio: false,
    });
    const lines = ["LUT_3D_SIZE 2"];
    for (const b of [0, 1])
      for (const g of [0, 1]) for (const r of [0, 1]) lines.push(`${r} ${g} ${1 - b}`); // swap blue for its opposite
    const lut = path.join(dir, "invert-blue.cube");
    writeFileSync(lut, `${lines.join("\n")}\n`);
    const out = path.join(dir, "lut.mp4");
    const r = cli("color", "--in", grey, "--out", out, "--lut", lut);
    expect(r.status, r.stderr).toBe(0);
    expect(
      cli(
        "color",
        "--in",
        grey,
        "--out",
        path.join(dir, "x.mp4"),
        "--lut",
        path.join(dir, "missing.cube"),
      ).stderr,
    ).toContain("does not exist");
    expect(
      cli("color", "--in", grey, "--out", path.join(dir, "y.mp4"), "--lut", "concat:a.cube").stderr,
    ).toMatch(/Refused/);
  });
});
