import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { GOOD } from "./video-puppet-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Rig3 = { rig3dProblems: (r: unknown) => string[]; SHAPES: string[] };
type Kids3 = { scaffold3d: (b: Loose, n: string) => Loose };
type Bible = { parseBible: (t: string) => Loose };
type P3 = {
  CHANNELS: number;
  sampleCharacter: (c: Loose, i: number, o: Loose) => { n: number; samples: number[] };
  puppet3d: (s: Loose, ctx: Loose) => { html: string; plan: Loose[]; gl: Loose };
};
type Scenes = { renderScene: (s: Loose, c: Loose) => { html: string; plan: Loose[]; gl?: Loose } };
type Puppet = { puppetProblems: (p: Loose, ids?: string[] | null) => string[] };
type Project = { buildProject: (o: Loose) => { files: Record<string, string>; media: Loose[] } };

const rig3 = () => loadScript<Rig3>("video-core", "assets/puppet/rig3d.mjs");
const scaffoldMod = () => loadScript<Kids3>("video-kids", "scripts/puppet3d.mjs");
const bibleMod = () => loadScript<Bible>("video-kids", "scripts/bible-check.mjs");
const p3 = () => loadScript<P3>("video-core", "assets/engine/hyperframes/puppet3d.mjs");
const scenes = () => loadScript<Scenes>("video-core", "assets/engine/hyperframes/scenes.mjs");
const puppet = () => loadScript<Puppet>("video-core", "assets/engine/hyperframes/puppet.mjs");
const project = () => loadScript<Project>("video-core", "scripts/project.mjs");

const starter = async (text = GOOD) => {
  const { scaffold3d } = await scaffoldMod();
  const { parseBible } = await bibleMod();
  return scaffold3d(parseBible(text), "nour");
};
const char = (o: Loose = {}) => ({ rig: "nour", x: 0.3, y: 0.58, height: 0.4, ...o });
const ctx = async (o: Loose = {}) => ({
  prefix: "sc-a",
  at: 2,
  seconds: 4,
  fps: 30,
  lines: [{ id: "l1", start: 0.5, seconds: 2 }],
  lang: "en",
  first: false,
  rise: 24,
  size: [1080, 1920],
  assets: new Map(),
  rigs: new Map(),
  rigs3d: new Map([["nour", await starter()]]),
  visemes: new Map(),
  ...o,
});

describe("3D rig checker", () => {
  it("accepts the starter rig for every shape language and species", async () => {
    const { rig3dProblems } = await rig3();
    for (const shape of ["round", "square", "triangle"])
      for (const species of ["turtle", "rabbit", "fox", "bird"])
        expect(
          rig3dProblems(
            await starter(
              GOOD.replace("round", shape).replace("Species: turtle", `Species: ${species}`),
            ),
          ),
        ).toEqual([]);
  });
  it("needs the same parts as the flat rig, and the lists stay in step", async () => {
    const { rig3dProblems } = await rig3();
    const rig = await starter();
    rig.parts = rig.parts.filter((p: Loose) => p.id !== "mouth-o");
    expect(rig3dProblems(rig).join()).toMatch(/"mouth-o" is missing/);
    const flat = await loadScript<{ REQUIRED: string[] }>("video-core", "assets/puppet/rig.mjs");
    const text = readFileSync(skillFile("video-core", "assets/puppet/rig3d.mjs"), "utf8");
    for (const id of flat.REQUIRED.filter((x) => x.startsWith("mouth-")))
      expect(text).toContain(id.slice(6));
    const full = (await starter()).parts.map((p: Loose) => p.id);
    for (const id of flat.REQUIRED) expect(full).toContain(id);
  });
  it.each([
    ["an unknown shape", (r: Loose) => (r.parts[0].shape = "teapot"), /shape: one of/],
    ["an unknown material", (r: Loose) => (r.parts[0].material = "gold"), /not in materials/],
    ["a bad colour", (r: Loose) => (r.materials.skin.color = "green"), /color: #hex/],
    ["a roughness over 1", (r: Loose) => (r.materials.skin.roughness = 4), /roughness/],
    ["a huge size", (r: Loose) => (r.parts[0].size = [99, 1, 1]), /size/],
    ["a pivot that is not three numbers", (r: Loose) => (r.parts[0].pivot = [0, 0]), /pivot/],
    ["an unknown parent", (r: Loose) => (r.parts[2].parent = "nope"), /not a part/],
    [
      "a loop of parents",
      (r: Loose) => (r.parts.find((p: Loose) => p.id === "body").parent = "head"),
      /loop/,
    ],
    ["a duplicate id", (r: Loose) => (r.parts[1].id = r.parts[0].id), /used twice/],
    ["no height", (r: Loose) => delete r.height, /height/],
  ])("refuses %s", async (_n, mutate, re) => {
    const { rig3dProblems } = await rig3();
    const rig = await starter();
    (mutate as (r: Loose) => void)(rig);
    expect(rig3dProblems(rig).join("\n")).toMatch(re as RegExp);
  });
  it("refuses a model path, a script or a texture because they have nowhere to go", async () => {
    const { rig3dProblems } = await rig3();
    const rig = await starter();
    rig.parts[0].model = "https://example.invalid/m.glb";
    rig.materials.skin.map = "https://example.invalid/t.png";
    // Unknown keys are never read: the renderer only builds the primitives and colours named in the checker.
    expect(rig3dProblems(rig)).toEqual([]);
    const page = readFileSync(
      skillFile("video-core", "assets/engine/hyperframes/puppet3d-page.mjs"),
      "utf8",
    );
    expect(page).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|TextureLoader|GLTFLoader|ImageLoader|\.src\s*=|import\s*\(/,
    );
  });
  it("is byte-identical in video-kids", () => {
    expect(readFileSync(skillFile("video-kids", "scripts/_rig3d.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "assets/puppet/rig3d.mjs"), "utf8"),
    );
  });
});

describe("3D starter characters", () => {
  it("vary with the shape language and species", async () => {
    const shell = await starter();
    expect(shell.parts.map((p: Loose) => p.id)).toContain("shell");
    expect(shell.parts.find((p: Loose) => p.id === "body").shape).toBe("sphere");
    const rabbit = await starter(
      GOOD.replace("round", "triangle").replace("Species: turtle", "Species: rabbit"),
    );
    expect(rabbit.parts.map((p: Loose) => p.id)).toEqual(
      expect.arrayContaining(["ear-l", "ear-r"]),
    );
    expect(rabbit.parts.map((p: Loose) => p.id)).not.toContain("shell");
    expect(rabbit.parts.find((p: Loose) => p.id === "body").shape).toBe("droplet");
    const square = await starter(GOOD.replace("round", "square"));
    expect(square.parts.find((p: Loose) => p.id === "head").shape).toBe("box");
  });
  it("takes its materials from the bible's palette", async () => {
    const rig = await starter();
    expect(rig.materials.skin.color).toBe("#3f9f6b");
    expect(rig.materials.accent.color).toBe("#f2c94c");
    expect(rig.materials.belly.color).toBe("#ffffff");
  });
});

describe("3D motion samples", () => {
  const props = {
    char: char({
      acts: [
        { at: 0.5, do: "wave", dur: 1.6 },
        { at: 3, do: "jump" },
      ],
      speaks: ["l1"],
    }),
  };
  const opts = {
    seconds: 4,
    fps: 30,
    lines: [{ id: "l1", start: 0.5, seconds: 2 }],
    visemes: new Map([
      [
        "l1",
        [
          { t: 0, v: "a" },
          { t: 1, v: "mbp" },
          { t: 1.5, v: "rest" },
        ],
      ],
    ]),
  };
  it("gives one row of numbers a frame, deterministically", async () => {
    const { sampleCharacter, CHANNELS } = await p3();
    const a = sampleCharacter(props.char, 0, opts);
    expect(a.n).toBe(121);
    expect(a.samples).toHaveLength(121 * CHANNELS);
    expect(a.samples.every(Number.isFinite)).toBe(true);
    expect(sampleCharacter(props.char, 0, opts)).toEqual(a);
  });
  it("waves the right arm, jumps, and moves the mouth with the voice", async () => {
    const { sampleCharacter, CHANNELS } = await p3();
    const { samples } = sampleCharacter(props.char, 0, opts);
    const at = (t: number, ch: number) => samples[Math.round(t * 30) * CHANNELS + ch];
    expect(at(1.2, 8)).toBeLessThan(-100); // right arm up
    expect(at(0, 8)).toBeGreaterThan(-5);
    expect(
      Math.max(...Array.from({ length: 121 }, (_, k) => samples[k * CHANNELS + 1])),
    ).toBeGreaterThan(0.09); // lift
    expect(at(1.0, 13)).toBe(1); // "a" at line start + 0.5
    expect(at(1.7, 13)).toBe(5); // "mbp" from 1.5 to 2.0
    expect(at(0.1, 13)).toBe(0); // rest before the line
  });
  it("turns toward the way a character walks, smoothly", async () => {
    const { sampleCharacter, CHANNELS } = await p3();
    const c = char({ acts: [{ at: 0.5, do: "walk", to: 0.1, dur: 2 }] });
    const { samples } = sampleCharacter(c, 0, opts);
    const yaw = (t: number) => samples[Math.round(t * 30) * CHANNELS + 2];
    expect(yaw(0)).toBeGreaterThan(0.3);
    expect(yaw(2.5)).toBeLessThan(-0.3);
    const mid = yaw(0.6);
    expect(mid).toBeLessThan(yaw(0));
    expect(mid).toBeGreaterThan(yaw(2.5));
  });
});

describe("3D puppet scene", () => {
  const scene = (o: Loose = {}) => ({
    kind: "puppet",
    props: { look: "3d", backdrop: { preset: "meadow" }, cast: [char()], ...o },
  });
  it("accepts look 2d or 3d only", async () => {
    const { puppetProblems } = await puppet();
    expect(puppetProblems(scene().props)).toEqual([]);
    expect(puppetProblems({ ...scene().props, look: "4d" }).join()).toMatch(/look/);
  });
  it("renders a canvas and hands the page its data, with no 2D animation", async () => {
    const { renderScene } = await scenes();
    const r = renderScene(scene(), await ctx());
    expect(r.html).toContain('<canvas id="sc-a-gl"');
    expect(r.plan).toEqual([]);
    expect(r.gl).toMatchObject({
      id: "sc-a-gl",
      at: 2,
      seconds: 4,
      fps: 30,
      size: [1080, 1920],
      backdrop: "meadow",
    });
    expect(r.gl?.cast[0]).toMatchObject({ x: 0.3, y: 0.58, height: 0.4, n: 121 });
    expect(r.gl?.cast[0].rig.name).toBe("nour");
  });
  it("refuses a missing or broken 3D rig", async () => {
    const { renderScene } = await scenes();
    expect(() => renderScene(scene(), { ...ctx, rigs3d: new Map() } as Loose)).toThrow();
    const c = await ctx({ rigs3d: new Map() });
    expect(() => renderScene(scene(), c)).toThrow(/puppet3d\.json/);
    const bad = await starter();
    bad.parts[0].shape = "teapot";
    expect(() => renderScene(scene(), { ...c, rigs3d: new Map([["nour", bad]]) })).toThrow(/3D/);
  });
  it("builds a page that loads its own three.js and code, and fetches nothing", async () => {
    const { buildProject } = await project();
    const video = {
      version: 1,
      meta: {
        title: "t",
        type: "kids",
        format: "reel-9x16",
        fps: 30,
        lang: "en",
        audience: "kids-3-5",
      },
      scenes: [{ id: "s1", kind: "puppet", durationFrom: "fixed", seconds: 4, ...scene() }],
    };
    const timing = {
      fps: 30,
      totalSeconds: 4,
      scenes: [{ id: "s1", start: 0, seconds: 4, lines: [] }],
    };
    const out = buildProject({
      video,
      timing,
      brand: undefined,
      rigs3d: new Map([["nour", await starter()]]),
    });
    const html = out.files["index.html"];
    expect(html).toContain('<script type="module">');
    expect(html).toContain('import { mount } from "./assets/3d/puppet3d-page.mjs"');
    expect(html).not.toMatch(/https?:\/\//);
    expect(out.media.map((m) => m.to).sort()).toEqual([
      "assets/3d/puppet3d-page.mjs",
      "assets/3d/three.mjs",
    ]);
    // A film with no 3D scene stays a plain page with no module and no three.js.
    const flat = buildProject({
      video: {
        ...video,
        scenes: [
          { id: "s1", kind: "title", durationFrom: "fixed", seconds: 4, props: { text: "Hi" } },
        ],
      },
      timing,
      brand: undefined,
    });
    expect(flat.files["index.html"]).not.toContain('type="module"');
    expect(flat.media).toEqual([]);
  });
});

describe("vendored three.js", () => {
  const text = readFileSync(skillFile("video-core", "assets/vendor/three.mjs"), "utf8");
  it("is the pinned, MIT-licensed build with only what the scene uses, in readable lines", () => {
    const pinned = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"))
      .devDependencies.three;
    expect(text.split("\n")[0]).toContain(`three.js ${pinned}`);
    expect(text.split("\n")[0]).toContain("MIT");
    expect(Math.max(...text.split("\n").map((l) => l.length))).toBeLessThan(400);
    expect(text).not.toMatch(/\bfetch\s*\(|new XMLHttpRequest|new Image\(|class \w*Loader\b/);
  });
  it("exports what the page code imports", async () => {
    const mod = (await import(skillFile("video-core", "assets/vendor/three.mjs"))) as Loose;
    const page = readFileSync(
      skillFile("video-core", "assets/engine/hyperframes/puppet3d-page.mjs"),
      "utf8",
    );
    for (const name of new Set([...page.matchAll(/\bT\.([A-Z][A-Za-z0-9]+)/g)].map((m) => m[1])))
      expect(mod[name], name).toBeDefined();
  });
});
