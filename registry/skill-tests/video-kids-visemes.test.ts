import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Vis = {
  VISEMES: string[];
  wordShapes: (w: string) => string[];
  lineVisemes: (
    words: Loose[],
    seconds: number,
    quiet?: (t: number) => boolean,
  ) => Array<{ t: number; v: string }>;
  windowLoudness: (b: Buffer) => { windows: number[]; step: number } | null;
  quietFrom: (l: { windows: number[]; step: number } | null) => (t: number) => boolean;
};
const vis = () => loadScript<Vis>("video-kids", "scripts/visemes.mjs");

/** A 16-bit mono WAV: `loud` seconds of a tone, then `quiet` seconds of silence. */
function wav(loud: number, quiet: number, rate = 8000): Buffer {
  const n = Math.round((loud + quiet) * rate);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < Math.round(loud * rate); i++)
    data.writeInt16LE(Math.round(12000 * Math.sin((2 * Math.PI * 220 * i) / rate)), i * 2);
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

describe("word shapes", () => {
  it("spells English words into mouth shapes", async () => {
    const { wordShapes } = await vis();
    expect(wordShapes("mama")).toEqual(["mbp", "a", "mbp", "a"]);
    expect(wordShapes("Hello")).toEqual(["e", "l", "o"]);
    expect(wordShapes("share")).toEqual(["e", "a", "u"]);
    // The silent final "e" adds no shape; "ph" is the lip-teeth shape.
    expect(wordShapes("make").at(-1)).toBe("e");
    expect(wordShapes("phone")[0]).toBe("fv");
    expect(wordShapes("123 !?")).toEqual([]);
  });
  it("spells Arabic with the short-vowel marks when they are written", async () => {
    const { wordShapes } = await vis();
    expect(wordShapes("بابا")).toEqual(["mbp", "a", "mbp", "a"]);
    expect(wordShapes("نُور")).toEqual(["l", "u", "l"]);
    expect(wordShapes("فَ")).toEqual(["fv", "a"]);
  });
  it("only gives shapes that exist", async () => {
    const { wordShapes, VISEMES } = await vis();
    for (const w of ["quick", "thought", "boy", "knight", "سلحفاة", "مرحبا"])
      for (const s of wordShapes(w)) expect(VISEMES).toContain(s);
  });
});

describe("line visemes", () => {
  const words = [
    { text: "Hello", start: 0.2, end: 0.8 },
    { text: "Nour", start: 0.9, end: 1.4 },
  ];
  it("starts and ends each word, with rest between words and at the start", async () => {
    const { lineVisemes } = await vis();
    const ev = lineVisemes(words, 1.6);
    expect(ev[0]).toEqual({ t: 0, v: "rest" });
    expect(ev.find((e) => e.t === 0.2)?.v).toBe("e");
    expect(ev.find((e) => e.t === 0.8)?.v).toBe("rest");
    expect(ev.at(-1)).toEqual({ t: 1.4, v: "rest" });
    for (let i = 1; i < ev.length; i++) {
      expect(ev[i].t).toBeGreaterThan(ev[i - 1].t);
      expect(ev[i].v).not.toBe(ev[i - 1].v);
    }
  });
  it("is deterministic", async () => {
    const { lineVisemes } = await vis();
    expect(lineVisemes(words, 1.6)).toEqual(lineVisemes(words, 1.6));
  });
  it("holds vowels longer than consonants and drops shapes too short to see", async () => {
    const { lineVisemes } = await vis();
    const ev = lineVisemes([{ text: "strengths", start: 0, end: 0.3 }], 1);
    for (let i = 1; i < ev.length - 1; i++)
      expect(ev[i + 1].t - ev[i].t).toBeGreaterThanOrEqual(0.05);
  });
  it("closes the mouth where the audio is quiet", async () => {
    const { lineVisemes, windowLoudness, quietFrom } = await vis();
    const quiet = quietFrom(windowLoudness(wav(0.5, 1.5)));
    expect(quiet(0.2)).toBe(false);
    expect(quiet(1.2)).toBe(true);
    const ev = lineVisemes([{ text: "mama", start: 0.1, end: 1.9 }], 2, quiet);
    const late = ev.filter((e) => e.t > 0.7 && e.t < 1.9);
    expect(late.every((e) => e.v === "rest")).toBe(true);
  });
  it("reads plain 16-bit WAV only", async () => {
    const { windowLoudness } = await vis();
    expect(
      windowLoudness(Buffer.from("not a wav file at all, but long enough to try.......")),
    ).toBeNull();
    const w = wav(0.2, 0);
    w.writeUInt16LE(3, 20);
    expect(windowLoudness(w)).toBeNull();
  });
});

describe("visemes.mjs", () => {
  const run = (dir: string, ...a: string[]) =>
    spawnSync("node", [skillFile("video-kids", "scripts/visemes.mjs"), dir, ...a], {
      encoding: "utf8",
    });
  const project = (approximate: boolean) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "kids-vis-"));
    mkdirSync(path.join(dir, "voice"));
    writeFileSync(
      path.join(dir, "voice", "words.json"),
      JSON.stringify({
        approximate,
        lines: [
          { id: "l1", seconds: 1.5, words: [{ text: "Hello", start: 0.1, end: 0.9 }], source: "x" },
        ],
      }),
    );
    return dir;
  };
  it("writes voice/visemes.json and says when the timings are estimated", () => {
    const dir = project(true);
    writeFileSync(path.join(dir, "voice", "l1.wav"), wav(1, 0.5));
    const r = run(dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/1 of 1 lines used the audio/);
    expect(r.stdout).toMatch(/approximate/);
    const out = JSON.parse(readFileSync(path.join(dir, "voice", "visemes.json"), "utf8"));
    expect(out.approximate).toBe(true);
    expect(out.lines.l1[0]).toEqual({ t: 0, v: "rest" });
    expect(run(dir, "--no-audio").stdout).toMatch(/0 of 1 lines/);
  });
  it("says what to run first when words.json is missing", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "kids-vis-"));
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/words\.json is missing/);
  });
});
