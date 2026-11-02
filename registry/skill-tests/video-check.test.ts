import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { sampleRig } from "./video-puppet-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type Check = {
  checkProject: (video: unknown, dir: string) => string[];
  scriptLineIds: (text: string) => Set<string>;
};
type Video = Loose;

let dir: string;
let check: Check;

const base = (): Video => ({
  version: 1,
  meta: { title: "Hello", type: "explainer", format: "reel-9x16", fps: 30, lang: "en" },
  scenes: [
    {
      id: "s1",
      kind: "title",
      durationFrom: "fixed",
      seconds: 3,
      props: { text: "Rate limiting" },
    },
  ],
});
const put = (rel: string, text = "x") => {
  mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  writeFileSync(path.join(dir, rel), text);
};

beforeEach(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), "video-check-"));
  check ??= await loadScript<Check>("video-core", "scripts/check.mjs");
});

describe("video-core check", () => {
  it("accepts an audience as long as the writer's brief allows (80 characters)", () => {
    const v = base();
    v.meta.audience = "a".repeat(80);
    expect(check.checkProject(v, dir)).toEqual([]);
    v.meta.audience = "a".repeat(81);
    expect(check.checkProject(v, dir).join()).toContain("audience");
  });

  it("accepts a minimal project", () => {
    expect(check.checkProject(base(), dir)).toEqual([]);
  });

  it("rejects a wrong version, an unknown kind and a bad format", () => {
    const v = base();
    v.version = 2;
    v.meta.format = "banner";
    v.scenes[0].kind = "hologram";
    const out = check.checkProject(v, dir).join("\n");
    expect(out).toMatch(/\$\.version: must be 1/);
    expect(out).toMatch(/\$\.meta\.format/);
    expect(out).toMatch(/\$\.scenes\[0\]\.kind: "hologram" is not one of/);
  });

  it("needs narration when the length comes from the voice, and seconds when it is fixed", () => {
    const v = base();
    v.scenes = [
      { id: "a", kind: "title", props: { text: "A" } },
      { id: "b", kind: "title", durationFrom: "fixed", props: { text: "B" } },
    ];
    const out = check.checkProject(v, dir).join("\n");
    expect(out).toMatch(/scene "a" takes its length from the voice but has no narration/);
    expect(out).toMatch(/\$\.scenes\[1\]\.seconds: a fixed scene needs seconds/);
  });

  it("checks narration ids against script.md", () => {
    put("script.md", "[l1] Hello there.\n- [l2] Second line.\n");
    const v = base();
    v.script = "script.md";
    v.scenes = [{ id: "a", kind: "title", narration: ["l1", "l9"], props: { text: "A" } }];
    expect(check.checkProject(v, dir).join("\n")).toMatch(/line "l9" is not in script\.md/);
    expect([...check.scriptLineIds("[a] x\n  [b-2] y")]).toEqual(["a", "b-2"]);
  });

  it("fails on duplicate scene ids", () => {
    const v = base();
    v.scenes.push({ ...v.scenes[0] });
    expect(check.checkProject(v, dir).join("\n")).toMatch(/"s1" is used twice/);
  });

  it("fails on a missing asset file, a missing licence and an escaping path", () => {
    const v = base();
    v.assets = [
      { id: "a1", path: "assets/a.jpg", source: "user", licence: "own" },
      { id: "a2", path: "assets/b.jpg", source: "user" },
      { id: "a3", path: "../secret.jpg", source: "user", licence: "own" },
    ];
    put("assets/b.jpg");
    const out = check.checkProject(v, dir).join("\n");
    expect(out).toMatch(/file "assets\/a\.jpg" is missing/);
    expect(out).toMatch(/asset "a2" has no licence/);
    expect(out).toMatch(/\$\.assets\[2\]\.path: must be a relative path inside the project/);
  });

  it("passes a licensed asset and a broll scene that uses it", () => {
    put("assets/a.jpg");
    const v = base();
    v.assets = [{ id: "a1", path: "assets/a.jpg", source: "user", licence: "own work" }];
    v.scenes = [
      { id: "b", kind: "broll", durationFrom: "fixed", seconds: 2, props: { asset: "a1" } },
    ];
    expect(check.checkProject(v, dir)).toEqual([]);
    v.scenes[0].props.asset = "zz";
    expect(check.checkProject(v, dir).join("\n")).toMatch(/"zz" is not listed in assets/);
  });

  it("checks a puppet scene's props, rig file and viseme file", () => {
    const rig = sampleRig({ name: "nour" });
    const cast = [{ rig: "nour", x: 0.4, y: 0.8, height: 0.5, speaks: ["l1"] }];
    const video = (c: Loose[]): Video => ({
      ...base(),
      script: "script.md",
      scenes: [
        {
          id: "p1",
          kind: "puppet",
          durationFrom: "fixed",
          seconds: 4,
          narration: ["l1"],
          props: { cast: c },
        },
      ],
    });
    writeFileSync(path.join(dir, "script.md"), "[l1] Hello.\n");
    const out = (c: Loose[]) => check.checkProject(video(c), dir).join("\n");
    expect(out(cast)).toContain("characters/nour/puppet.json is missing");
    mkdirSync(path.join(dir, "characters", "nour"), { recursive: true });
    const hostile = sampleRig({ name: "nour" });
    hostile.parts[0].svg = "<script>x</script>";
    writeFileSync(path.join(dir, "characters", "nour", "puppet.json"), JSON.stringify(hostile));
    expect(out(cast)).toMatch(/puppet\.json: .*<script>/);
    writeFileSync(path.join(dir, "characters", "nour", "puppet.json"), JSON.stringify(rig));
    expect(out(cast)).toContain("voice/visemes.json is missing");
    mkdirSync(path.join(dir, "voice"), { recursive: true });
    writeFileSync(path.join(dir, "voice", "visemes.json"), JSON.stringify({ lines: {} }));
    expect(check.checkProject(video(cast), dir)).toEqual([]);
    expect(out([{ ...cast[0], height: 5 }])).toContain("height");
  });
  it("checks a screen scene's props and that its assets are listed", () => {
    put("assets/rec.webm");
    const v = base();
    v.assets = [{ id: "rec", path: "assets/rec.webm", source: "user", licence: "own work" }];
    v.scenes = [
      {
        id: "d",
        kind: "screen",
        durationFrom: "fixed",
        seconds: 6,
        props: { asset: "rec", zoom: [{ at: 1, dur: 1, x: 0.5, y: 0.5, scale: 2 }] },
      },
    ];
    expect(check.checkProject(v, dir)).toEqual([]);
    v.scenes[0].props.zoom[0].scale = 9;
    v.scenes[0].props.pip = "zz";
    const out = check.checkProject(v, dir).join("\n");
    expect(out).toMatch(/props\.zoom\[0\]\.scale/);
    expect(out).toMatch(/props\.pip: "zz" is not listed in assets/);
  });

  it("requires music to exist and to be listed with a licence", () => {
    const v = base();
    v.music = { asset: "assets/m.mp3" };
    expect(check.checkProject(v, dir).join("\n")).toMatch(/\$\.music\.asset: file/);
    put("assets/m.mp3");
    expect(check.checkProject(v, dir).join("\n")).toMatch(/not listed in assets/);
    v.assets = [{ id: "m", path: "assets/m.mp3", source: "library", licence: "CC0" }];
    expect(check.checkProject(v, dir)).toEqual([]);
  });

  it("validates props per kind", () => {
    const v = base();
    v.scenes = [
      { id: "l", kind: "list", durationFrom: "fixed", seconds: 3, props: { items: [] } },
      {
        id: "c",
        kind: "chart",
        durationFrom: "fixed",
        seconds: 3,
        props: { type: "pie", data: [] },
      },
    ];
    const out = check.checkProject(v, dir).join("\n");
    expect(out).toMatch(/scenes\[0\]\.props\.items: at least 1 item/);
    expect(out).toMatch(/scenes\[1\]\.props\.type/);
    expect(out).toMatch(/scenes\[1\]\.props\.data: at least 2 item/);
  });

  it("fails on a credential anywhere in the file", () => {
    const v = base();
    v.scenes[0].props.text = "key sk-ant-" + "a".repeat(30);
    expect(check.checkProject(v, dir).join("\n")).toMatch(/looks like a credential/);
  });

  it("runs as a process: exit 0 when clean, 1 with problems, 2 without a file", () => {
    const run = (arg: string) =>
      spawnSync("node", [skillFile("video-core", "scripts/check.mjs"), arg], { encoding: "utf8" });
    writeFileSync(path.join(dir, "video.json"), JSON.stringify(base()));
    expect(run(dir).status).toBe(0);
    const bad = base();
    bad.scenes[0].kind = "nope";
    writeFileSync(path.join(dir, "video.json"), JSON.stringify(bad));
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(41);
    expect(run(path.join(dir, "missing")).status).toBe(2);
  });

  it("keeps the validator byte-identical to arch-visualize's", () => {
    const grab = (file: string) => {
      const s = readFileSync(skillFile(...(file.split("|") as [string, string])), "utf8");
      return s.slice(
        s.indexOf("const typeOk"),
        s.indexOf("return out;\n}", s.indexOf("function validate")),
      );
    };
    expect(grab("video-core|scripts/schema-check.mjs")).toBe(
      grab("arch-visualize|scripts/model-check.mjs"),
    );
  });
});
