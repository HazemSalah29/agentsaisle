import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { fixtureVideo } from "./video-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Build = {
  buildRemotionProject: (o: Loose) => {
    files: Record<string, string>;
    media: Loose[];
    fonts: Loose[];
    notes: string[];
    size: number[];
    frames: number;
  };
};
type Runtime = {
  clipVisible: (s: number, d: number, t: number) => boolean;
  applyFrame: (root: Loose, t: number) => Loose[];
  seekVideo: (el: Loose, t: number) => Promise<void>;
};
type Rm = {
  binOfRemotion: (d: string, fs: Loose) => Loose | null;
  findRemotion: (o: Loose, fs?: Loose) => Loose | null;
  remotionProblems: (f: Loose) => string[];
  remotionArgs: (o: Loose) => string[];
};
type Project = { buildProject: (o: Loose) => Loose; buildParts: (o: Loose) => Loose };
type Timing = { buildTiming: (v: Loose, m: (id: string) => number, pad?: number) => Loose };

const timingFor = async (video: Loose) => {
  const { buildTiming } = await loadScript<Timing>("video-core", "scripts/timing.mjs");
  return buildTiming(video, () => 1.2, 0.3);
};
const build = () => loadScript<Build>("video-core", "assets/engine/remotion/build.mjs");
const rm = () => loadScript<Rm>("video-core", "scripts/render-remotion.mjs");

/** A tiny stand-in for a DOM element, enough for the frame logic. */
const el = (attrs: Record<string, string>, extra: Loose = {}) => {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    style: {} as Record<string, string>,
    getAttribute: (k: string) => attrs[k] ?? null,
    addEventListener: (k: string, f: () => void) => (listeners[k] ??= []).push(f),
    fire: (k: string) => (listeners[k] ?? []).splice(0).forEach((f) => f()),
    readyState: 4,
    currentTime: 0,
    ...extra,
  };
};

describe("remotion project builder", () => {
  it("writes the project files, sized to the film", async () => {
    const { buildRemotionProject } = await build();
    const video = fixtureVideo();
    const t = await timingFor(video);
    const r = buildRemotionProject({ video, timing: t });
    expect(Object.keys(r.files).sort()).toEqual([
      "package.json",
      "src/Film.tsx",
      "src/Root.tsx",
      "src/film.json",
      "src/index.ts",
      "src/runtime.js",
      "src/tween.js",
      "tsconfig.json",
    ]);
    const film = JSON.parse(r.files["src/film.json"]!);
    expect(r.size).toEqual([1080, 1920]);
    expect([film.width, film.height, film.fps]).toEqual([1080, 1920, 30]);
    expect(film.frames).toBe(Math.round(t.totalSeconds * 30));
    expect(r.frames).toBe(film.frames);
    expect(film.body.match(/<section id="sc-[a-z]+" class="clip scene/g)).toHaveLength(3);
    expect(film.plan.length).toBeGreaterThan(0);
    expect(film.css).toContain("#film{");
    expect(film.css).not.toContain("#root");
  });

  it("is deterministic, fetches nothing and keeps hostile text inert", async () => {
    const { buildRemotionProject } = await build();
    const video = fixtureVideo() as Loose;
    video.scenes[0].props.text = `</script><script>alert(1)</script><b onmouseover=x>`;
    const t = await timingFor(video);
    const a = buildRemotionProject({ video, timing: t });
    expect(a.files).toEqual(buildRemotionProject({ video, timing: t }).files);
    const film = JSON.parse(a.files["src/film.json"]!);
    expect(film.body).toContain("&lt;/script&gt;");
    expect(film.body).not.toContain("<b onmouseover");
    expect(a.files["src/film.json"]).not.toContain("<"); // safe to inline anywhere
    for (const [name, text] of Object.entries(a.files))
      if (name.startsWith("src/") && name !== "src/tween.js")
        expect(text, name).not.toMatch(/https?:\/\/(?!localhost)/);
    for (const f of ["src/Film.tsx", "src/runtime.js", "src/Root.tsx"])
      expect(a.files[f], f).not.toMatch(/Date\.now|Math\.random|setTimeout|requestAnimationFrame/);
  });

  it("puts media and fonts under public/ and rejects nothing the other engine accepts", async () => {
    const { buildRemotionProject } = await build();
    const video: Loose = fixtureVideo();
    video.meta.lang = "ar";
    video.assets = [{ id: "pic", path: "assets/pic.JPG", source: "user", licence: "own" }];
    video.scenes.push({
      id: "b",
      kind: "broll",
      durationFrom: "fixed",
      seconds: 2,
      props: { asset: "pic" },
    });
    const t = await timingFor(video);
    const args = {
      video,
      timing: t,
      fontFiles: ["/studio/brand/fonts/Cairo.ttf"],
      assetPaths: new Map([["pic", "/p/assets/pic.JPG"]]),
    };
    const r = buildRemotionProject(args);
    expect(r.media).toEqual([{ from: "/p/assets/pic.JPG", to: "public/assets/media/pic.jpg" }]);
    expect(r.fonts).toEqual([
      { from: "/studio/brand/fonts/Cairo.ttf", to: "public/assets/fonts/Cairo.ttf" },
    ]);
    expect(JSON.parse(r.files["src/film.json"]!).dir).toBe("rtl");
    // Same scenes and plan as HyperFrames: one source of truth.
    const { buildParts } = await loadScript<Project>("video-core", "scripts/project.mjs");
    const parts = buildParts(args);
    const film = JSON.parse(r.files["src/film.json"]!);
    expect(film.body).toBe(parts.body);
    expect(film.plan).toEqual(parts.plan);
    expect(r.notes).toEqual(parts.notes);
  });

  it("the page code waits for fonts and videos and uses staticFile for files", async () => {
    const { buildRemotionProject } = await build();
    const video = fixtureVideo();
    const t = await timingFor(video);
    const film = buildRemotionProject({ video, timing: t }).files["src/Film.tsx"]!;
    for (const needle of [
      "delayRender",
      "continueRender",
      "staticFile",
      "document.fonts.ready",
      "seekVideo",
      "frame / fps",
    ])
      expect(film).toContain(needle);
  });
});

describe("remotion frame logic", () => {
  it("shows a clip only inside its window", async () => {
    const { clipVisible } = await loadScript<Runtime>(
      "video-core",
      "assets/engine/remotion/runtime.mjs",
    );
    expect(clipVisible(1, 2, 0.99)).toBe(false);
    expect(clipVisible(1, 2, 1)).toBe(true);
    expect(clipVisible(1, 2, 2.99)).toBe(true);
    expect(clipVisible(1, 2, 3)).toBe(false);
  });
  it("hides and shows clips and gives each visible video its own time", async () => {
    const { applyFrame } = await loadScript<Runtime>(
      "video-core",
      "assets/engine/remotion/runtime.mjs",
    );
    const a = el({ "data-start": "0", "data-duration": "2" });
    const b = el({ "data-start": "2", "data-duration": "3" });
    const vid = el({ src: "assets/media/x.mp4" });
    (vid as Loose).closest = () => b;
    const root = {
      querySelectorAll: (sel: string) => (sel === "video" ? [vid] : [a, b]),
    };
    expect(applyFrame(root, 1)).toEqual([]);
    expect([a.style.visibility, b.style.visibility]).toEqual(["visible", "hidden"]);
    const shown = applyFrame(root, 3.5);
    expect([a.style.visibility, b.style.visibility]).toEqual(["hidden", "visible"]);
    expect(shown).toHaveLength(1);
    expect(shown[0]!.time).toBeCloseTo(1.5, 6);
  });
  it("seekVideo waits for the seek and rejects on a read error", async () => {
    const { seekVideo } = await loadScript<Runtime>(
      "video-core",
      "assets/engine/remotion/runtime.mjs",
    );
    const v = el({ src: "a.mp4" }, { currentTime: 0, readyState: 4 });
    let done = false;
    const p = seekVideo(v, 2).then(() => (done = true));
    await Promise.resolve();
    expect(v.currentTime).toBe(2);
    expect(done).toBe(false);
    v.fire("seeked");
    await p;
    expect(done).toBe(true);
    const bad = el({ src: "bad.mp4" }, { readyState: 0 });
    const q = seekVideo(bad, 1);
    bad.fire("error");
    await expect(q).rejects.toThrow(/bad\.mp4/);
  });
});

describe("remotion install and render", () => {
  const files = (map: Record<string, Loose>) => ({
    exists: (f: string) => f in map,
    readJson: (f: string) => map[f],
  });
  const pj = (cli: string, core: string) =>
    files({
      "/n/node_modules/@remotion/cli/package.json": {
        name: "@remotion/cli",
        version: cli,
        bin: { remotion: "remotion-cli.js" },
      },
      "/n/node_modules/remotion/package.json": { name: "remotion", version: core },
    });
  it("finds the CLI next to the project and checks versions", async () => {
    const m = await rm();
    const found = m.findRemotion({ dir: "/n/proj", list: () => [] }, pj("4.0.5", "4.0.5"));
    expect(found).toEqual({
      bin: "/n/node_modules/@remotion/cli/remotion-cli.js",
      version: "4.0.5",
      core: "4.0.5",
    });
    expect(m.remotionProblems(found!)).toEqual([]);
    expect(m.remotionProblems({ version: "5.0.0", core: "5.0.0" })[0]).toMatch(/major version 4/);
    expect(m.remotionProblems({ version: "4.0.5", core: "4.0.4" })[0]).toMatch(/same version/);
    expect(m.remotionProblems({ version: "4.0.5", core: null })[0]).toMatch(/not found/);
    expect(m.findRemotion({ dir: "/other", list: () => [] }, pj("4.0.5", "4.0.5"))).toBeNull();
  });
  it("renders without audio, from the project's public folder", async () => {
    const m = await rm();
    const a = m.remotionArgs({ bin: "/b.js", out: "/o/silent.mp4", draft: false });
    expect(a.slice(0, 5)).toEqual(["/b.js", "render", "src/index.ts", "main", "/o/silent.mp4"]);
    expect(a).toContain("--muted");
    expect(a).toContain("--public-dir=public");
    expect(m.remotionArgs({ bin: "/b.js", out: "/o", draft: true })).toContain("--scale=0.5");
  });
  it("the CLI builds the project and calls the installed CLI, never rendering without it", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-rm-"));
    const video = fixtureVideo() as Loose;
    video.scenes[0] = { ...video.scenes[0], durationFrom: "fixed", seconds: 2, narration: [] };
    writeFileSync(path.join(dir, "video.json"), JSON.stringify(video));
    writeFileSync(path.join(dir, "script.md"), "# Fixture\n");
    const run = (...a: string[]) =>
      spawnSync("node", [skillFile("video-core", "scripts/render.mjs"), dir, ...a], {
        encoding: "utf8",
      });
    expect(run("--engine", "manim").status).toBe(2);
    // not installed: says how to install, with the licence note
    const missing = run("--engine", "remotion", "--remotion", path.join(dir, "nowhere"));
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/Remotion is not installed.*remotion\.dev\/license/s);
    // a stand-in CLI that only records how it was called
    const nm = path.join(dir, "node_modules");
    mkdirSync(path.join(nm, "@remotion", "cli"), { recursive: true });
    mkdirSync(path.join(nm, "remotion"), { recursive: true });
    writeFileSync(
      path.join(nm, "@remotion", "cli", "package.json"),
      JSON.stringify({ name: "@remotion/cli", version: "4.0.1", bin: { remotion: "cli.js" } }),
    );
    writeFileSync(
      path.join(nm, "remotion", "package.json"),
      JSON.stringify({ name: "remotion", version: "4.0.1" }),
    );
    writeFileSync(
      path.join(nm, "@remotion", "cli", "cli.js"),
      `require("fs").writeFileSync(${JSON.stringify(path.join(dir, "called.json"))}, JSON.stringify(process.argv.slice(2)));`,
    );
    const r = run("--engine", "remotion");
    expect(r.status).toBe(1); // the stand-in makes no video
    expect(r.stderr).toMatch(/Remotion render failed/);
    const called = JSON.parse(readFileSync(path.join(dir, "called.json"), "utf8"));
    expect(called.slice(0, 4)).toEqual([
      "render",
      "src/index.ts",
      "main",
      path.join(dir, "out", "rm", "silent.mp4"),
    ]);
    expect(called).toContain("--muted");
    expect(existsSync(path.join(dir, "out", "rm", "src", "film.json"))).toBe(true);
  });
});
