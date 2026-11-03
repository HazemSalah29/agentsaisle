import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Step = { id: string; status: string; note: string };
type Pipe = {
  pipelineState: (dir: string, installed: Record<string, boolean>) => Step[];
  installedSkills: (root?: string) => Record<string, boolean>;
};
const pipe = () => loadScript<Pipe>("video", "scripts/pipeline.mjs");
const ALL = {
  "video-write": true,
  "video-explain": true,
  "video-voice": true,
  "video-core": true,
  "video-captions": true,
  "video-qa": true,
  "video-publish": true,
};

const tmp = () => mkdtempSync(path.join(os.tmpdir(), "pipeline-"));
const put = (dir: string, rel: string, text: string | object, at?: number) => {
  const f = path.join(dir, rel);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, typeof text === "string" ? text : JSON.stringify(text));
  if (at) utimesSync(f, at, at);
};
const status = (steps: Step[], id: string) => steps.find((s) => s.id === id)!.status;
const video = (scenes: Loose[] = [], extra: Loose = {}) => ({
  version: 1,
  meta: { title: "t", type: "explainer", format: "reel-9x16", fps: 30, lang: "en" },
  scenes,
  ...extra,
});

describe("video pipeline", () => {
  it("starts at write in an empty folder", async () => {
    const { pipelineState } = await pipe();
    const steps = pipelineState(tmp(), ALL);
    expect(status(steps, "write")).toBe("todo");
    expect(status(steps, "storyboard")).toBe("todo");
    expect(status(steps, "publish")).toBe("todo");
    expect(steps.find((x) => x.id === "publish")!.note).toContain("publish/copy.json");
  });

  it("waits for approval while there is a storyboard but no video.json", async () => {
    const { pipelineState } = await pipe();
    const dir = tmp();
    for (const f of ["brief.json", "script.md", "facts.md", "storyboard.md"]) put(dir, f, "x");
    const steps = pipelineState(dir, ALL);
    expect(status(steps, "write")).toBe("done");
    const sb = steps.find((s) => s.id === "storyboard")!;
    expect(sb.status).toBe("todo");
    expect(sb.note).toContain("approve");
  });

  it("lists diagram scenes that still need video-explain", async () => {
    const { pipelineState } = await pipe();
    const dir = tmp();
    put(
      dir,
      "video.json",
      video([
        { id: "a", kind: "title", props: { text: "x" } },
        { id: "b", kind: "rate-limit", props: {} },
        { id: "c", kind: "request-flow", props: {} },
        { id: "d", kind: "sequence", props: { source: "A->B: x" } },
      ]),
    );
    const s = pipelineState(dir, ALL).find((x) => x.id === "scenes")!;
    expect(s.status).toBe("todo");
    expect(s.note).toContain("b, c");
    put(dir, "video.json", video([{ id: "b", kind: "rate-limit", props: { algos: [{}] } }]));
    expect(pipelineState(dir, ALL).find((x) => x.id === "scenes")!.status).toBe("done");
  });

  it("marks later steps stale when video.json changes after them", async () => {
    const { pipelineState } = await pipe();
    const dir = tmp();
    const t = (n: number) => 1_800_000_000 + n;
    put(
      dir,
      "video.json",
      video([{ id: "s", kind: "title", narration: ["l1"], props: { text: "x" } }]),
      t(10),
    );
    put(dir, "voice/l1.wav", "x", t(5));
    put(dir, "timing.json", {}, t(20));
    put(dir, "captions.json", {}, t(21));
    put(dir, "out/p.mp4", "x", t(30));
    put(dir, "qa/report.json", { ok: true, results: [] }, t(40));
    let steps = pipelineState(dir, ALL);
    for (const id of ["voice", "timing", "render", "qa"]) expect(status(steps, id)).toBe("done");
    put(
      dir,
      "video.json",
      video([{ id: "s", kind: "title", narration: ["l1"], props: { text: "y" } }]),
      t(50),
    );
    steps = pipelineState(dir, ALL);
    expect(status(steps, "timing")).toBe("stale");
    expect(status(steps, "render")).toBe("stale");
  });

  it("only counts a final render, and a failed QA as to do", async () => {
    const { pipelineState } = await pipe();
    const dir = tmp();
    put(dir, "video.json", video([]));
    put(dir, "timing.json", {});
    put(dir, "out/p-draft.mp4", "x");
    expect(pipelineState(dir, ALL).find((s) => s.id === "render")!.note).toContain("draft");
    put(dir, "out/p.mp4", "x");
    put(dir, "qa/report.json", { ok: false, results: [{ level: "fail" }, { level: "warn" }] });
    const qa = pipelineState(dir, ALL).find((s) => s.id === "qa")!;
    expect(qa.status).toBe("todo");
    expect(qa.note).toBe("1 check(s) failed");
  });

  it("knows the publish step: to do without a pack, done with a current one, stale after a new render", async () => {
    const { pipelineState } = await pipe();
    const dir = tmp();
    const t = (n: number) => 1_800_000_000 + n;
    put(dir, "video.json", video([]), t(1));
    put(dir, "timing.json", {}, t(2));
    put(dir, "out/p.mp4", "x", t(10));
    put(dir, "qa/report.json", { ok: true, results: [] }, t(20));
    expect(pipelineState(dir, ALL).find((x) => x.id === "publish")!.note).toContain(
      "publish/copy.json",
    );
    put(dir, "publish/copy.json", {}, t(21));
    expect(pipelineState(dir, ALL).find((x) => x.id === "publish")!.note).toBe(
      "no export pack yet",
    );
    put(dir, "exports/publish.json", {}, t(30));
    expect(status(pipelineState(dir, ALL), "publish")).toBe("done");
    put(dir, "out/p.mp4", "y", t(40));
    expect(status(pipelineState(dir, ALL), "publish")).toBe("stale");
  });

  it("blocks a step whose skill is not installed", async () => {
    const { pipelineState } = await pipe();
    const steps = pipelineState(tmp(), { ...ALL, "video-write": false });
    const w = steps.find((s) => s.id === "write")!;
    expect(w.status).toBe("blocked");
    expect(w.note).toBe("install video-write first");
  });

  it("finds installed sibling skills", async () => {
    const { installedSkills } = await pipe();
    const root = path.dirname(skillFile("video", "."));
    const found = installedSkills(root);
    expect(found["video-core"]).toBe(true);
    expect(installedSkills(tmp())["video-core"]).toBe(false);
  });

  it("prints a short table and a Next line, and exits 2 without a folder", () => {
    const dir = tmp();
    put(dir, "brief.json", "x");
    const r = spawnSync(process.execPath, [skillFile("video", "scripts/pipeline.mjs"), dir], {
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Next: video-write");
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(40);
    expect(
      spawnSync(process.execPath, [skillFile("video", "scripts/pipeline.mjs")], {
        encoding: "utf8",
      }).status,
    ).toBe(2);
  });
});
