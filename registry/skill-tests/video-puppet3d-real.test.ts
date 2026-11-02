import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skillFile } from "./load";
import { sampleRig } from "./video-puppet-fixtures";

// Real engine: renders a 2 s 3D puppet scene with HyperFrames and ffmpeg, so it runs only on a machine that has
// both (it looks in ~/.npm/_npx for HyperFrames and uses the ffmpeg on the PATH or in ~/bin), and is skipped elsewhere.
type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const home = os.homedir();
const env = {
  ...process.env,
  PATH: `${path.join(home, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
};
const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { env }).status === 0;
const npx = path.join(home, ".npm", "_npx");
const hyperframes = existsSync(npx)
  ? readdirSync(npx)
      .map((d) => path.join(npx, d, "node_modules", "hyperframes"))
      .find((d) => existsSync(path.join(d, "bin", "hyperframes.mjs")))
  : undefined;

/** A minimal 3D rig: the required parts as small spheres. */
const rig3 = () => {
  const ids = [
    "body",
    "head",
    "arm-l",
    "arm-r",
    "leg-l",
    "leg-r",
    "eyes-open",
    "eyes-closed",
    ...["rest", "a", "e", "o", "u", "mbp", "fv", "l"].map((v) => `mouth-${v}`),
  ];
  return {
    name: "blob",
    height: 2,
    materials: { m: { color: "#3f9f6b" } },
    parts: ids.map((id, i) => ({
      id,
      parent:
        id === "body" ? null : id.startsWith("mouth") || id.startsWith("eyes") ? "head" : "body",
      pivot: [0, id === "body" ? 1 : 0.1 * i, 0],
      shape: "sphere",
      size: [0.3, 0.3, 0.3],
      material: "m",
    })),
  };
};

describe.skipIf(!hasFfmpeg || !hyperframes)("real 3D render", () => {
  it(
    "renders a 3D puppet scene to a 2 s draft video of the right shape",
    { timeout: 300_000 },
    () => {
      void sampleRig;
      const dir = mkdtempSync(path.join(os.tmpdir(), "video-3d-"));
      mkdirSync(path.join(dir, "characters", "blob"), { recursive: true });
      writeFileSync(path.join(dir, "characters", "blob", "puppet3d.json"), JSON.stringify(rig3()));
      writeFileSync(
        path.join(dir, "video.json"),
        JSON.stringify({
          version: 1,
          meta: {
            title: "t",
            type: "kids",
            format: "reel-9x16",
            fps: 30,
            lang: "en",
            audience: "kids-3-5",
          },
          scenes: [
            {
              id: "s1",
              kind: "puppet",
              durationFrom: "fixed",
              seconds: 2,
              props: {
                look: "3d",
                backdrop: { preset: "night" },
                cast: [
                  { rig: "blob", x: 0.5, y: 0.58, height: 0.4, acts: [{ at: 0.2, do: "wave" }] },
                ],
              },
            },
          ],
        }),
      );
      const r = spawnSync(
        "node",
        [
          skillFile("video-core", "scripts/render.mjs"),
          dir,
          "--draft",
          "--hyperframes",
          hyperframes as string,
        ],
        { encoding: "utf8", env },
      );
      expect(r.status, r.stdout + r.stderr).toBe(0);
      const draft = readdirSync(path.join(dir, "out")).find((n) => n.endsWith("-draft.mp4"));
      expect(draft).toBeDefined();
      const file = path.join(dir, "out", draft as string);
      const probe = JSON.parse(
        spawnSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_entries",
            "stream=width,height:format=duration",
            "-of",
            "json",
            file,
          ],
          { encoding: "utf8", env },
        ).stdout,
      ) as Loose;
      expect(Number(probe.format.duration)).toBeGreaterThan(1.8);
      expect(probe.streams[0].height / probe.streams[0].width).toBeCloseTo(16 / 9, 1);
      // The picture is not blank: the night sky and the ground differ a lot from top to bottom.
      const stats = spawnSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-ss",
          "1",
          "-i",
          file,
          "-frames:v",
          "1",
          "-vf",
          "signalstats,metadata=mode=print:file=-",
          "-f",
          "null",
          "-",
        ],
        { encoding: "utf8", env },
      ).stdout;
      const range = Number(/YMAX=(\d+)/.exec(stats)?.[1]) - Number(/YMIN=(\d+)/.exec(stats)?.[1]);
      expect(range).toBeGreaterThan(40);
    },
  );
});
