import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { fixtureVideo, wav } from "./video-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type Render = {
  muxArgs: (o: Loose) => string[];
  voicePlacements: (v: Loose, t: Loose, dir: string) => { file: string; ms: number }[];
  sfxPlacements: (v: Loose, dir: string) => { file: string; ms: number; gainDb: number }[];
  subtitles: (pages: Loose[]) => { srt: string; vtt: string };
};
type Timing = { buildTiming: (v: Loose, m: (id: string) => number, pad?: number) => Loose };

const timingFor = async (video: Loose) => {
  const { buildTiming } = await loadScript<Timing>("video-core", "scripts/timing.mjs");
  return buildTiming(video, () => 1.2, 0.3);
};
const render = () => loadScript<Render>("video-core", "scripts/render.mjs");

describe("video-core render helpers", () => {
  it("builds mux arguments as a plain array: voice delayed to its start, music ducked", async () => {
    const { muxArgs } = await render();
    const args = muxArgs({
      silent: "/s.mp4",
      out: "/o.mp4",
      seconds: 5,
      voice: [
        { file: "/v/l1.wav", ms: 0 },
        { file: "/v/l2.wav", ms: 1500 },
      ],
      music: "/m.mp3",
      duckDb: -14,
    });
    expect(args.every((a) => typeof a === "string")).toBe(true);
    const graph = args[args.indexOf("-filter_complex") + 1]!;
    expect(graph).toContain("adelay=1500|1500");
    expect(graph).toContain("sidechaincompress");
    expect(graph).toContain("volume=-14dB");
    expect(args).toEqual(
      expect.arrayContaining([
        "-map",
        "0:v",
        "-c:v",
        "libx264",
        "scale=in_range=pc:out_range=tv,format=yuv420p",
        "-ar",
        "48000",
        "-movflags",
        "+faststart",
      ]),
    );
    expect(args.at(-1)).toBe("/o.mp4");
  });

  it("ends the audio graph with loudness normalisation to the target, and not without audio", async () => {
    const { muxArgs } = await loadScript<Render>("video-core", "scripts/render.mjs");
    const withVoice = muxArgs({
      silent: "/s.mp4",
      out: "/o.mp4",
      voice: [{ file: "/a.wav", ms: 0 }],
      music: null,
      seconds: 4,
    }).join(" ");
    expect(withVoice).toContain("loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[final]");
    expect(withVoice).toContain("-map [final]");
    const silent = muxArgs({
      silent: "/s.mp4",
      out: "/o.mp4",
      voice: [],
      music: null,
      seconds: 4,
    }).join(" ");
    expect(silent).not.toContain("loudnorm");
  });

  it("places sound effects on top of the mix, delayed and not ducked, and keeps them inside the folder", async () => {
    const { muxArgs, sfxPlacements } = await loadScript<Render>("video-core", "scripts/render.mjs");
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sfx-"));
    fs.mkdirSync(path.join(dir, "audio"));
    fs.writeFileSync(path.join(dir, "audio", "hit.wav"), "x");
    const found = sfxPlacements(
      {
        sfx: [
          { file: "audio/hit.wav", at: 1.5, gainDb: -3 },
          { file: "audio/hit.wav", at: 0.5 },
          { file: "../evil.wav", at: 1 },
          { file: "audio/missing.wav", at: 1 },
          { file: "audio/hit.wav", at: -1 },
        ],
      },
      dir,
    );
    expect(found.map((x) => [x.ms, x.gainDb])).toEqual([
      [500, -6],
      [1500, -3],
    ]);
    const args = muxArgs({
      silent: "/s.mp4",
      out: "/o.mp4",
      voice: [{ file: "/v.wav", ms: 0 }],
      music: "/m.mp3",
      sfx: found,
      seconds: 4,
    });
    expect(args.filter((a) => a === "-i")).toHaveLength(5); // video, voice, music, two effects
    const graph = args[args.indexOf("-filter_complex") + 1]!;
    expect(graph).toContain("[3:a]adelay=500|500,aresample=48000,volume=-6dB[x0]");
    expect(graph).toContain("[4:a]adelay=1500|1500,aresample=48000,volume=-3dB[x1]");
    expect(graph).toContain("[x0][x1]amix=inputs=2:normalize=0:dropout_transition=0[sfx]");
    expect(graph).toContain("[mix][sfx]amix=inputs=2:normalize=0:dropout_transition=0[withsfx]");
    expect(graph.indexOf("[withsfx]")).toBeLessThan(graph.indexOf("loudnorm"));
    const only = muxArgs({
      silent: "/s.mp4",
      out: "/o.mp4",
      voice: [],
      music: null,
      sfx: found,
      seconds: 4,
    });
    expect(only[only.indexOf("-filter_complex") + 1]).toContain("[sfx]loudnorm");
  });

  it("skips loudness normalisation for digital silence, which loudnorm turns into NaN", async () => {
    const { muxArgs, wavIsSilent } = await loadScript<
      Render & { wavIsSilent: (b: Buffer) => boolean }
    >("video-core", "scripts/render.mjs");
    expect(wavIsSilent(wav(0.5))).toBe(true);
    const tone = wav(0.5);
    tone[tone.length - 10] = 7; // one non-zero sample
    expect(wavIsSilent(tone)).toBe(false);
    expect(
      wavIsSilent(
        Buffer.from("not a wav at all, just text that is long enough to pass the size check....."),
      ),
    ).toBe(false);
    const args = (normalize: boolean) =>
      muxArgs({
        silent: "/s.mp4",
        out: "/o.mp4",
        voice: [{ file: "/a.wav", ms: 0 }],
        music: null,
        seconds: 4,
        normalize,
      }).join(" ");
    expect(args(false)).not.toContain("loudnorm");
    expect(args(false)).toContain("-map [voice]");
    expect(args(true)).toContain("loudnorm");
  });

  it("places voice lines at scene start + line start, in milliseconds", async () => {
    const { voicePlacements } = await render();
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-voice-"));
    mkdirSync(path.join(dir, "voice"));
    writeFileSync(path.join(dir, "voice", "l1.wav"), wav(1));
    const video: Loose = fixtureVideo();
    const t = await timingFor(video);
    const p = voicePlacements(video, t, dir);
    expect(p).toEqual([{ file: path.join(dir, "voice", "l1.wav"), ms: 0 }]);
  });

  it("has no audio track without audio, converts to limited-range yuv420p, and keeps the draft's own size", async () => {
    const { muxArgs } = await render();
    const plain = muxArgs({ silent: "/s.mp4", out: "/o.mp4", seconds: 3, voice: [], music: null });
    expect(plain).not.toContain("-filter_complex");
    expect(plain).not.toContain("-c:a");
    expect(plain).toEqual(expect.arrayContaining(["-crf", "18"]));
    const draft = muxArgs({
      silent: "/s.mp4",
      out: "/o.mp4",
      seconds: 3,
      voice: [],
      music: null,
      draft: true,
    });
    expect(draft).toEqual(expect.arrayContaining(["libx264", "-crf", "23"]));
    expect(draft.join(" ")).not.toMatch(/scale=-2|scale=\d/);
  });

  it("writes SRT and WebVTT from caption pages", async () => {
    const { subtitles } = await render();
    const { srt, vtt } = subtitles([
      {
        start: 0,
        end: 1.25,
        words: [
          { text: "Hello", start: 0, end: 0.5 },
          { text: "world.", start: 0.5, end: 1 },
        ],
      },
      { start: 61.5, end: 62, words: [{ text: "Bye", start: 61.5, end: 62 }] },
    ]);
    expect(srt).toBe(
      "1\n00:00:00,000 --> 00:00:01,250\nHello world.\n\n2\n00:01:01,500 --> 00:01:02,000\nBye\n",
    );
    expect(vtt.startsWith("WEBVTT\n\n00:00:00.000 --> 00:00:01.250\nHello world.")).toBe(true);
  });

  it("refuses to render when the project does not check out, or the preset is unknown", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-render-"));
    writeFileSync(path.join(dir, "video.json"), JSON.stringify({ version: 1 }));
    const r = spawnSync("node", [skillFile("video-core", "scripts/render.mjs"), dir], {
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/problem\(s\)/);
    const bad = spawnSync(
      "node",
      [skillFile("video-core", "scripts/render.mjs"), dir, "--preset", "neon"],
      {
        encoding: "utf8",
      },
    );
    expect(bad.status).toBe(2);
    expect(bad.stderr).toMatch(/Preset "neon" is not known/);
  });
});

// The real thing: needs ffmpeg and a set-up Remotion engine, so it is skipped on machines without them.
const have = (() => {
  if (spawnSync("ffmpeg", ["-version"]).status !== 0) return false;
  const r = spawnSync("node", [skillFile("video-core", "scripts/engine.mjs"), "status"], {
    encoding: "utf8",
  });
  return r.status === 0;
})();

describe.skipIf(!have)("video-core render end to end (Remotion)", () => {
  it(
    "renders a voiced fixture to a 1080x1920 MP4 with sound and subtitles",
    { timeout: 600_000 },
    () => {
      const dir = mkdtempSync(path.join(os.tmpdir(), "video-e2e-"));
      mkdirSync(path.join(dir, "voice"));
      writeFileSync(path.join(dir, "voice", "l1.wav"), wav(1.2));
      writeFileSync(path.join(dir, "script.md"), "[l1] Rate limiting protects a service.\n");
      writeFileSync(path.join(dir, "video.json"), JSON.stringify(fixtureVideo()));
      spawnSync("node", [skillFile("video-core", "scripts/timing.mjs"), dir]);
      const r = spawnSync(
        "node",
        [skillFile("video-core", "scripts/render.mjs"), dir, "--ignore-approval"],
        {
          encoding: "utf8",
        },
      );
      expect(r.status, r.stderr + r.stdout).toBe(0);
      const out = path.join(dir, "out", `${path.basename(dir)}.mp4`);
      const probe = spawnSync(
        "ffprobe",
        ["-v", "error", "-show_entries", "stream=codec_name,width,height", "-of", "csv=p=0", out],
        { encoding: "utf8" },
      );
      expect(probe.stdout).toMatch(/h264,1080,1920/);
      expect(probe.stdout).toMatch(/aac/);
      expect(existsSync(path.join(dir, "out", "rm", "props.json"))).toBe(true);
    },
  );
});
