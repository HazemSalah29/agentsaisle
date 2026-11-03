import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const SCRIPT =
  "# t\n[l1] Mina finds a lantern.\n  beat: hook\n[l2] It lights the whole beach.\n  beat: turn\n";
const BIBLE =
  "# Style bible\nWorld: a quiet beach.\nPalette: #f4c95d, #1d3557\nMina: girl, yellow raincoat.\n";
const shot = (o: Loose = {}) => ({
  id: "s1",
  lines: ["l1"],
  seconds: 4,
  camera: "push-in",
  action: "Mina kneels",
  mood: "calm",
  characters: ["mina"],
  prompt: "Mina in a yellow raincoat on a beach, storybook style",
  asset: "s1-still",
  ...o,
});
const doc = (shots: Loose[], generator = "stills-only") => ({ generator, aspect: "9:16", shots });
const story = (name: string, dir: string, ...args: string[]) =>
  spawnSync("node", [skillFile("video-story", `scripts/${name}.mjs`), dir, ...args], {
    encoding: "utf8",
  });
const project = (shots: Loose[], extra: Loose = {}) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "video-story-"));
  writeFileSync(path.join(dir, "script.md"), SCRIPT);
  writeFileSync(path.join(dir, "style-bible.md"), BIBLE);
  writeFileSync(path.join(dir, "shots.json"), JSON.stringify(doc(shots)));
  for (const [f, v] of Object.entries(extra)) writeFileSync(path.join(dir, f), JSON.stringify(v));
  return dir;
};
const two = () => [shot(), shot({ id: "s2", lines: ["l2"], asset: "s2-still" })];

describe("video-story shot list", () => {
  it("accepts a good list and prints the plan", () => {
    const r = story("shots", project(two()), "--plan");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("2 shots, 8s");
    expect(r.stdout).toContain("stills-only");
  });
  it("catches length, coverage, order, characters, missing motion and duplicates", async () => {
    const { shotProblems } = await loadScript<Loose>("video-story", "scripts/shots.mjs");
    const ctx = { scriptIds: ["l1", "l2"], bible: BIBLE };
    const p = (d: Loose) => shotProblems(d, ctx).join("\n");
    expect(p(doc([shot({ seconds: 2 }), shot({ id: "s2", lines: ["l2"] })]))).toMatch(
      /outside 3 to 8/,
    );
    expect(p(doc([shot()]))).toMatch(/no shot covers l2/);
    expect(p(doc([shot({ lines: ["l2"] }), shot({ id: "s2", lines: ["l1"] })]))).toMatch(
      /script order/,
    );
    expect(p(doc([shot({ characters: ["zed"] }), shot({ id: "s2", lines: ["l2"] })]))).toMatch(
      /"zed" is not described/,
    );
    expect(p(doc(two(), "veo"))).toMatch(/motion: required/);
    expect(p(doc([shot(), shot({ lines: ["l2"] })]))).toMatch(/used twice/);
    expect(p(doc([shot({ lines: ["l1", "l9"] }), shot({ id: "s2", lines: ["l2"] })]))).toMatch(
      /"l9" is not in script/,
    );
    expect(p(doc(two(), "sora"))).toMatch(/not one of/);
  });
  it("refuses known characters, brands and likeness requests in prompts, but not a chase scene", async () => {
    const { shotProblems } = await loadScript<Loose>("video-story", "scripts/shots.mjs");
    const ctx = { scriptIds: ["l1"], bible: BIBLE };
    const p = (prompt: string) => shotProblems(doc([shot({ prompt })]), ctx).join("\n");
    expect(p("Mickey Mouse on the beach")).toMatch(/copyrighted or trademarked/);
    expect(p("a girl wearing Nike shoes")).toMatch(/copyrighted or trademarked/);
    expect(p("a face that looks like a famous actor")).toMatch(/likeness/);
    expect(p("a chase along the beach, storybook style")).toBe("");
  });
  it("--build writes broll scenes that video-core accepts, and refuses to overwrite", async () => {
    const video = {
      version: 1,
      meta: { title: "T", type: "story", format: "reel-9x16", fps: 30, lang: "en" },
      script: "script.md",
      scenes: [],
      assets: ["s1-still", "s2-still"].map((id) => ({
        id,
        path: `generated/${id}.png`,
        kind: "image",
        source: "generated",
        licence: "test",
        aiGenerated: true,
      })),
    };
    const dir = project(two(), { "video.json": video });
    mkdirSync(path.join(dir, "generated"));
    for (const id of ["s1-still", "s2-still"])
      writeFileSync(path.join(dir, "generated", `${id}.png`), "x");
    expect(story("shots", dir, "--build").status).toBe(0);
    const out = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
    expect(out.scenes.map((s: Loose) => [s.id, s.kind, s.props.asset])).toEqual([
      ["s1", "broll", "s1-still"],
      ["s2", "broll", "s2-still"],
    ]);
    const { checkProject } = await loadScript<Loose>("video-core", "scripts/check.mjs");
    expect(checkProject(out, dir)).toEqual([]);
    expect(story("shots", dir, "--build").stdout).toMatch(/already has scenes/);
    expect(
      story("shots", project(two(), { "video.json": { ...video, assets: [] } }), "--build").stdout,
    ).toMatch(/not in video.json assets/);
  });
});

describe("video-story continuity and reference packs", () => {
  const entry = (o: Loose = {}) => ({
    location: "beach",
    timeOfDay: "dusk",
    characters: { mina: { outfit: "yellow raincoat", props: [] } },
    ...o,
  });
  it("flags unexplained changes and missing anchors, and accepts explained ones", async () => {
    const { continuityProblems, refsFor } = await loadScript<Loose>(
      "video-story",
      "scripts/continuity.mjs",
    );
    const shots = two();
    const ok = { shots: { s1: entry(), s2: entry({ anchor: "generated/s1-still.png" }) } };
    expect(continuityProblems(shots, ok)).toEqual([]);
    const bad = {
      shots: {
        s1: entry(),
        s2: entry({
          timeOfDay: "night",
          characters: { mina: { outfit: "red coat", props: ["lantern"] } },
        }),
      },
    };
    const text = continuityProblems(shots, bad).join("\n");
    expect(text).toMatch(/needs an anchor/);
    expect(text).toMatch(/outfit or props changed/);
    expect(text).toMatch(/time of day changed/);
    const why = {
      shots: {
        s1: entry(),
        s2: entry({
          anchor: "generated/s1-still.png",
          timeOfDay: "night",
          change: "night falls",
          characters: { mina: { outfit: "red coat", props: [], change: "she changed" } },
        }),
      },
    };
    expect(continuityProblems(shots, why)).toEqual([]);
    expect(continuityProblems(shots, { shots: { s1: entry() } }).join()).toMatch(/s2: no entry/);
    expect(continuityProblems(shots, ok, () => false).join()).toMatch(/not an existing file/);
    expect(refsFor(shots[1], ok.shots.s2, () => true)).toEqual([
      "generated/s1-still.png",
      "refpack/mina/front.png",
    ]);
  });
  it("plans five views per character, checks files, and refuses known names", async () => {
    const { packPlan } = await loadScript<Loose>("video-story", "scripts/refpack.mjs");
    const plan = packPlan({
      style: "painted storybook",
      characters: { mina: { look: "girl, yellow raincoat" } },
    });
    expect(plan.problems).toEqual([]);
    expect(plan.items.map((i: Loose) => i.view)).toEqual([
      "front",
      "three-quarter",
      "side",
      "expressions",
      "poses",
    ]);
    expect(plan.items[0].prompt).toContain("One character only");
    expect(
      packPlan({ style: "x", characters: { mickey: { look: "mouse" } } }).problems.join(),
    ).toMatch(/copyrighted/);
    expect(packPlan({ style: "", characters: {} }).problems).toHaveLength(2);
    const dir = project(two(), {
      "refpack.json": { style: "painted", characters: { mina: { look: "girl" } } },
    });
    expect(story("refpack", dir).status).toBe(0);
    expect(story("refpack", dir, "--check").stdout).toMatch(/missing refpack\/mina\/front.png/);
  });
  it("keeps the byte-identical copies in step", () => {
    const same = (a: string, b: string, f = a) =>
      expect(readFileSync(skillFile("video-story", `scripts/${a}`), "utf8")).toBe(
        readFileSync(skillFile(b.split(":")[0]!, `scripts/${b.split(":")[1] ?? f}`), "utf8"),
      );
    same("_lib.mjs", "video-core:_lib.mjs");
    same("_script-parse.mjs", "video-write:script-parse.mjs");
  });
});
