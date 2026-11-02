import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ffPath, haveFF, makeClip, seconds, tmp } from "./video-edit-fixtures";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Demo = { parseDemo: (t: string) => { steps: Loose[]; problems: string[] } };
type Plan = {
  planShowcase: (log: Loose, o?: Loose) => Loose;
  segmentsFor: (log: Loose) => Loose[];
  retimer: (s: Loose[]) => (t: number) => number;
  logProblems: (log: unknown) => string[];
  filterFor: (s: Loose[]) => string;
};
const demo = () => loadScript<Demo>("video-showcase", "scripts/_demo.mjs");
const plan = () => loadScript<Plan>("video-showcase", "scripts/_plan.mjs");

describe("demo script", () => {
  const GOOD = `# Demo
go /
say intro
hover "Pricing"
click "Start free trial"
type #email "me@example.com"
scroll down 600
wait 1.5
`;
  it("reads every step", async () => {
    const r = (await demo()).parseDemo(GOOD);
    expect(r.problems).toEqual([]);
    expect(r.steps.map((s) => s.op)).toEqual([
      "go",
      "say",
      "hover",
      "click",
      "type",
      "scroll",
      "wait",
    ]);
    expect(r.steps[3]).toMatchObject({ op: "click", text: "Start free trial" });
    expect(r.steps[4]).toMatchObject({ css: "#email", value: "me@example.com" });
  });
  it("refuses other sites, scripts and loose words, with the line number", async () => {
    const { parseDemo } = await demo();
    const bad = (t: string) => parseDemo(t).problems.join("|");
    expect(bad("go https://evil.example/")).toMatch(/line 1: go takes a path/);
    expect(bad("go //evil.example")).toMatch(/go takes a path/);
    expect(bad("go /\nrun rm -rf")).toMatch(/line 2: unknown step "run"/);
    expect(bad("go /\nclick Pricing")).toMatch(/line 2: a bare word is ambiguous/);
    expect(bad('go /\nclick "oops')).toMatch(/line 2: a quote is not closed/);
    expect(bad("go /\nwait 99")).toMatch(/wait takes seconds/);
    expect(bad("go /\nscroll sideways 5")).toMatch(/scroll takes/);
    expect(bad('click "A"')).toMatch(/start with a "go/);
    expect(bad("")).toMatch(/no steps/);
  });
  it("keeps hostile text as plain data", async () => {
    const r = (await demo()).parseDemo('go /\nclick "<img src=x onerror=alert(1)>"');
    expect(r.problems).toEqual([]);
    expect(r.steps[1].text).toBe("<img src=x onerror=alert(1)>");
  });
  it("limits the number of steps", async () => {
    const t = "go /\n" + 'click "A"\n'.repeat(70);
    expect((await demo()).parseDemo(t).problems.join()).toMatch(/at most 60 steps/);
  });
});

const LOG = {
  version: 1,
  viewport: { w: 1280, h: 720 },
  duration: 10,
  events: [
    { t: 0.2, kind: "go" },
    { t: 0.5, kind: "say", id: "intro" },
    { t: 1, kind: "click", x: 0.8, y: 0.2, w: 0.2, h: 0.1 },
    { t: 3, end: 4.5, kind: "type", x: 0.5, y: 0.5, w: 0.3, h: 0.06, chars: 20 },
    { t: 9, kind: "click", x: 0.1, y: 0.9, w: 0.1, h: 0.05 },
  ],
};

describe("showcase plan", () => {
  it("cuts long waiting, speeds up typing and retimes (hand-checked)", async () => {
    const { segmentsFor, retimer } = await plan();
    const segs = segmentsFor(LOG);
    expect(segs).toEqual([
      { from: 0, to: 3, speed: 1 },
      { from: 3, to: 4.5, speed: 3 },
      { from: 4.5, to: 5.25, speed: 1 },
      { from: 8.45, to: 10, speed: 1 },
    ]);
    const at = retimer(segs);
    expect(at(1)).toBe(1);
    expect(at(4.5)).toBe(3.5);
    expect(at(9)).toBe(4.8);
    expect(at(10)).toBe(5.8);
    expect(at(7)).toBe(4.25); // inside the cut: maps to the cut point
  });
  it("moves the camera to each target and never overlaps moves", async () => {
    const r = (await plan()).planShowcase(LOG);
    expect(r.seconds).toBe(5.8);
    expect(r.props.zoom).toEqual([
      { at: 0.5, dur: 0.8, x: 0.8, y: 0.2, scale: 2 },
      { at: 2.5, dur: 0.8, x: 0.5, y: 0.5, scale: 1.4 },
      { at: 4.3, dur: 0.8, x: 0.1, y: 0.9, scale: 2.4 },
    ]);
    const z = r.props.zoom;
    for (let i = 1; i < z.length; i++)
      expect(z[i].at).toBeGreaterThanOrEqual(z[i - 1].at + z[i - 1].dur);
    expect(r.props.ripples).toEqual([
      { t: 1, x: 0.8, y: 0.2 },
      { t: 4.8, x: 0.1, y: 0.9 },
    ]);
    expect(r.says).toEqual({ intro: 0.5 });
  });
  it("glides the cursor: in time order, inside the frame, ending on the last target", async () => {
    const r = (await plan()).planShowcase(LOG);
    const c = r.props.cursor;
    expect(c[0].t).toBe(0);
    for (let i = 1; i < c.length; i++) expect(c[i].t).toBeGreaterThanOrEqual(c[i - 1].t);
    for (const p of c) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
    expect(c.at(-1)).toEqual({ t: 5.8, x: 0.1, y: 0.9 });
    // It arrives at the first click exactly when the click happens.
    expect(c.find((p: Loose) => p.x === 0.8 && p.y === 0.2).t).toBe(1);
    expect(c.length).toBeLessThanOrEqual(600);
  });
  it("eases back out when the next action is far away", async () => {
    const { planShowcase } = await plan();
    const log = {
      ...LOG,
      duration: 12,
      events: [
        { t: 0.2, kind: "go" },
        { t: 1, kind: "click", x: 0.8, y: 0.2, w: 0.2, h: 0.1 },
        { t: 1.5, end: 4.5, kind: "scroll" },
        { t: 5, kind: "click", x: 0.2, y: 0.8, w: 0.2, h: 0.1 },
      ],
    };
    const z = planShowcase(log).props.zoom;
    expect(z.some((m: Loose) => m.scale === 1)).toBe(true);
  });
  it("does not zoom on a huge target", async () => {
    const { planShowcase } = await plan();
    const log = {
      ...LOG,
      events: [
        { t: 0.2, kind: "go" },
        { t: 1, kind: "click", x: 0.5, y: 0.5, w: 0.9, h: 0.9 },
      ],
    };
    expect(planShowcase(log).props.zoom).toEqual([]);
  });
  it("is deterministic", async () => {
    const { planShowcase } = await plan();
    expect(JSON.stringify(planShowcase(LOG))).toBe(JSON.stringify(planShowcase(LOG)));
  });
  it("refuses a broken log", async () => {
    const { planShowcase, logProblems } = await plan();
    expect(logProblems({ events: "x" })).toEqual(["events: a list is needed"]);
    expect(() => planShowcase({ ...LOG, events: [{ t: 2, kind: "click", x: 3, y: 0 }] })).toThrow(
      /cannot be planned/,
    );
    expect(
      logProblems({
        ...LOG,
        events: [
          { t: 3, kind: "go" },
          { t: 1, kind: "go" },
        ],
      }).join(),
    ).toMatch(/time order/);
  });
  it("writes an ffmpeg graph with one trim per kept part", async () => {
    const { planShowcase, filterFor } = await plan();
    const g = filterFor(planShowcase(LOG).segments);
    expect(g.match(/trim=/g)).toHaveLength(4);
    expect(g).toContain("setpts=(PTS-STARTPTS)/3");
    expect(g).toContain("concat=n=4:v=1:a=0[v]");
  });
});

describe.skipIf(!haveFF)("plan.mjs", () => {
  const run = (args: string[]) =>
    spawnSync(process.execPath, [skillFile("video-showcase", "scripts/plan.mjs"), ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: ffPath },
    });
  it("edits the recording and fills the scene", () => {
    const dir = tmp("showcase");
    makeClip(path.join(dir, "rec.mp4"), [{ color: "blue", seconds: 10 }], { audio: false });
    writeFileSync(path.join(dir, "log.json"), JSON.stringify(LOG));
    const vj = {
      version: 1,
      meta: { title: "t", type: "showcase", format: "youtube-16x9", fps: 30, lang: "en" },
      scenes: [],
    };
    writeFileSync(path.join(dir, "video.json"), JSON.stringify(vj));
    const r = run([
      "--log",
      path.join(dir, "log.json"),
      "--video",
      path.join(dir, "rec.mp4"),
      "--out",
      path.join(dir, "edited.mp4"),
      "--into",
      path.join(dir, "video.json"),
      "--scene",
      "demo",
    ]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(40);
    expect(Math.abs(seconds(path.join(dir, "edited.mp4")) - 5.8)).toBeLessThan(0.25);
    const out = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
    expect(out.scenes[0]).toMatchObject({
      id: "demo",
      kind: "screen",
      durationFrom: "fixed",
      seconds: 5.8,
    });
    expect(out.scenes[0].props.asset).toBe("screen-rec");
    expect(out.assets[0]).toMatchObject({ id: "screen-rec", path: "edited.mp4" });
    expect(out.assets[0].licence).toMatch(/own/);
    // Running again without --force does not overwrite the edited file.
    const again = run([
      "--log",
      path.join(dir, "log.json"),
      "--video",
      path.join(dir, "rec.mp4"),
      "--out",
      path.join(dir, "edited.mp4"),
    ]);
    expect(again.status).toBe(2);
    expect(again.stderr).toMatch(/already exists/);
  });
  it("refuses URLs and pseudo-files as the recording", () => {
    const dir = tmp("showcase");
    writeFileSync(path.join(dir, "log.json"), JSON.stringify(LOG));
    const r = run([
      "--log",
      path.join(dir, "log.json"),
      "--video",
      "http://example.com/a.mp4",
      "--out",
      path.join(dir, "o.mp4"),
    ]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/Refused/);
  });
});
