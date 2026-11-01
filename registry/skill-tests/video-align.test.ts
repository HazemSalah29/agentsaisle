import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { wav } from "./video-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Align = {
  normWord: (w: string) => string;
  estimateWords: (t: string, s: number) => { text: string; start: number; end: number }[];
  parseWhisperJson: (j: Loose) => { text: string; start: number; end: number }[];
  alignToScript: (w: string[], h: Loose[], s: number) => { words: Loose[]; matched: number };
  alignLine: (o: Loose) => Loose;
  whisperArgs: (o: Loose) => string[];
  dtwPreset: (m: string) => string | null;
  speechOnset: (b: Buffer) => number;
};
const load = () => loadScript<Align>("video-voice", "scripts/align.mjs");
const heard = (...ws: [string, number, number][]) =>
  ws.map(([text, start, end]) => ({ text, start, end }));

describe("video-voice align: estimate", () => {
  it("spreads words over the audio length, in order, by letter count", async () => {
    const { estimateWords } = await load();
    const w = estimateWords("a bb cccc", 7);
    expect(w.map((x) => x.text)).toEqual(["a", "bb", "cccc"]);
    expect(w[0]!.start).toBe(0);
    expect(w.at(-1)!.end).toBe(7);
    expect(w[1]!.start).toBe(w[0]!.end);
    expect(w[2]!.end - w[2]!.start).toBeCloseTo(4, 2); // 4 of 7 letters
  });

  it("gives a word before a full stop extra time and handles empty text", async () => {
    const { estimateWords } = await load();
    const w = estimateWords("go. go", 4);
    expect(w[0]!.end - w[0]!.start).toBeGreaterThan(w[1]!.end - w[1]!.start);
    expect(estimateWords("   ", 3)).toEqual([]);
  });
});

describe("video-voice align: whisper output", () => {
  it("reads word entries in seconds, joins pieces, skips markers", async () => {
    const { parseWhisperJson } = await load();
    const json = {
      transcription: [
        { text: " [_BEG_]", offsets: { from: 0, to: 0 } },
        { text: " Hel", offsets: { from: 100, to: 300 } },
        { text: "lo", offsets: { from: 300, to: 520 } },
        { text: " (music)", offsets: { from: 520, to: 600 } },
        { text: " there.", offsets: { from: 640, to: 1100 } },
        { text: " ", offsets: { from: 1100, to: 1200 } },
      ],
    };
    expect(parseWhisperJson(json)).toEqual([
      { text: "Hello", start: 0.1, end: 0.52 },
      { text: "there.", start: 0.64, end: 1.1 },
    ]);
    expect(parseWhisperJson({})).toEqual([]);
  });

  it("builds whisper-cli arguments as plain strings with word-level splitting", async () => {
    const { whisperArgs } = await load();
    const a = whisperArgs({ model: "/m.bin", wav: "/in.wav", lang: "en", outPrefix: "/o" });
    expect(a.every((x) => typeof x === "string")).toBe(true);
    expect(a).toEqual(
      expect.arrayContaining([
        "-m",
        "/m.bin",
        "-f",
        "/in.wav",
        "-l",
        "en",
        "-ml",
        "1",
        "-oj",
        "-of",
        "/o",
      ]),
    );
  });
});

describe("video-voice align: DTW timings", () => {
  it("names the DTW preset from the model file", async () => {
    const { dtwPreset } = await load();
    const names = [
      "ggml-base.bin",
      "ggml-base.en.bin",
      "ggml-small.bin",
      "ggml-tiny.en.bin",
      "ggml-medium.bin",
      "ggml-large-v3.bin",
      "ggml-large-v3-turbo.bin",
      "ggml-base-q5_1.bin",
      "weird.bin",
    ];
    expect(names.map((n) => dtwPreset(`/models/${n}`))).toEqual([
      "base",
      "base.en",
      "small",
      "tiny.en",
      "medium",
      "large.v3",
      "large.v3.turbo",
      "base",
      null,
    ]);
  });

  it("uses DTW flags for a known model and the per-word fallback otherwise", async () => {
    const { whisperArgs } = await load();
    const dtw = whisperArgs({
      model: "/m/ggml-base.bin",
      wav: "/in.wav",
      lang: "en",
      outPrefix: "/o",
    });
    expect(dtw).toEqual(expect.arrayContaining(["-dtw", "base", "-nfa", "-ojf", "-of", "/o"]));
    expect(dtw).not.toContain("-ml");
    expect(whisperArgs({ model: "/m/x.bin", wav: "/in.wav", lang: "en", outPrefix: "/o" })).toEqual(
      expect.arrayContaining(["-ml", "1", "-sow", "-oj"]),
    );
  });

  it("ends each word at its last token's DTW time and starts it where the previous word ended", async () => {
    const { parseWhisperJson } = await load();
    const tok = (text: string, dtw: number, from = 0) => ({
      text,
      t_dtw: dtw,
      offsets: { from, to: from + 100 },
    });
    const json = {
      transcription: [
        {
          text: " It works.",
          tokens: [
            tok("[_BEG_]", -1),
            tok(" It", 38, 10),
            tok(" wor", 50),
            tok("ks", 66),
            tok(".", 70),
            tok("[_TT_100]", 70),
          ],
        },
        { text: " Next", tokens: [tok(" Next", 95)] },
      ],
    };
    expect(parseWhisperJson(json)).toEqual([
      { text: "It", start: 0.01, end: 0.38 },
      { text: "works.", start: 0.38, end: 0.7 },
      { text: "Next", start: 0.7, end: 0.95 },
    ]);
  });

  it("finds where the voice begins in a wav, and returns 0 for silence or a loud start", async () => {
    const { speechOnset } = await load();
    const rate = 16000;
    const make = (lead: number, tone: number, total = 1) => {
      const n = rate * total;
      const b = Buffer.alloc(44 + n * 2);
      b.write("RIFF", 0, "latin1");
      b.write("WAVEfmt ", 8, "latin1");
      b.writeUInt32LE(16, 16);
      b.writeUInt16LE(1, 20);
      b.writeUInt16LE(1, 22);
      b.writeUInt32LE(rate, 24);
      b.write("data", 36, "latin1");
      b.writeUInt32LE(n * 2, 40);
      for (let i = Math.round(lead * rate); i < n; i++)
        b.writeInt16LE(Math.round(Math.sin(i / 8) * tone), 44 + i * 2);
      return b;
    };
    expect(speechOnset(make(0.25, 8000))).toBeCloseTo(0.25, 1);
    expect(speechOnset(make(0, 8000))).toBe(0);
    expect(speechOnset(make(0.1, 0))).toBe(0); // nothing but silence
  });

  it("moves a first word that whisper put at zero up to where the voice starts (and does the same for estimates)", async () => {
    const { alignLine } = await load();
    const rate = 16000;
    const n = rate * 2;
    const b = Buffer.alloc(44 + n * 2);
    b.write("RIFF", 0, "latin1");
    b.write("WAVEfmt ", 8, "latin1");
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(rate, 24);
    b.write("data", 36, "latin1");
    b.writeUInt32LE(n * 2, 40);
    for (let i = Math.round(0.3 * rate); i < n; i++)
      b.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), 44 + i * 2);
    const wavFile = path.join(mkdtempSync(path.join(os.tmpdir(), "video-onset-")), "l.wav");
    writeFileSync(wavFile, b);
    const heard = {
      transcription: [
        { text: " Hello", offsets: { from: 0, to: 600 } },
        { text: " there", offsets: { from: 700, to: 1500 } },
      ],
    };
    const engine = {
      model: "/m.bin",
      run: (cmd: string, args: string[]) => {
        if (cmd === "whisper-cli")
          writeFileSync(`${args[args.indexOf("-of") + 1]}.json`, JSON.stringify(heard));
        return { status: 0, stdout: "", stderr: "" };
      },
    };
    const base = { text: "Hello there", wavFile, seconds: 2, lang: "en" };
    const w = alignLine({ ...base, engine });
    expect(w.words[0].start).toBeCloseTo(0.3, 1);
    expect(w.words[1].start).toBe(0.7);
    const e = alignLine({ ...base, engine: null });
    expect(e.words[0].start).toBeCloseTo(0.3, 1);
    expect(e.words.at(-1).end).toBe(2);
  });
});

describe("video-voice align: matching the script to what was heard", () => {
  it("takes the heard times when every word matches, ignoring case and punctuation", async () => {
    const { alignToScript } = await load();
    const r = alignToScript(
      ["Hello,", "world."],
      heard(["hello", 0.1, 0.5], ["World", 0.6, 1.0]),
      1.2,
    );
    expect(r.matched).toBe(2);
    expect(r.words).toEqual([
      { text: "Hello,", start: 0.1, end: 0.5 },
      { text: "world.", start: 0.6, end: 1 },
    ]);
  });

  it("spreads a word whisper missed between its neighbours", async () => {
    const { alignToScript } = await load();
    const r = alignToScript(["one", "two", "three"], heard(["one", 0, 1], ["three", 3, 4]), 4);
    expect(r.matched).toBe(2);
    expect(r.words[1]).toEqual({ text: "two", start: 1, end: 3 });
  });

  it("ignores extra heard words and substitutions without losing order", async () => {
    const { alignToScript } = await load();
    const r = alignToScript(
      ["the", "cat", "sat"],
      heard(["uh", 0, 0.2], ["the", 0.3, 0.5], ["cut", 0.5, 0.8], ["sat", 0.9, 1.2]),
      1.5,
    );
    expect(r.matched).toBe(2);
    expect(r.words.map((w) => w.start)).toEqual([0.3, 0.5, 0.9]);
  });

  it("matches Arabic words that differ only by diacritics and tatweel", async () => {
    const { alignToScript, normWord } = await load();
    expect(normWord("كَتَابٌ")).toBe(normWord("كتاب"));
    expect(normWord("كـتاب")).toBe(normWord("كتاب"));
    const r = alignToScript(
      ["الكِتَابُ", "جميل"],
      heard(["الكتاب", 0, 0.6], ["جميل", 0.7, 1.2]),
      1.5,
    );
    expect(r.matched).toBe(2);
  });

  it("keeps every time inside the audio and non-decreasing", async () => {
    const { alignToScript } = await load();
    const r = alignToScript(["a", "b", "c"], heard(["a", -0.2, 0.3], ["c", 1.4, 2.6]), 2);
    for (const w of r.words) {
      expect(w.start).toBeGreaterThanOrEqual(0);
      expect(w.end).toBeLessThanOrEqual(2);
      expect(w.end).toBeGreaterThanOrEqual(w.start);
    }
    expect(r.words.map((w) => w.start)).toEqual(
      [...r.words.map((w) => w.start)].sort((x, y) => x - y),
    );
  });
});

describe("video-voice align: one line with an engine", () => {
  const engine = (json: Loose | null, whisperStatus = 0, ffStatus = 0) => ({
    model: "/m.bin",
    run: (cmd: string, args: string[]) => {
      if (cmd === "ffmpeg") return { status: ffStatus, stdout: "", stderr: "" };
      if (json) writeFileSync(`${args[args.indexOf("-of") + 1]}.json`, JSON.stringify(json));
      return { status: whisperStatus, stdout: "", stderr: "" };
    },
  });
  const base = { text: "Hello there", wavFile: "/x.wav", seconds: 1.2, lang: "en-US" };
  const good = {
    transcription: [
      { text: " Hello", offsets: { from: 100, to: 500 } },
      { text: " there", offsets: { from: 600, to: 1000 } },
    ],
  };

  it("uses whisper's times and says the timings are measured", async () => {
    const { alignLine } = await load();
    const r = alignLine({ ...base, engine: engine(good) });
    expect(r).toMatchObject({ source: "whisper", approximate: false });
    expect(r.words.map((w: Loose) => w.start)).toEqual([0.1, 0.6]);
  });

  it("falls back to an estimate, marked approximate, when whisper or ffmpeg fails or hears too little", async () => {
    const { alignLine } = await load();
    expect(alignLine({ ...base, engine: null })).toMatchObject({
      source: "estimate",
      approximate: true,
    });
    expect(alignLine({ ...base, engine: engine(good, 1) })).toMatchObject({
      source: "estimate",
      approximate: true,
      note: "whisper failed on this line",
    });
    expect(alignLine({ ...base, engine: engine(null) }).note).toMatch(/whisper failed/);
    expect(alignLine({ ...base, engine: engine(good, 0, 1) }).note).toMatch(/ffmpeg/);
    const little = { transcription: [{ text: " zebra", offsets: { from: 0, to: 400 } }] };
    expect(alignLine({ ...base, engine: engine(little) }).note).toMatch(/heard too little/);
  });
});

describe("video-voice align: process", () => {
  const project = () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-align-"));
    writeFileSync(
      path.join(dir, "script.md"),
      "[l1] Hello there friend.\n  beat: hook\n[l2] Second line here.\n  beat: step\n",
    );
    return dir;
  };
  const run = (dir: string, ...a: string[]) =>
    spawnSync("node", [skillFile("video-voice", "scripts/align.mjs"), dir, ...a], {
      encoding: "utf8",
      env: { ...process.env, HOME: mkdtempSync(path.join(os.tmpdir(), "home-")) },
    });

  it("writes words.json with estimated, flagged timings when whisper is not set up", () => {
    const dir = project();
    mkdirSync(path.join(dir, "voice"));
    writeFileSync(path.join(dir, "voice", "l1.wav"), wav(1.5));
    writeFileSync(path.join(dir, "voice", "l2.wav"), wav(1));
    const r = run(dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/APPROXIMATE timings \(estimated, not measured\)/);
    const w = JSON.parse(readFileSync(path.join(dir, "voice", "words.json"), "utf8"));
    expect(w.approximate).toBe(true);
    expect(w.lines.map((l: Loose) => [l.id, l.seconds, l.words.length, l.source])).toEqual([
      ["l1", 1.5, 3, "estimate"],
      ["l2", 1, 3, "estimate"],
    ]);
    expect(w.lines[0].words.at(-1).end).toBe(1.5);
  });

  it("refuses --engine whisper without whisper, and reports missing voice files", () => {
    const dir = project();
    expect(run(dir, "--engine", "whisper").status).toBe(1);
    const miss = run(dir);
    expect(miss.status).toBe(1);
    expect(miss.stderr).toMatch(/missing voice\/l1\.wav/);
    expect(run(dir, "--engine", "bogus").status).toBe(2);
  });
});
