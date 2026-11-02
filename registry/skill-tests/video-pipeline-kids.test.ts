import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Step = { id: string; status: string; note: string; next?: string };
type Pipe = {
  pipelineState: (dir: string, installed: Record<string, boolean>) => Step[];
  isKidsProject: (dir: string) => boolean;
};
const pipe = () => loadScript<Pipe>("video", "scripts/pipeline.mjs");
const ALL = Object.fromEntries(
  [
    "video-write",
    "video-kids",
    "video-explain",
    "video-voice",
    "video-core",
    "video-captions",
    "video-qa",
    "video-publish",
  ].map((n) => [n, true]),
);
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "pipeline-kids-"));
const put = (dir: string, rel: string, text: string | object, at?: number) => {
  const f = path.join(dir, rel);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, typeof text === "string" ? text : JSON.stringify(text));
  if (at) utimesSync(f, at, at);
};
const status = (steps: Step[], id: string) => steps.find((s) => s.id === id)?.status;
const kidsVideo = (speaks = true): Loose => ({
  version: 1,
  meta: {
    title: "t",
    type: "kids",
    format: "reel-9x16",
    fps: 30,
    lang: "en",
    audience: "kids-3-5",
  },
  voice: { provider: "kokoro" },
  scenes: [
    {
      id: "s1",
      kind: "puppet",
      narration: ["k1"],
      props: {
        cast: [{ rig: "nour", x: 0.5, y: 0.8, height: 0.4, ...(speaks ? { speaks: ["k1"] } : {}) }],
      },
    },
  ],
});

describe("kids pipeline", () => {
  it("is a kids project by its brief or its video.json", async () => {
    const { isKidsProject } = await pipe();
    const a = tmp();
    expect(isKidsProject(a)).toBe(false);
    put(a, "brief.json", { mode: "kids" });
    expect(isKidsProject(a)).toBe(true);
    const b = tmp();
    put(b, "video.json", kidsVideo());
    expect(isKidsProject(b)).toBe(true);
  });
  it("starts with characters, has no facts or diagram steps, and adds mouth shapes after voice", async () => {
    const { pipelineState } = await pipe();
    const dir = tmp();
    put(dir, "brief.json", { mode: "kids" });
    const steps = pipelineState(dir, ALL);
    expect(steps.map((s) => s.id)).toEqual([
      "characters",
      "write",
      "storyboard",
      "voice",
      "visemes",
      "timing",
      "captions",
      "render",
      "qa",
      "publish",
    ]);
    expect(status(steps, "characters")).toBe("todo");
    expect(steps[0].next).toMatch(/video-kids new-character/);
    put(dir, "script.md", "[k1] Hi.\n  beat: hook\n");
    put(dir, "storyboard.md", "| scene | kind |\n");
    expect(status(pipelineState(dir, ALL), "write")).toBe("done");
  });
  it("wants a bible and a puppet for every character the film uses", async () => {
    const { pipelineState } = await pipe();
    const dir = tmp();
    put(dir, "video.json", kidsVideo());
    put(dir, "characters/nour/bible.md", "# Nour");
    expect(status(pipelineState(dir, ALL), "characters")).toBe("todo");
    put(dir, "characters/nour/puppet.json", "{}");
    expect(status(pipelineState(dir, ALL), "characters")).toBe("done");
  });
  it("makes mouth shapes a step only when someone speaks, and stale when the words change", async () => {
    const { pipelineState } = await pipe();
    const quiet = tmp();
    put(quiet, "video.json", kidsVideo(false));
    expect(status(pipelineState(quiet, ALL), "visemes")).toBe("done");
    const dir = tmp();
    put(dir, "video.json", kidsVideo());
    expect(status(pipelineState(dir, ALL), "visemes")).toBe("todo");
    const t = Math.floor(Date.now() / 1000);
    put(dir, "voice/words.json", "{}", t - 100);
    put(dir, "voice/visemes.json", "{}", t - 200);
    expect(status(pipelineState(dir, ALL), "visemes")).toBe("stale");
    put(dir, "voice/visemes.json", "{}", t - 50);
    expect(status(pipelineState(dir, ALL), "visemes")).toBe("done");
  });
  it("blocks steps whose skill is not installed, including video-kids", async () => {
    const { pipelineState } = await pipe();
    const dir = tmp();
    put(dir, "brief.json", { mode: "kids" });
    const steps = pipelineState(dir, { ...ALL, "video-kids": false });
    expect(status(steps, "characters")).toBe("blocked");
  });
});
