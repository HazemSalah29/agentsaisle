import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FF, ffPath, haveFF, makeClip, seconds, tmp } from "./video-edit-fixtures";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Cmds = {
  stabilizeArgs: (o: Loose, i: Loose) => { detect: string[]; apply: string[] };
  parseMarks: (r: unknown, s: number) => Loose[];
  zoomExpr: (m: Loose[]) => string;
  jumpcutArgs: (o: Loose, i: Loose) => string[];
};
const cmds = () => loadScript<Cmds>("video-edit", "scripts/commands.mjs");
const info = { seconds: 6, audio: true, width: 320, height: 180, fps: 30 };

describe("video-edit stabilize and jumpcut builders", () => {
  it("plans two passes that share one motion file and copy the sound", async () => {
    const { stabilizeArgs } = await cmds();
    const p = stabilizeArgs(
      { file: "/a.mp4", out: "/o.mp4", trf: "/tmp/x y/motion.trf", strength: "high" },
      info,
    );
    expect(p.detect.join(" ")).toContain(
      "vidstabdetect=shakiness=8:accuracy=15:result=/tmp/x y/motion.trf",
    );
    expect(p.apply.join(" ")).toContain("vidstabtransform=input=/tmp/x y/motion.trf:smoothing=30");
    expect(p.apply.join(" ")).toContain("-c:a copy");
    expect(() =>
      stabilizeArgs({ file: "/a", out: "/o", trf: "/t", strength: "max" }, info),
    ).toThrow(/Unknown --strength/);
  });

  it("reads marks as times or objects, sorts them and refuses bad ones", async () => {
    const { parseMarks } = await cmds();
    expect(parseMarks([4, { t: 1.5, hold: 0.5, zoom: 1.2 }], 6)).toEqual([
      { t: 1.5, hold: 0.5, zoom: 1.2 },
      { t: 4, hold: 0.8, zoom: 1.12 },
    ]);
    expect(() => parseMarks([], 6)).toThrow(/list of times/);
    expect(() => parseMarks([7], 6)).toThrow(/inside the clip/);
    expect(() => parseMarks([1, 1.5], 6)).toThrow(/too close/);
    expect(() => parseMarks([{ t: 1, zoom: 2 }], 6)).toThrow(/1.05 to 1.3/);
    expect(() => parseMarks([{ t: 1, hold: 9 }], 6)).toThrow(/0 to 3/);
    expect(() =>
      parseMarks(
        Array.from({ length: 21 }, (_, i) => i * 3),
        100,
      ),
    ).toThrow(/At most 20/);
    expect(() => parseMarks("x", 6)).toThrow();
  });

  it("makes a smooth zoom expression: in, hold, out, one bump per mark", async () => {
    const { zoomExpr, jumpcutArgs, parseMarks } = await cmds();
    const e = zoomExpr(parseMarks([{ t: 1, hold: 0.5, zoom: 1.2 }], 6));
    expect(e.startsWith("1+0.2*(")).toBe(true);
    expect(e).toContain("between(it,1,1.15)");
    expect(e).toContain("between(it,1.15,1.65)");
    expect(e).toContain("between(it,1.65,2)");
    const a = jumpcutArgs({ file: "/a.mp4", out: "/o.mp4", marks: [1] }, info).join(" ");
    expect(a).toContain("scale=iw*2:ih*2");
    expect(a).toContain("s=320x180:fps=30");
    expect(
      jumpcutArgs(
        { file: "/a", out: "/o", marks: [1] },
        { ...info, width: 3840, height: 2160 },
      ).join(" "),
    ).not.toContain("scale=iw*2");
  });
});

describe.skipIf(!haveFF)("video-edit stabilize and jumpcut on real files", () => {
  const dir = tmp("motion");
  const cli = (...args: string[]) =>
    spawnSync(process.execPath, [skillFile("video-edit", "scripts/edit.mjs"), ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: ffPath },
    });
  const yavg = (file: string, vf: string, key = "YAVG") => {
    const r = spawnSync(
      FF!,
      ["-hide_banner", "-nostats", "-v", "error", "-i", file, "-vf", vf, "-f", "null", "-"],
      { encoding: "utf8" },
    );
    return [...r.stdout.matchAll(new RegExp(`signalstats.${key}=([\\d.]+)`, "g"))].map((m) =>
      Number(m[1]),
    );
  };

  it("zooms in at the mark and is back to normal after it", () => {
    const clip = path.join(dir, "bands.mp4");
    spawnSync(FF!, [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=gray:s=320x180:r=30:d=4",
      "-f",
      "lavfi",
      "-i",
      "sine=duration=4",
      "-vf",
      "drawbox=x=0:y=0:w=19:h=180:color=red:t=fill,drawbox=x=301:y=0:w=19:h=180:color=red:t=fill",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      clip,
    ]);
    const marks = path.join(dir, "marks.json");
    writeFileSync(marks, JSON.stringify([{ t: 1, hold: 0.8, zoom: 1.12 }]));
    const out = path.join(dir, "zoomed.mp4");
    const r = cli("jumpcut", "--in", clip, "--out", out, "--marks", marks);
    expect(r.status, r.stderr).toBe(0);
    expect(seconds(out)).toBeCloseTo(4, 0);
    // red share in the outer 10% band (V average) at 0.5 s (before), 1.6 s (zoomed in) and 3.5 s (after)
    const at = (file: string, t: number) =>
      yavg(
        file,
        `select='between(t,${t},${t + 0.04})',crop=iw*0.1:ih:0:0,signalstats,metadata=mode=print:file=-`,
        "VAVG",
      )[0];
    const before = at(out, 0.5);
    expect(at(out, 1.6)).toBeLessThan(before - 20);
    expect(Math.abs(at(out, 3.5) - before)).toBeLessThan(4);
    expect(cli("jumpcut", "--in", clip, "--out", path.join(dir, "n.mp4")).stderr).toContain(
      "--marks",
    );
    writeFileSync(marks, JSON.stringify([9]));
    expect(
      cli("jumpcut", "--in", clip, "--out", path.join(dir, "m.mp4"), "--marks", marks).stderr,
    ).toContain("inside the clip");
  });

  it("calms a shaking picture (frame to frame change drops by at least half)", () => {
    const still = path.join(dir, "still.png");
    spawnSync(FF!, [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=640x360:rate=1:duration=1",
      "-frames:v",
      "1",
      still,
    ]);
    const shaky = path.join(dir, "shaky.mp4");
    const s = spawnSync(
      FF!,
      [
        "-y",
        "-v",
        "error",
        "-loop",
        "1",
        "-framerate",
        "30",
        "-i",
        still,
        "-t",
        "3",
        "-vf",
        "crop=560:300:x='40+14*sin(n*1.9)+6*sin(n*0.7)':y='30+10*cos(n*2.3)',format=yuv420p",
        "-c:v",
        "libx264",
        shaky,
      ],
      { encoding: "utf8" },
    );
    expect(s.status, s.stderr).toBe(0);
    const calm = path.join(dir, "calm.mp4");
    const r = cli("stabilize", "--in", shaky, "--out", calm);
    expect(r.status, r.stderr).toBe(0);
    const change = (file: string) => {
      const v = yavg(file, "tblend=all_mode=difference,signalstats,metadata=mode=print:file=-");
      return v.reduce((a, b) => a + b, 0) / v.length;
    };
    expect(change(calm)).toBeLessThan(change(shaky) / 2);
    expect(seconds(calm)).toBeCloseTo(3, 0);
  });
});
