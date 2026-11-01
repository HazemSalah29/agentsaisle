import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { writerFiles } from "./video-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type W = { text: string; start: number; end: number };
type Caps = {
  evenSizes: (n: number, max: number) => number[];
  groupWords: (w: W[], max?: number) => W[][];
  resolveStyle: (o: Loose) => { style: Loose; notes: string[] };
  buildCaptions: (o: Loose) => { captions: Loose; notes: string[]; skipped: string[] };
  loadStyles: () => Loose;
  toSrt: (c: Loose) => string;
  toVtt: (c: Loose) => string;
};
const load = () => loadScript<Caps>("video-captions", "scripts/captions.mjs");

/** Words of a sentence spaced 0.3 s apart, each 0.25 s long. */
const words = (text: string, at = 0, gap = 0.3): W[] =>
  text.split(" ").map((t, i) => ({
    text: t,
    start: Math.round((at + i * gap) * 1000) / 1000,
    end: Math.round((at + i * gap + 0.25) * 1000) / 1000,
  }));
const sizes = (g: W[][]) => g.map((x) => x.length);

describe("video-captions grouping", () => {
  it("cuts n words into even groups of at most max", async () => {
    const { evenSizes } = await load();
    expect([
      evenSizes(5, 4),
      evenSizes(4, 4),
      evenSizes(9, 4),
      evenSizes(1, 4),
      evenSizes(7, 3),
    ]).toEqual([[3, 2], [4], [3, 3, 3], [1], [3, 2, 2]]);
  });

  it("breaks at sentence ends and keeps groups within the limit", async () => {
    const { groupWords } = await load();
    expect(
      sizes(groupWords(words("Buckets allow bursts. They keep the average fixed."), 4)),
    ).toEqual([3, 3, 2]);
    expect(sizes(groupWords(words("one two three four five six seven eight"), 4))).toEqual([4, 4]);
  });

  it("breaks at a long pause but not at a short one", async () => {
    const { groupWords } = await load();
    const a = [...words("one two three", 0), ...words("four five six", 2.0)];
    expect(sizes(groupWords(a, 6))).toEqual([3, 3]);
    expect(sizes(groupWords(words("one two three four five six", 0), 6))).toEqual([6]);
  });

  it("never leaves one word alone: a one-word sentence joins its neighbour", async () => {
    const { groupWords } = await load();
    expect(sizes(groupWords(words("Stop. Think carefully now."), 4))).toEqual([4]);
    expect(sizes(groupWords(words("Think carefully now. Go."), 4))).toEqual([4]);
    expect(sizes(groupWords(words("Wait."), 4))).toEqual([1]); // a line of one word cannot do better
    expect(groupWords([], 4)).toEqual([]);
  });

  it("never makes an orphan or an oversize group, for every length and limit", async () => {
    const { groupWords } = await load();
    for (let max = 2; max <= 6; max++)
      for (let n = 2; n <= 24; n++) {
        const text = Array.from({ length: n }, (_, i) =>
          i % 5 === 4 ? `w${i}.` : i % 7 === 6 ? `w${i},` : `w${i}`,
        ).join(" ");
        const g = groupWords(words(text), max);
        expect(
          sizes(g).every((s) => s >= 2 && s <= Math.max(max, 3)),
          `n=${n} max=${max} sizes=${sizes(g)}`,
        ).toBe(true);
        expect(
          g
            .flat()
            .map((w) => w.text)
            .join(" "),
        ).toBe(text);
      }
  });

  it("keeps Arabic words whole and in reading order", async () => {
    const { groupWords } = await load();
    const g = groupWords(words("الكتاب جميل جدا ويفيد كثيرا"), 3);
    expect(g.map((x) => x.map((w) => w.text).join(" "))).toEqual([
      "الكتاب جميل جدا",
      "ويفيد كثيرا",
    ]);
  });
});

describe("video-captions style", () => {
  it("applies style, then brand, then video.json overrides", async () => {
    const { resolveStyle, loadStyles } = await load();
    const styles = loadStyles();
    const r = resolveStyle({
      styles,
      name: "karaoke",
      brand: { captions: { size: 0.06, weight: 600 } },
      overrides: { weight: 900 },
      format: "reel-9x16",
    });
    expect(r.style).toMatchObject({ name: "karaoke", highlight: "word", size: 0.06, weight: 900 });
    expect(r.notes).toEqual([]);
  });

  it("raises a caption that is too small on 9:16 but leaves 16:9 alone", async () => {
    const { resolveStyle, loadStyles } = await load();
    const styles = loadStyles();
    const small = resolveStyle({
      styles,
      name: "clean",
      overrides: { size: 0.03 },
      format: "reel-9x16",
    });
    expect(small.style.size).toBe(styles.minSizeVertical);
    expect(small.notes[0]).toMatch(/below 0.045.*raised/);
    expect(
      resolveStyle({ styles, name: "clean", overrides: { size: 0.03 }, format: "youtube-16x9" })
        .style.size,
    ).toBe(0.03);
  });

  it("refuses an unknown style", async () => {
    const { resolveStyle, loadStyles } = await load();
    expect(() => resolveStyle({ styles: loadStyles(), name: "neon", format: "reel-9x16" })).toThrow(
      /Unknown caption style "neon"/,
    );
  });

  it("ships three styles, each with a safe zone for every platform", async () => {
    const { loadStyles } = await load();
    const s = loadStyles();
    for (const name of ["karaoke", "pop", "clean"]) expect(s[name].description).toBeTruthy();
    expect(Object.keys(s.safeZones).sort()).toEqual(["none", "reel", "short", "youtube"]);
  });
});

describe("video-captions build", () => {
  const video = (over: Loose = {}): Loose => ({
    meta: { title: "t", type: "explainer", format: "reel-9x16", fps: 30, lang: "en" },
    scenes: [
      { id: "a", kind: "title", narration: ["l1"] },
      { id: "b", kind: "title", narration: ["l2"], captions: "off" },
      { id: "c", kind: "title", narration: ["l3", "l4"] },
    ],
    ...over,
  });
  const timing = {
    fps: 30,
    scenes: [
      { id: "a", start: 0, seconds: 2, lines: [{ id: "l1", start: 0.1, seconds: 1.5 }] },
      { id: "b", start: 2, seconds: 2, lines: [{ id: "l2", start: 0, seconds: 1 }] },
      {
        id: "c",
        start: 4,
        seconds: 3,
        lines: [
          { id: "l3", start: 0, seconds: 1 },
          { id: "l4", start: 1, seconds: 1 },
        ],
      },
    ],
  };
  const wl = (id: string, text: string) => ({ id, seconds: 1, words: words(text, 0, 0.2) });
  const wordsJson = (approx = false) => ({
    approximate: approx,
    lines: [
      wl("l1", "Hello there my friend"),
      wl("l2", "hidden words here"),
      wl("l3", "Second line"),
      wl("l4", "Third line here"),
    ],
  });

  it("places words at scene start + line start + word time, and skips scenes with captions off", async () => {
    const { buildCaptions, loadStyles } = await load();
    const { captions } = buildCaptions({
      video: video(),
      words: wordsJson(),
      timing,
      styles: loadStyles(),
      brand: {},
    });
    expect(captions.groups.map((g: Loose) => g.id)).toEqual(["c1", "c2", "c3"]);
    expect(captions.groups[0].words.map((w: Loose) => w.start)).toEqual([0.1, 0.3, 0.5, 0.7]);
    expect(captions.groups[1].words[0].start).toBe(4);
    expect(captions.groups[2].words[0].start).toBe(5);
    expect(JSON.stringify(captions)).not.toContain("hidden");
    expect(captions).toMatchObject({
      dir: "ltr",
      approximate: false,
      style: { name: "karaoke" },
      safeZone: { name: "reel", bottom: 0.22 },
    });
  });

  it("ends each caption after its last word, before the next one starts and inside its scene", async () => {
    const { buildCaptions, loadStyles } = await load();
    const g = buildCaptions({
      video: video(),
      words: wordsJson(),
      timing,
      styles: loadStyles(),
      brand: {},
    }).captions.groups;
    expect(g[0].end).toBeCloseTo(0.1 + 3 * 0.2 + 0.25 + 0.2, 2);
    expect(g[1].end).toBeLessThanOrEqual(g[2].start);
    for (const x of g) expect(x.end).toBeGreaterThan(x.start);
  });

  it("carries the approximate flag, rtl for Arabic and the youtube safe zone for 16:9", async () => {
    const { buildCaptions, loadStyles } = await load();
    const v = video();
    v.meta.lang = "ar";
    v.meta.format = "youtube-16x9";
    const { captions } = buildCaptions({
      video: v,
      words: wordsJson(true),
      timing,
      styles: loadStyles(),
      brand: {},
    });
    expect(captions).toMatchObject({
      approximate: true,
      dir: "rtl",
      safeZone: { name: "youtube" },
    });
  });

  it("reports lines that have no word times", async () => {
    const { buildCaptions, loadStyles } = await load();
    const w = wordsJson();
    w.lines = w.lines.filter((l) => l.id !== "l4");
    expect(
      buildCaptions({ video: video(), words: w, timing, styles: loadStyles(), brand: {} }).skipped,
    ).toEqual(["l4"]);
  });

  it("takes style and size from brand.json and the captions block", async () => {
    const { buildCaptions, loadStyles } = await load();
    const brand = { captions: { style: "pop", maxWordsPerLine: 2 } };
    const a = buildCaptions({
      video: video(),
      words: wordsJson(),
      timing,
      styles: loadStyles(),
      brand,
    }).captions;
    expect(a.style.name).toBe("pop");
    expect(a.maxWordsPerLine).toBe(2);
    const b = buildCaptions({
      video: video({ captions: { style: "clean", maxWordsPerLine: 3 } }),
      words: wordsJson(),
      timing,
      styles: loadStyles(),
      brand,
    }).captions;
    expect(b.style.name).toBe("clean");
    expect(b.groups.every((g: Loose) => g.words.length <= 3)).toBe(true);
  });
});

describe("video-captions files", () => {
  const caps = {
    groups: [
      {
        id: "c1",
        start: 0.1,
        end: 1.25,
        words: [
          { text: "Hello", start: 0.1, end: 0.4 },
          { text: "there", start: 0.5, end: 0.9 },
        ],
      },
      {
        id: "c2",
        start: 3725.5,
        end: 3727,
        words: [
          { text: "a --> b", start: 3725.5, end: 3726 },
          { text: "<i>&", start: 3726, end: 3727 },
        ],
      },
    ],
  };

  it("writes SubRip with comma timestamps and numbered cues", async () => {
    const { toSrt } = await load();
    expect(toSrt(caps)).toBe(
      "1\n00:00:00,100 --> 00:00:01,250\nHello there\n\n2\n01:02:05,500 --> 01:02:07,000\na → b <i>&\n",
    );
  });

  it("writes WebVTT with dot timestamps and escaped markup", async () => {
    const { toVtt } = await load();
    expect(toVtt(caps)).toBe(
      "WEBVTT\n\nc1\n00:00:00.100 --> 00:00:01.250\nHello there\n\nc2\n01:02:05.500 --> 01:02:07.000\na → b &lt;i>&amp;\n",
    );
  });
});

describe("video-captions pipeline", () => {
  it("goes from the writer's files to captions that video-core accepts", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-caps-"));
    const f = writerFiles();
    for (const [k, v] of Object.entries({
      "brief.json": f.brief,
      "script.md": f.script,
      "facts.md": f.facts,
      "storyboard.md": f.storyboard,
      "hooks.md": f.hooks,
    }))
      writeFileSync(path.join(dir, k), v);
    const step = (skill: string, script: string, ...a: string[]) => {
      const r = spawnSync("node", [skillFile(skill, `scripts/${script}`), dir, ...a], {
        encoding: "utf8",
        env: { ...process.env, HOME: mkdtempSync(path.join(os.tmpdir(), "home-")) },
      });
      expect(r.status, `${script}: ${r.stderr}${r.stdout}`).toBe(0);
      return r;
    };
    step("video-write", "storyboard.mjs");
    step("video-voice", "voice.mjs", "--provider", "test");
    step("video-core", "timing.mjs");
    step("video-voice", "align.mjs", "--engine", "estimate");
    const r = step("video-captions", "captions.mjs", "--style", "pop");
    expect(r.stdout).toMatch(/ESTIMATED/);
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(41);
    const c = JSON.parse(readFileSync(path.join(dir, "captions.json"), "utf8"));
    expect(c.style.name).toBe("pop");
    expect(c.groups.length).toBeGreaterThan(4);
    expect(c.groups.every((g: Loose) => g.words.length >= 2)).toBe(true);
    expect(readFileSync(path.join(dir, "captions.srt"), "utf8")).toMatch(/^1\n00:00:00,000 --> /);
    expect(readFileSync(path.join(dir, "captions.vtt"), "utf8")).toMatch(/^WEBVTT/);
    const video = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
    expect(video.captions).toMatchObject({ style: "pop", burn: true, safeZone: "reel" });
    const { checkProject } = await loadScript<{
      checkProject: (v: unknown, d: string) => string[];
    }>("video-core", "scripts/check.mjs");
    expect(checkProject(video, dir)).toEqual([]);
    step("video-captions", "captions.mjs", "--srt");
    expect(JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8")).captions.burn).toBe(
      false,
    );
  });

  it("rejects bad options and missing inputs", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-caps-"));
    const run = (...a: string[]) =>
      spawnSync("node", [skillFile("video-captions", "scripts/captions.mjs"), ...a], {
        encoding: "utf8",
      });
    expect(run().status).toBe(2);
    expect(run(dir, "--burn", "--srt").status).toBe(2);
    expect(run(dir).stderr).toMatch(/Missing video\.json/);
    expect(run(dir, "--style", "neon").status).toBe(2);
    expect(run(dir, "--max-words", "1").status).toBe(2);
  });
});
