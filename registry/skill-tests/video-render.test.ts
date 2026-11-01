import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { fixtureVideo, wav } from "./video-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type Project = {
  buildProject: (o: Loose) => {
    files: Record<string, string>;
    media: Loose[];
    fonts: Loose[];
    notes: string[];
    size: number[];
  };
  cleanBrand: (b: Loose) => { colors: Record<string, string>; font: string };
};
type Render = {
  binOf: (dir: string, fs: Loose) => { bin: string; version: string } | null;
  candidateDirs: (o: Loose) => string[];
  findHyperframes: (o: Loose, fs?: Loose) => { bin: string; version: string } | null;
  muxArgs: (o: Loose) => string[];
  voicePlacements: (v: Loose, t: Loose, dir: string) => { file: string; ms: number }[];
};
type Timing = { buildTiming: (v: Loose, m: (id: string) => number, pad?: number) => Loose };

const timingFor = async (video: Loose) => {
  const { buildTiming } = await loadScript<Timing>("video-core", "scripts/timing.mjs");
  return buildTiming(video, () => 1.2, 0.3);
};
const project = () => loadScript<Project>("video-core", "scripts/project.mjs");
const render = () => loadScript<Render>("video-core", "scripts/render.mjs");

describe("video-core project builder", () => {
  it("builds one timed clip per scene inside a root as long as the film", async () => {
    const { buildProject } = await project();
    const video = fixtureVideo();
    const t = await timingFor(video);
    const { files, size } = buildProject({ video, timing: t });
    const html = files["index.html"]!;
    expect(size).toEqual([1080, 1920]);
    expect(html).toContain(
      `data-composition-id="main" data-start="0" data-duration="${t.totalSeconds}" data-width="1080" data-height="1920" data-fps="30"`,
    );
    expect(html.match(/<section id="sc-[a-z]+" class="clip scene/g)).toHaveLength(3);
    expect(html).toContain(
      `id="sc-rules" class="clip scene scene-list" data-start="${t.scenes[1].start}" data-duration="${t.scenes[1].seconds}"`,
    );
    expect(html).toContain('window.__timelines["main"] = VT.run(');
    expect(html).not.toMatch(/https?:\/\//); // nothing is fetched
    expect(html).not.toMatch(/Date\.now|Math\.random|setTimeout|requestAnimationFrame/);
  });

  it("is deterministic and sizes the canvas per format", async () => {
    const { buildProject } = await project();
    const video = fixtureVideo();
    const t = await timingFor(video);
    expect(buildProject({ video, timing: t }).files["index.html"]).toBe(
      buildProject({ video, timing: t }).files["index.html"],
    );
    const wide = fixtureVideo();
    (wide as Loose).meta.format = "youtube-16x9";
    expect(buildProject({ video: wide, timing: t }).size).toEqual([1920, 1080]);
  });

  it("keeps hostile text from breaking out of markup or of the plan script", async () => {
    const { buildProject } = await project();
    const video = fixtureVideo();
    (video as Loose).scenes[0].props.text = `</script><script>alert(1)</script><b onmouseover=x>`;
    const t = await timingFor(video);
    const html = buildProject({ video, timing: t }).files["index.html"]!;
    expect(html.match(/<script/g)).toHaveLength(2); // the tween helper and the plan, nothing injected
    expect(html).not.toContain("<b onmouseover");
    expect(html).toContain("&lt;/script&gt;");
  });

  it("keeps only safe brand values", async () => {
    const { cleanBrand, buildProject } = await project();
    const brand = cleanBrand({
      colors: { bg: "red;}body{display:none", accent: "#112233" },
      font: "x';}</style>",
    });
    expect(brand.colors.bg).toBe("#0F1115");
    expect(brand.colors.accent).toBe("#112233");
    expect(brand.font).toBe("Inter");
    const video = fixtureVideo();
    const t = await timingFor(video);
    const html = buildProject({
      video,
      timing: t,
      brand: { colors: { bg: "url(//x)" }, font: "a;b" },
    }).files["index.html"]!;
    expect(html).not.toContain("url(//x)");
  });

  it("sets rtl for Arabic, loads local fonts and maps broll media", async () => {
    const { buildProject } = await project();
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
    const r = buildProject({
      video,
      timing: t,
      fontFiles: ["/studio/brand/fonts/Cairo.ttf"],
      assetPaths: new Map([["pic", "/p/assets/pic.JPG"]]),
    });
    expect(r.files["index.html"]).toContain('dir="rtl"');
    expect(r.files["index.html"]).toContain(
      "@font-face{font-family:'Cairo';src:url('assets/fonts/Cairo.ttf');}",
    );
    expect(r.fonts).toEqual([
      { from: "/studio/brand/fonts/Cairo.ttf", to: "assets/fonts/Cairo.ttf" },
    ]);
    expect(r.media).toEqual([{ from: "/p/assets/pic.JPG", to: "assets/media/pic.jpg" }]);
  });

  it("says when a transition is not built yet", async () => {
    const { buildProject } = await project();
    const video: Loose = fixtureVideo();
    video.scenes[1].transitionIn = "whip";
    const t = await timingFor(video);
    expect(buildProject({ video, timing: t }).notes).toEqual([
      'scene rules: transition "whip" is not built yet; used cut',
    ]);
  });
});

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
        "copy",
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

  it("only remuxes when there is no audio, and scales a draft", async () => {
    const { muxArgs } = await render();
    const plain = muxArgs({ silent: "/s.mp4", out: "/o.mp4", seconds: 3, voice: [], music: null });
    expect(plain).not.toContain("-filter_complex");
    expect(plain).not.toContain("-c:a");
    const draft = muxArgs({
      silent: "/s.mp4",
      out: "/o.mp4",
      seconds: 3,
      voice: [],
      music: null,
      draft: true,
    });
    expect(draft).toEqual(expect.arrayContaining(["-vf", "scale=-2:540", "libx264"]));
  });

  it("finds HyperFrames in the project, the global prefix and the npx cache, and reads its bin", async () => {
    const { findHyperframes, candidateDirs } = await render();
    const dirs = candidateDirs({
      dir: "/a/b/c",
      execPath: "/opt/node/bin/node",
      home: "/home/u",
      list: () => ["abc123"],
    });
    expect(dirs[0]).toBe("/a/b/c/node_modules/hyperframes");
    expect(dirs).toContain("/opt/node/lib/node_modules/hyperframes");
    expect(dirs.at(-1)).toBe("/home/u/.npm/_npx/abc123/node_modules/hyperframes");
    const fs = {
      exists: (f: string) => f.startsWith("/opt/node/lib/node_modules/hyperframes"),
      readJson: () => ({
        name: "hyperframes",
        version: "0.8.226",
        bin: { hyperframes: "dist/cli.js" },
      }),
    };
    const hit = findHyperframes(
      { dir: "/a/b/c", execPath: "/opt/node/bin/node", home: "/h", list: () => [] },
      fs,
    );
    expect(hit).toEqual({
      bin: "/opt/node/lib/node_modules/hyperframes/dist/cli.js",
      version: "0.8.226",
    });
    expect(
      findHyperframes(
        { dir: "/a", execPath: "/n/bin/node", home: "/h", list: () => [] },
        { exists: () => false, readJson },
      ),
    ).toBeNull();
    function readJson() {
      return {};
    }
  });

  it("ignores a package that is not HyperFrames", async () => {
    const { binOf } = await render();
    expect(
      binOf("/x", { exists: () => true, readJson: () => ({ name: "other", bin: "a.js" }) }),
    ).toBeNull();
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

  it("refuses to render when the project does not check out, or HyperFrames is missing", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-render-"));
    writeFileSync(path.join(dir, "video.json"), JSON.stringify({ version: 1 }));
    const r = spawnSync("node", [skillFile("video-core", "scripts/render.mjs"), dir], {
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/problem\(s\)/);
    const none = spawnSync(
      "node",
      [skillFile("video-core", "scripts/render.mjs"), dir, "--engine", "remotion"],
      { encoding: "utf8" },
    );
    expect(none.status).toBe(2);
  });
});

// The real thing: needs ffmpeg and an installed HyperFrames, so it is skipped on machines without them.
const have = (() => {
  const ff = spawnSync("ffmpeg", ["-version"]).status === 0;
  if (!ff) return false;
  const script = skillFile("video-core", "scripts/render.mjs");
  const probe = spawnSync("node", [
    "-e",
    `import(${JSON.stringify("file://" + script)}).then(m=>process.exit(m.findHyperframes({dir:process.cwd()})?0:1))`,
  ]);
  return probe.status === 0;
})();

describe.skipIf(!have)("video-core render end to end", () => {
  it("renders a 3-scene fixture twice with identical bytes", { timeout: 240_000 }, () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-e2e-"));
    mkdirSync(path.join(dir, "voice"));
    writeFileSync(path.join(dir, "voice", "l1.wav"), wav(1.2));
    writeFileSync(path.join(dir, "script.md"), "[l1] Rate limiting protects a service.\n");
    writeFileSync(path.join(dir, "video.json"), JSON.stringify(fixtureVideo()));
    const script = skillFile("video-core", "scripts/render.mjs");
    const hash = () => {
      const r = spawnSync("node", [script, dir], { encoding: "utf8" });
      expect(r.stderr).toBe("");
      expect(r.status).toBe(0);
      return createHash("sha256")
        .update(readFileSync(path.join(dir, "out", `${path.basename(dir)}.mp4`)))
        .digest("hex");
    };
    spawnSync("node", [skillFile("video-core", "scripts/timing.mjs"), dir]);
    const a = hash();
    expect(hash()).toBe(a);
    const probe = spawnSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_name,width,height,nb_frames",
        "-of",
        "csv=p=0",
        path.join(dir, "out", `${path.basename(dir)}.mp4`),
      ],
      { encoding: "utf8" },
    );
    expect(probe.stdout).toMatch(/h264,1080,1920/);
  });
});

// ---- captions layer ----

type Cap = {
  renderCaptions: (o: Loose) => { css: string; html: string; plan: Loose[] };
  captionProblem: (c: Loose, fps: number, total: number) => string | null;
};
const capEngine = () => loadScript<Cap>("video-core", "assets/engine/hyperframes/captions.mjs");
const brand = { colors: { bg: "#0F1115", fg: "#F5F5F2", accent: "#FF5A1F", muted: "#A3A9B0" } };
const captions = (over: Loose = {}): Loose => ({
  version: 1,
  fps: 30,
  dir: "ltr",
  style: {
    name: "karaoke",
    size: 0.05,
    weight: 800,
    highlight: "word",
    wordIn: "none",
    lineIn: "fade",
    background: "none",
    stroke: 0.07,
  },
  safeZone: { name: "reel", bottom: 0.22, side: 0.08 },
  groups: [
    {
      id: "c1",
      start: 0.5,
      end: 1.6,
      words: [
        { text: "Hello", start: 0.5, end: 0.9 },
        { text: "world", start: 1, end: 1.4 },
      ],
    },
    {
      id: "c2",
      start: 1.8,
      end: 2.9,
      words: [
        { text: "Again", start: 1.8, end: 2.2 },
        { text: "now", start: 2.3, end: 2.7 },
      ],
    },
  ],
  ...over,
});

describe("video-core caption layer", () => {
  it("makes one timed clip per caption with whole words as text and the safe zone in the css", async () => {
    const { renderCaptions } = await capEngine();
    const r = renderCaptions({ captions: captions(), brand, size: [1080, 1920] });
    expect(r.html.match(/class="clip cap-group"/g)).toHaveLength(2);
    expect(r.html).toContain(
      'id="cap-c1" class="clip cap-group" data-start="0.5" data-duration="1.1"',
    );
    expect(r.html).toContain(
      '<span id="cap-c1-w0" class="cap-w">Hello</span> <span id="cap-c1-w1" class="cap-w">world</span>',
    );
    expect(r.css).toContain("bottom:422px"); // 22% of 1920
    expect(r.css).toContain("inset-inline:86px"); // 8% of 1080
    expect(r.css).toContain("font-size:96px"); // 5% of 1920
  });

  it("animates the spoken word for karaoke, pops words for pop, and fades the line when asked", async () => {
    const { renderCaptions } = await capEngine();
    const k = renderCaptions({ captions: captions(), brand, size: [1080, 1920] }).plan;
    expect(k.filter((p) => p.id.includes("-w"))).toHaveLength(4);
    expect(k[0]).toMatchObject({ id: "cap-c1-w0", at: 0.5 });
    expect(k[0]!.frames.map((f: Loose) => f.color)).toEqual([
      "#F5F5F2",
      "#FF5A1F",
      "#FF5A1F",
      "#F5F5F2",
    ]);
    expect(k.filter((p) => p.id.endsWith("-l"))).toHaveLength(2);
    const popStyle = { ...captions().style, highlight: "none", wordIn: "pop", lineIn: "none" };
    const p = renderCaptions({
      captions: captions({ style: popStyle }),
      brand,
      size: [1080, 1920],
    }).plan;
    expect(p).toHaveLength(4);
    expect(p[0]!.frames[0]).toEqual({ opacity: 0, transform: "scale(0.6)" });
    const cleanStyle = {
      ...captions().style,
      highlight: "none",
      wordIn: "none",
      lineIn: "fade",
      background: "panel",
      stroke: 0,
    };
    const c = renderCaptions({
      captions: captions({ style: cleanStyle }),
      brand,
      size: [1080, 1920],
    });
    expect(c.css).toContain("color-mix(in srgb, #0F1115 78%, transparent)");
    expect(c.css).not.toContain("text-shadow");
  });

  it("shows hostile words as text and ignores unsafe colours", async () => {
    const { renderCaptions } = await capEngine();
    const evil = captions();
    evil.groups[0].words[0].text = "<img src=x onerror=alert(1)>";
    const bad = {
      colors: { bg: "red;}body{display:none", fg: "url(//x)", accent: "#FF5A1F", muted: "#fff" },
    };
    const r = renderCaptions({ captions: evil, brand: bad, size: [1080, 1920] });
    expect(r.html).not.toContain("<img");
    expect(r.html).toContain("&lt;img");
    expect(r.css).not.toContain("display:none");
    expect(r.css).not.toContain("url(//x)");
  });

  it("explains why captions cannot be drawn", async () => {
    const { captionProblem } = await capEngine();
    expect(captionProblem(captions(), 30, 5)).toBeNull();
    expect(captionProblem(captions(), 25, 5)).toMatch(/30 fps, the film is 25 fps/);
    expect(captionProblem(captions(), 30, 2)).toMatch(/caption c2 does not fit the film/);
    expect(captionProblem({}, 30, 5)).toMatch(/no groups/);
  });

  it("is added to the page by buildProject, and a mismatch stops the build", async () => {
    const { buildProject } = await project();
    const video = fixtureVideo();
    const t = await timingFor(video);
    const html = buildProject({ video, timing: t, captions: captions() }).files["index.html"]!;
    expect(html).toContain('class="clip cap-group"');
    expect(html).toContain(".cap-group{position:absolute");
    expect(html.match(/<script/g)).toHaveLength(2);
    expect(() => buildProject({ video, timing: t, captions: captions({ fps: 24 }) })).toThrow(
      /Captions cannot be drawn.*captions.mjs/,
    );
    expect(buildProject({ video, timing: t }).files["index.html"]).not.toContain("cap-group");
  });

  it("keeps scenes clear of burned captions: the bottom padding covers the caption zone", async () => {
    const { buildProject } = await project();
    const video = fixtureVideo();
    const t = await timingFor(video);
    const pad = (html: string) => html.match(/\.scene\{[^}]*padding:[^;}]*? (\d+)px\}/)?.[1];
    expect(pad(buildProject({ video, timing: t }).files["index.html"]!)).toBe("173"); // 16% of the width
    const withCaps = buildProject({ video, timing: t, captions: captions() }).files["index.html"]!;
    // the fixture's captions use the 22% safe zone and 5% text on a 1920 px frame: 422.4 + 240 + 38.4
    expect(Number(pad(withCaps))).toBeGreaterThan(600);
    const { captionClearance } = await loadScript<{
      captionClearance: (c: Loose, s: number[]) => number;
    }>("video-core", "assets/engine/hyperframes/captions.mjs");
    expect(
      captionClearance({ style: { size: 0.05 }, safeZone: { bottom: 0.22 } }, [1080, 1920]),
    ).toBe(701);
  });

  it("render refuses burned captions when captions.json is missing", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-render-cap-"));
    const v = fixtureVideo({ captions: { burn: true } }) as Loose;
    v.scenes = v.scenes.slice(1); // the two fixed-length scenes, so no voice files are needed
    delete v.script;
    writeFileSync(path.join(dir, "video.json"), JSON.stringify(v));
    const r = spawnSync("node", [skillFile("video-core", "scripts/render.mjs"), dir], {
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/captions\.json is missing: run captions\.mjs/);
  });
});

describe.skipIf(!have || process.platform !== "darwin")(
  "video-core Arabic captions end to end",
  () => {
    it(
      "renders joined Arabic letters: the whole word differs from the same letters set one by one",
      { timeout: 300_000 },
      async () => {
        const { buildProject } = await project();
        const { findHyperframes } = await render();
        const hf = findHyperframes({ dir: process.cwd() })!;
        const ar = "الكتاب";
        const video: Loose = fixtureVideo();
        video.meta.lang = "ar";
        video.scenes = [
          { id: "a", kind: "title", durationFrom: "fixed", seconds: 1, props: { text: ar } },
        ];
        const t = await timingFor(video);
        const made = buildProject({ video, timing: t }).files["index.html"]!;
        const letters = [...ar]
          .map((c) => `<span style="display:inline-block">${c}</span>`)
          .join("");
        const frame = (html: string) => {
          const dir = mkdtempSync(path.join(os.tmpdir(), "video-ar-"));
          writeFileSync(path.join(dir, "index.html"), html);
          const out = path.join(dir, "o.mp4");
          const r = spawnSync("node", [hf.bin, "render", dir, "-o", out, "-q", "draft"], {
            encoding: "utf8",
          });
          expect(r.status, r.stderr).toBe(0);
          const f = spawnSync(
            "ffmpeg",
            ["-v", "error", "-y", "-ss", "0.5", "-i", out, "-frames:v", "1", "-f", "md5", "-"],
            { encoding: "utf8" },
          );
          return f.stdout.trim();
        };
        const whole = frame(made);
        const split = frame(made.replace(`>${ar}<`, `>${letters}<`));
        expect(whole).toMatch(/^MD5=/);
        expect(split).not.toBe(whole);
      },
    );
  },
);
