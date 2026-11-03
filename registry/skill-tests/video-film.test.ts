import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const rules = () => loadScript<Loose>("video-core", "assets/film/rules.mjs");
const film = () => loadScript<Loose>("video-core", "assets/film/resolve.mjs");
const sound = () => loadScript<Loose>("video-core", "assets/film/sound.mjs");
const engine = () => loadScript<Loose>("video-core", "scripts/engine.mjs");
const timing = () => loadScript<Loose>("video-core", "scripts/timing.mjs");

/** The smallest props that pass, per kind. */
const GOOD: Loose = {
  title: { text: "Hello *world*" },
  list: { items: ["One", { text: "Two", on: "second" }] },
  number: { value: 429, label: "Too many requests" },
  versus: { left: { title: "A", points: ["x"] }, right: { title: "B", points: ["y"] } },
  steps: { steps: [{ label: "One" }, { label: "Two" }] },
  code: {
    language: "ts",
    code: "const a = 1;\nconst b = 2;",
    focus: [{ lines: [2, 2], on: "two" }],
  },
  terminal: { lines: [{ text: "ls", kind: "cmd" }] },
  chart: {
    data: [
      { label: "a", value: 1 },
      { label: "b", value: 2 },
    ],
  },
  nodes: {
    nodes: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    edges: [{ from: "a", to: "b" }],
  },
  "request-flow": {
    nodes: [
      { id: "c", label: "Client", tier: "clients" },
      { id: "s", label: "API", tier: "backend" },
    ],
    edges: [{ id: "e", from: "c", to: "s" }],
    steps: [{ edge: "e", label: "GET /" }],
  },
  "rate-limit": {
    seed: 1,
    count: 20,
    pattern: { type: "steady", ratePerSec: 10 },
    algos: [{ algo: "token-bucket", capacity: 5, refillPerSec: 2 }],
  },
  sequence: { source: "A->B: hi\nB-->A: hello" },
  quote: { text: "Simple is fast.", by: "Someone" },
  broll: { asset: "pic" },
  kinetic: { text: "Ship it", emph: ["ship"] },
  screen: { asset: "rec", callouts: [{ text: "Paste a URL", at: 1 }] },
};

describe("film rules", () => {
  it("has a component for every kind and passes the smallest good props", async () => {
    const { KINDS, kindProblems } = await rules();
    const index = readFileSync(
      skillFile("video-core", "assets/remotion/src/scenes/index.ts"),
      "utf8",
    );
    for (const k of KINDS) {
      expect(index, k).toContain(k.includes("-") ? `"${k}":` : `${k}:`);
      expect(kindProblems(k, GOOD[k], 2), k).toEqual([]);
    }
    expect(Object.keys(GOOD).sort()).toEqual([...KINDS].sort());
  });

  it("names the field and the limit when props are wrong", async () => {
    const { kindProblems } = await rules();
    expect(kindProblems("title", { text: "x".repeat(91) })[0]).toMatch(/^text: 1 to 90/);
    expect(kindProblems("list", { items: [] })[0]).toMatch(/^items: 1 to 6/);
    expect(kindProblems("code", { language: "ts", code: "x".repeat(49) }).join()).toMatch(
      /48 characters/,
    );
    expect(
      kindProblems("code", { language: "ts", code: "a", focus: [{ lines: [1, 1] }] }).join(),
    ).toMatch(/give one of "line"/);
    expect(kindProblems("rate-limit", { ...GOOD["rate-limit"], allowed: 3 }).join()).toMatch(
      /computed from the seed/,
    );
    expect(
      kindProblems("sequence", { source: "A->B: 1\nB->C: 2\nC->D: 3\nD->E: 4" }).join(),
    ).toMatch(/at most 4 participants/);
    expect(kindProblems("pie", {})[0]).toMatch(/not built/);
  });
});

describe("film resolve", () => {
  it("brings items in on the words that name them, never backwards, the first one early", async () => {
    const { beats } = await film();
    const words = [
      { text: "First,", start: 0.9, end: 1.2 },
      { text: "the", start: 1.2, end: 1.3 },
      { text: "token", start: 1.3, end: 1.6 },
      { text: "bucket.", start: 1.6, end: 2 },
      { text: "Then", start: 3, end: 3.2 },
      { text: "windows.", start: 3.2, end: 3.8 },
    ];
    const at = beats(["Token bucket", "Fixed windows"], { words, seconds: 5 });
    expect(at[0]).toBeLessThanOrEqual(0.5);
    expect(at[1]).toBeCloseTo(3.2 - 0.08, 2);
    const spread = beats(["a", "b", "c"], { words: [], seconds: 6 });
    expect(spread[0]).toBeLessThan(spread[1]);
    expect(spread[1]).toBeLessThan(spread[2]);
  });

  it("groups kinetic words at punctuation into at most four, never ending on a joining word", async () => {
    const { groupWords } = await film();
    const w = (t: string) => t.split(" ").map((text, i) => ({ text, start: i, end: i + 0.5 }));
    const g = groupWords(w("Ship the ugly version on Friday."), undefined);
    expect(g.map((x: Loose[]) => x.map((y) => y.text).join(" "))).toEqual([
      "Ship the ugly",
      "version on Friday.",
    ]);
    expect(
      groupWords(w("Done beats perfect."), ["Done", "beats perfect."]).map(
        (x: Loose[]) => x.length,
      ),
    ).toEqual([1, 2]);
  });

  it("makes caption pages of up to three words, broken at punctuation and pauses", async () => {
    const { captionPages } = await film();
    const words = ["One", "two", "three", "four.", "Five"].map((text, i) => ({
      text,
      start: i * 0.3 + (i === 4 ? 1 : 0),
      end: i * 0.3 + 0.25 + (i === 4 ? 1 : 0),
    }));
    const pages = captionPages(words);
    expect(pages.map((p: Loose) => p.words.map((x: Loose) => x.text).join(" "))).toEqual([
      "One two three",
      "four.",
      "Five",
    ]);
    expect(pages[0].end).toBeLessThanOrEqual(pages[1].start + 1e-9);
  });

  it("builds a film: frames from timing, a cut first, transitions after, sound cues and no captions over kinetic", async () => {
    const { buildFilm } = await film();
    const video = {
      version: 1,
      meta: { title: "t", type: "explainer", format: "reel-9x16", fps: 30, lang: "en" },
      scenes: [
        { id: "a", kind: "title", props: GOOD.title, transitionIn: "whip" },
        { id: "b", kind: "list", props: GOOD.list },
        { id: "c", kind: "kinetic", props: { emph: ["ship"] }, transitionIn: "slash" },
      ],
    };
    const t = {
      fps: 30,
      totalFrames: 270,
      scenes: [
        {
          id: "a",
          startFrame: 0,
          frames: 90,
          start: 0,
          seconds: 3,
          lines: [{ id: "l1", start: 0, seconds: 2.5 }],
        },
        {
          id: "b",
          startFrame: 90,
          frames: 90,
          start: 3,
          seconds: 3,
          lines: [{ id: "l2", start: 0, seconds: 2.5 }],
        },
        {
          id: "c",
          startFrame: 180,
          frames: 90,
          start: 6,
          seconds: 3,
          lines: [{ id: "l3", start: 0, seconds: 2 }],
        },
      ],
    };
    const w = (text: string, s: number) =>
      text.split(" ").map((x, i) => ({ text: x, start: s + i * 0.4, end: s + i * 0.4 + 0.35 }));
    const out = buildFilm({
      video,
      timing: t,
      words: [w("Hello world", 0.1), w("One then second", 0.1), w("Ship it now", 0.1)],
    });
    expect(out.film.width).toBe(1080);
    expect(out.film.height).toBe(1920);
    expect(out.film.scenes[0].transition).toEqual({ type: "cut", frames: 0 });
    expect(out.film.scenes[1].transition.type).toBe("slide");
    expect(out.film.scenes[2].transition).toEqual({ type: "slash", frames: 12 });
    expect(out.film.scenes[2].props.phrases.length).toBeGreaterThan(0);
    const kineticStart = (180 - 12) / 30;
    for (const p of out.film.captions) expect(p.end).toBeLessThanOrEqual(kineticStart + 1e-9);
    expect(out.cues.map((c: Loose) => c.name)).toEqual(
      expect.arrayContaining(["impact", "whoosh", "pop"]),
    );
    for (let i = 1; i < out.cues.length; i++)
      expect(out.cues[i].at - out.cues[i - 1].at).toBeGreaterThanOrEqual(0.25);
    expect(out.film.theme.accent).toBe("#c6ff1a");
    expect(
      buildFilm({ video, timing: t, words: [], brand: { colors: { accent: "#ff0000" } } }).film
        .theme.accent,
    ).toBe("#ff0000");
    expect(
      buildFilm({ video, timing: t, words: [], brand: { colors: { accent: "red" } } }).film.theme
        .accent,
    ).toBe("#c6ff1a");
  });

  it("runs the real rate-limit simulation and maps it into the scene", async () => {
    const { resolveScene } = await film();
    const p = resolveScene(
      { kind: "rate-limit", props: GOOD["rate-limit"] },
      { seconds: 6, words: [], lineStarts: [], beatCtx: { words: [], lines: [], seconds: 6 } },
      {},
    );
    const ev = p.runs[0].events;
    expect(ev).toHaveLength(20);
    expect(p.runs[0].allowed + p.runs[0].rejected).toBe(20);
    for (const e of ev) expect(e.t).toBeGreaterThanOrEqual(0.5);
    expect(ev.at(-1).t).toBeLessThanOrEqual(6);
  });
});

describe("film sound", () => {
  it("synthesises the same bytes for the same call, and a bed as long as asked", async () => {
    const { synth, bed, wav } = await sound();
    expect(Buffer.compare(wav(synth("pop")), wav(synth("pop")))).toBe(0);
    const b = bed({ seconds: 2 });
    expect(b.length).toBe(96000);
    expect(Buffer.compare(wav(b), wav(bed({ seconds: 2 })))).toBe(0);
    expect(() => bed({ seconds: 0 })).toThrow();
  });
});

describe("engine", () => {
  it("pins one Remotion version for every @remotion package", () => {
    const pj = JSON.parse(
      readFileSync(skillFile("video-core", "assets/remotion/package.json"), "utf8"),
    );
    const v = pj.dependencies.remotion;
    expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    for (const [k, x] of Object.entries(pj.dependencies))
      if (k.startsWith("@remotion/")) expect(x, k).toBe(v);
  });

  it("is frame-exact: no CSS animations, no clocks, no randomness, no GSAP in the engine source", () => {
    const root = skillFile("video-core", "assets/remotion/src");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true }))
        if (e.isDirectory()) walk(path.join(d, e.name));
        else files.push(path.join(d, e.name));
    };
    walk(root);
    expect(files.length).toBeGreaterThan(8);
    for (const f of files) {
      const t = readFileSync(f, "utf8");
      expect(t, f).not.toMatch(
        /@keyframes|transition:\s*["'`]|Math\.random|Date\.now|gsap|fetch\(/,
      );
    }
  });

  it("reports a missing engine and copies its source on sync", async () => {
    const { engineStatus, syncSource } = await engine();
    const dir = mkdtempSync(path.join(os.tmpdir(), "engine-"));
    const s = engineStatus(dir);
    expect(s.ok).toBe(false);
    expect(s.problems[0]).toMatch(/not installed/);
    syncSource(dir);
    expect(readdirSync(path.join(dir, "src"))).toEqual(
      expect.arrayContaining(["index.ts", "Film.tsx", "Root.tsx"]),
    );
    mkdirSync(path.join(dir, "src", "old"), { recursive: true });
    writeFileSync(path.join(dir, "src", "old", "x.ts"), "x");
    syncSource(dir);
    expect(readdirSync(path.join(dir, "src"))).not.toContain("old");
  });
});

describe("timing for a fixed scene with narration at set times", () => {
  it("starts each line where asked, never overlapping, and grows the scene to fit", async () => {
    const { buildTiming } = await timing();
    const video = {
      meta: { fps: 30 },
      scenes: [
        {
          id: "demo",
          kind: "screen",
          durationFrom: "fixed",
          seconds: 4,
          narration: ["a", "b"],
          narrationAt: { a: 0.5, b: 1 },
        },
      ],
    };
    const t = buildTiming(video, () => 2, 0.3);
    expect(t.scenes[0].lines).toEqual([
      { id: "a", start: 0.5, seconds: 2 },
      { id: "b", start: 2.6, seconds: 2 },
    ]);
    expect(t.scenes[0].seconds).toBeCloseTo(4.9, 1);
  });
});
