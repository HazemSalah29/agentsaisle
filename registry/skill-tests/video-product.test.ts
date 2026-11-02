import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const PY = path.join(os.homedir(), ".aisle-video", "venv", "bin", "python");
const haveCv = existsSync(PY) && spawnSync(PY, ["-c", "import cv2,numpy"]).status === 0;
const plan = () => loadScript<Loose>("video-product", "scripts/_plan.mjs");
const synth = () => loadScript<Loose>("video-product", "scripts/_synth.mjs");
const shot = () => loadScript<Loose>("video-core", "assets/engine/hyperframes/shot.mjs");
const presets = () =>
  JSON.parse(readFileSync(skillFile("video-product", "assets/presets.json"), "utf8")) as Loose;
const same = (a: [string, string], b: [string, string]) =>
  expect(readFileSync(skillFile(...a), "utf8")).toBe(readFileSync(skillFile(...b), "utf8"));
const input = (o: Loose = {}) => ({
  product: "Ember Blend",
  lines: ["Roasted slow", "Small batch"],
  cta: "Shop now",
  price: "$18",
  photos: [
    { id: "p1", layers: "cutout" },
    { id: "p2", layers: "photo" },
  ],
  preset: "snap",
  seconds: 15,
  bpm: 120,
  ...o,
});

describe("video-product copies", () => {
  it("keeps byte-identical copies", () => {
    same(["video-product", "scripts/_lib.mjs"], ["video-core", "scripts/_lib.mjs"]);
    same(["video-product", "scripts/run.mjs"], ["video-kids", "scripts/run.mjs"]);
    same(["video-product", "scripts/_beats.mjs"], ["video-showcase", "scripts/_beats.mjs"]);
  });
});

describe("sound effects", () => {
  it("are original, repeatable, at a safe level and valid WAV files", async () => {
    const { NAMES, synth: make, wav, peakDb, RATE } = await synth();
    for (const n of NAMES) {
      const a = make(n);
      const b = make(n);
      expect(Buffer.from(wav(a)).equals(Buffer.from(wav(b))), n).toBe(true);
      expect(peakDb(a), n).toBeLessThanOrEqual(-2.5);
      expect(peakDb(a), n).toBeGreaterThan(-8);
      expect(a.length / RATE, n).toBeGreaterThan(0.05);
      expect(Math.abs(a[0]!)).toBeLessThan(400); // faded in, so no click
      expect(Math.abs(a.at(-1)!)).toBeLessThan(400);
      const buf = wav(a);
      expect(buf.toString("latin1", 0, 4)).toBe("RIFF");
      expect(buf.toString("latin1", 8, 12)).toBe("WAVE");
      expect(buf.readUInt32LE(40)).toBe(a.length * 2);
    }
    expect(
      Buffer.from(wav(make("whoosh", { seed: 1 }))).equals(
        Buffer.from(wav(make("whoosh", { seed: 2 }))),
      ),
    ).toBe(false);
    expect(() => make("scream")).toThrow("Unknown effect");
    expect(() => make("tick", { seconds: 30 })).toThrow("seconds");
  });
  it("sfx.mjs writes them, keeps existing files and refuses unknown names", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "vp-sfx-"));
    const run = (...a: string[]) =>
      spawnSync(process.execPath, [skillFile("video-product", "scripts/sfx.mjs"), ...a], {
        encoding: "utf8",
      });
    expect(run("--out", dir, "--names", "tick,impact").status).toBe(0);
    expect(existsSync(path.join(dir, "tick.wav"))).toBe(true);
    expect(run("--out", dir, "--names", "tick").stdout).toContain("kept tick.wav");
    expect(run("--out", dir, "--names", "scream").status).toBe(2);
  });
});

describe("planEdit", () => {
  it("makes shots that the scene kind accepts, that add up to the length, with only the user's words", async () => {
    const { planEdit } = await plan();
    const { shotProblems } = await shot();
    for (const name of Object.keys(presets())) {
      const r = planEdit(input({ preset: name }), presets());
      const total = r.video.scenes.reduce((t: number, s: Loose) => t + s.seconds, 0);
      expect(Math.abs(total - 15), name).toBeLessThan(0.06);
      for (const s of r.video.scenes) {
        expect(shotProblems(s.props, s.seconds), `${name} ${s.id}`).toEqual([]);
        expect(s.seconds).toBeGreaterThanOrEqual(presets()[name].minShot - 0.001);
      }
      const words = JSON.stringify(r.video.scenes.map((s: Loose) => s.props.type));
      for (const w of ["Ember Blend", "Shop now", "$18", "Roasted slow"])
        expect(words, name).toContain(w);
      expect(words).not.toMatch(/best|#1|%|free|new/i);
      expect(r.video.scenes[0].props.type[0].at).toBeLessThan(0.5); // the hook shows the product at once
      expect(r.video.scenes.at(-1).props.type.some((t: Loose) => t.text === "$18")).toBe(true);
    }
  });
  it("keeps flashes apart across the whole film and sound cues inside it", async () => {
    const { planEdit } = await plan();
    for (const name of Object.keys(presets())) {
      const r = planEdit(input({ preset: name }), presets());
      const flashes: number[] = [];
      let t = 0;
      for (const s of r.video.scenes) {
        if (s.props.enter.style === "flash") flashes.push(t);
        for (const f of s.props.fx.flash ?? []) flashes.push(t + f);
        t += s.seconds;
      }
      flashes.sort((a, b) => a - b);
      flashes.forEach(
        (f, i) =>
          i && expect(f - flashes[i - 1]!, `${name} flash gap`).toBeGreaterThanOrEqual(0.89),
      );
      for (const x of r.video.sfx) {
        expect(x.at).toBeGreaterThanOrEqual(0);
        expect(x.at).toBeLessThan(15);
        expect(x.file).toMatch(/^audio\/[a-z]+\.wav$/);
        expect(x.gainDb).toBeLessThanOrEqual(-4);
      }
      expect(r.video.sfx.length).toBeLessThanOrEqual(80);
    }
  });
  it("snaps cuts to beats without changing the length, and uses a recipe's numbers only within the preset's range", async () => {
    const { planEdit, shotLengths, gridFromBpm } = await plan();
    const p = presets().snap;
    const plain = shotLengths({ preset: p, seconds: 15 });
    const beats = gridFromBpm(100, 15);
    const snapped = shotLengths({ preset: p, seconds: 15, beats });
    expect(snapped.reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(15, 1);
    expect(snapped).not.toEqual(plain);
    expect(snapped[0]).toBe(plain[0]); // the hook and the call to action keep their length
    expect(snapped.at(-1)).toBe(plain.at(-1));
    const slow = shotLengths({
      preset: p,
      seconds: 15,
      recipe: { averageShotSeconds: 9, hookSeconds: 4 },
    });
    expect(slow[0]).toBeLessThanOrEqual(2.5);
    expect(Math.max(...slow.slice(1, -1))).toBeLessThanOrEqual(p.shot[1] * 1.6);
    const r = planEdit(input({ bpm: undefined, beats: undefined }), presets());
    expect(r.summary.snapped).toBe(false);
  });
  it("refuses bad input and makes an accent that white text can sit on", async () => {
    const { planEdit, inputProblems, readableAccent } = await plan();
    expect(inputProblems(input({ product: "" }), presets())[0]).toContain("product");
    expect(inputProblems(input({ lines: ["a", "b", "c", "d"] }), presets())[0]).toContain("lines");
    expect(inputProblems(input({ preset: "wild" }), presets())[0]).toContain("preset");
    expect(inputProblems(input({ seconds: 99 }), presets())[0]).toContain("seconds");
    expect(inputProblems(input({ accent: "red" }), presets())[0]).toContain("accent");
    expect(inputProblems(input({ photos: [] }), presets())[0]).toContain("photos");
    expect(() => planEdit(input({ cta: "x".repeat(40) }), presets())).toThrow("cta");
    const lum = (h: string) => {
      const v = [1, 3, 5]
        .map((k) => parseInt(h.slice(k, k + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!;
    };
    for (const hex of ["#ffee00", "#f0f0f0", "#e8542a", "#003366"])
      expect(1.05 / (lum(readableAccent(hex)) + 0.05)).toBeGreaterThanOrEqual(3);
  });
  it("uses one layer for a photo without a cutout and two layers with one", async () => {
    const { planEdit } = await plan();
    const r = planEdit(
      input({
        photos: [
          { id: "p1", layers: "cutout" },
          { id: "p2", layers: "photo" },
        ],
      }),
      presets(),
    );
    const layerCounts = r.video.scenes.map((s: Loose) => s.props.layers.length);
    expect(layerCounts[0]).toBe(2); // hook uses the first photo, which has a cutout
    expect(layerCounts).toContain(1);
  });
});

describe.skipIf(!haveCv)("cutout and plan.mjs (needs OpenCV in the video venv)", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "vp-"));
  const photo = (kind: string) => {
    const out = path.join(dir, `${kind}.jpg`);
    expect(
      spawnSync(PY, [path.join(__dirname, "fixtures", "make-product.py"), kind, out]).status,
    ).toBe(0);
    return out;
  };
  const node = (script: string, args: string[]) =>
    spawnSync(process.execPath, [skillFile("video-product", `scripts/${script}`), ...args], {
      encoding: "utf8",
      env: { ...process.env, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
    });

  it("cuts a product out of a plain photo and fills the background behind it", () => {
    const out = path.join(dir, "cut");
    const r = node("cutout.mjs", [photo("plain"), "--out", out]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("cutout ok");
    const report = JSON.parse(readFileSync(path.join(out, "cutout.json"), "utf8")) as Loose;
    expect(report.ok).toBe(true);
    expect(report.foregroundShare).toBeGreaterThan(0.1);
    expect(report.foregroundShare).toBeLessThan(0.4);
    expect(report.accent).toMatch(/^#[0-9a-f]{6}$/);
    for (const f of ["subject.png", "bg.jpg", "preview.png"])
      expect(existsSync(path.join(out, f))).toBe(true);
    expect(readFileSync(path.join(out, "subject.png")).subarray(1, 4).toString()).toBe("PNG");
  });
  it("refuses a flat photo, links, URLs and the wrong file types", () => {
    const flat = path.join(dir, "flat.jpg");
    spawnSync(PY, [
      "-c",
      `import cv2,numpy as np;cv2.imwrite(${JSON.stringify(flat)},np.full((300,300,3),140,np.uint8))`,
    ]);
    expect(node("cutout.mjs", [flat, "--out", path.join(dir, "flat-out")]).stderr).toContain(
      "single flat colour",
    );
    expect(node("cutout.mjs", ["https://example.com/a.jpg", "--out", dir]).stderr).toContain(
      "file on this computer",
    );
    writeFileSync(path.join(dir, "a.gif"), "GIF89a");
    expect(node("cutout.mjs", [path.join(dir, "a.gif"), "--out", dir]).stderr).toContain(
      ".png, .jpg",
    );
  });
  it("plan.mjs needs the user's confirmation, writes a valid project and never overwrites", () => {
    const proj = path.join(dir, "proj");
    const args = [
      "--project",
      proj,
      "--photos",
      photo("plain"),
      "--preset",
      "glide",
      "--product",
      "Ember Blend",
      "--lines",
      "Roasted slow",
      "--cta",
      "Shop now",
    ];
    expect(node("plan.mjs", args).stderr).toContain("--own-photos");
    const ok = node("plan.mjs", [...args, "--own-photos"]);
    expect(ok.status, ok.stderr).toBe(0);
    const video = JSON.parse(readFileSync(path.join(proj, "video.json"), "utf8")) as Loose;
    expect(video.assets.every((a: Loose) => a.source === "user" && a.licence === "own")).toBe(true);
    for (const a of video.assets) expect(existsSync(path.join(proj, a.path)), a.path).toBe(true);
    for (const s of video.sfx) expect(existsSync(path.join(proj, s.file)), s.file).toBe(true);
    const chk = spawnSync(process.execPath, [skillFile("video-core", "scripts/check.mjs"), proj], {
      encoding: "utf8",
    });
    expect(chk.stdout + chk.stderr).toContain("OK");
    expect(node("plan.mjs", [...args, "--own-photos"]).stderr).toContain("exists");
    expect(
      node("plan.mjs", [...args, "--own-photos", "--music", path.join(dir, "x.mp3")]).stderr,
    ).toContain("licence");
  });

  it("compose.mjs puts a screenshot on a card over a styled background, in the frame's size", () => {
    const shot = path.join(dir, "screen.png");
    spawnSync(PY, [
      "-c",
      `import cv2,numpy as np;cv2.imwrite(${JSON.stringify(shot)},np.full((844,390,3),(30,30,30),np.uint8))`,
    ]);
    const out = path.join(dir, "card");
    const r = node("compose.mjs", [
      shot,
      "--out",
      out,
      "--format",
      "reel-9x16",
      "--accent",
      "#ee4f12",
    ]);
    expect(r.status, r.stderr).toBe(0);
    for (const f of ["bg.jpg", "subject.png", "photo.jpg"])
      expect(existsSync(path.join(out, f)), f).toBe(true);
    const png = readFileSync(path.join(out, "subject.png"));
    expect(png.readUInt32BE(16)).toBe(1080); // width
    expect(png.readUInt32BE(20)).toBe(1920); // height
    expect(node("compose.mjs", [shot, "--out", out, "--format", "wide"]).stderr).toContain(
      "--format",
    );
    expect(node("compose.mjs", [shot, "--out", out, "--accent", "red"]).stderr).toContain(
      "--accent",
    );
  });
  it("plan.mjs --screens makes a project of cards, with type above and below them", () => {
    const shot = path.join(dir, "screen.png");
    const proj = path.join(dir, "screens-proj");
    const r = node("plan.mjs", [
      "--project",
      proj,
      "--photos",
      shot,
      "--preset",
      "snap",
      "--product",
      "Agent Aisle",
      "--lines",
      "Check a skill",
      "--cta",
      "Run an audit",
      "--screens",
      "--own-photos",
    ]);
    expect(r.status, r.stderr).toBe(0);
    const video = JSON.parse(readFileSync(path.join(proj, "video.json"), "utf8")) as Loose;
    const anchors = video.scenes.flatMap((s: Loose) => s.props.type.map((t: Loose) => t.anchor));
    expect(new Set(anchors)).toEqual(new Set(["head", "foot"]));
    expect(video.scenes[0].props.layers).toHaveLength(2);
    const chk = spawnSync(process.execPath, [skillFile("video-core", "scripts/check.mjs"), proj], {
      encoding: "utf8",
    });
    expect(chk.stdout + chk.stderr).toContain("OK");
  });
});
