import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ffPath, haveFF, makeClip, seconds, tmp } from "./video-edit-fixtures";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Plan = {
  normalizeWord: (t: string) => string;
  fillerSet: (f: Loose, lang: string, extra?: string) => Set<string>;
  buildCutPlan: (spans: Loose[], o: Loose) => Loose;
  cutArgs: (o: Loose, i: Loose) => string[];
  silenceArgs: (o: Loose) => string[];
  parseSilence: (l: string, d: number) => { start: number; end: number }[];
  speechSpans: (s: Loose[], d: number) => Loose[];
  readWords: (r: unknown) => Loose[];
  trimToSound: (w: Loose[], s: Loose[], d: number) => Loose[];
  isWhisperWords: (r: unknown) => boolean;
};
type Whisper = {
  dtwPreset: (m: string) => string | null;
  whisperArgs: (o: Loose) => string[];
  parseWhisperJson: (j: Loose) => Loose[];
  configuredModel: (home?: string) => string | null;
};
const plan = () => loadScript<Plan>("video-edit", "scripts/cutplan.mjs");
const fillers = JSON.parse(readFileSync(skillFile("video-edit", "assets/fillers.json"), "utf8"));
const W = (text: string, start: number, end: number) => ({ text, start, end });

describe("cut planner", () => {
  it("shrinks a long pause to a breath and keeps both words (hand-checked)", async () => {
    const { buildCutPlan } = await plan();
    const p = buildCutPlan([W("hello", 0, 1), W("world", 3, 4)], { duration: 4 });
    expect(p.removed).toEqual([{ start: 1.06, end: 2.94, kind: "pause" }]);
    expect(p.keeps).toEqual([
      { start: 0, end: 1.06 },
      { start: 2.94, end: 4 },
    ]);
    expect(p.seconds).toEqual({ before: 4, after: 2.12, saved: 1.88 });
  });

  it("removes leading and trailing silence but leaves a lead and a tail", async () => {
    const { buildCutPlan } = await plan();
    const p = buildCutPlan([W("hi", 2, 2.5), W("there", 2.6, 3)], { duration: 8 });
    expect(p.keeps).toEqual([{ start: 1.95, end: 3.25 }]);
    expect(p.counts).toEqual({ pauses: 2, fillers: 0 });
  });

  it("keeps a pause that is short enough, and never touches speech", async () => {
    const { buildCutPlan } = await plan();
    const p = buildCutPlan([W("a", 0, 1), W("b", 1.3, 2)], { duration: 2 });
    expect(p.removed).toEqual([]);
    expect(p.keeps).toEqual([{ start: 0, end: 2 }]);
  });

  it("removes a filler, with and without a pause around it", async () => {
    const { buildCutPlan, fillerSet } = await plan();
    const f = fillerSet(fillers, "en");
    const tight = buildCutPlan([W("so", 0, 0.4), W("Um,", 0.4, 0.8), W("then", 0.8, 1.2)], {
      duration: 1.2,
      fillers: f,
    });
    expect(tight.removed).toEqual([{ start: 0.4, end: 0.8, kind: "filler", text: "Um," }]);
    expect(tight.seconds.after).toBe(0.8);
    const wide = buildCutPlan([W("so", 0, 0.5), W("uh", 1.5, 1.8), W("then", 2.8, 3.2)], {
      duration: 3.2,
      fillers: f,
    });
    expect(wide.removed).toHaveLength(1);
    expect(wide.removed[0]).toMatchObject({ kind: "filler", text: "uh" });
    expect(wide.keeps).toEqual([
      { start: 0, end: 0.56 },
      { start: 2.74, end: 3.2 },
    ]);
  });

  it("matches Arabic fillers without diacritics, and only removes optional words when asked", async () => {
    const { fillerSet, normalizeWord } = await plan();
    expect(normalizeWord("آه،")).toBe("آه");
    expect(normalizeWord("أمّم")).toBe(normalizeWord("أمم"));
    const base = fillerSet(fillers, "ar");
    expect(base.has(normalizeWord("اه"))).toBe(true);
    expect(base.has(normalizeWord("يعني"))).toBe(false); // can carry meaning
    expect(fillerSet(fillers, "ar", "يعني").has(normalizeWord("يعني"))).toBe(true);
    expect(fillerSet(fillers, "en", "all").has("you know")).toBe(true);
    expect(fillerSet(fillers, "en").has("like")).toBe(false);
  });

  it("refuses silly settings and a clip with no speech", async () => {
    const { buildCutPlan, readWords } = await plan();
    expect(() => buildCutPlan([W("a", 0, 1)], { duration: 1, pause: 0.05 })).toThrow(/0.15 to 3/);
    expect(() => buildCutPlan([W("a", 0, 1)], { duration: 1, breath: 0.5 })).toThrow(/--breath/);
    expect(() => buildCutPlan([], { duration: 1 })).toThrow(/No speech/);
    expect(() => buildCutPlan([W("um", 0, 1)], { duration: 1, fillers: new Set(["um"]) })).toThrow(
      /No speech/,
    );
    expect(() => readWords([{ text: "a", start: 2, end: 1 }])).toThrow(/Word 1/);
    expect(() => readWords("x")).toThrow(/list/);
    expect(readWords({ words: [W("a", 0, 1)] })).toHaveLength(1);
  });

  it("brings pauses back into whisper's chained word times by trimming words to the sound", async () => {
    const { trimToSound, buildCutPlan, isWhisperWords } = await plan();
    // "there" is chained to start where "hello" ended, so no gap is visible without trimming
    const words = [W("hello", 0, 1), W("there", 1, 4)];
    expect(buildCutPlan(words, { duration: 4 }).removed).toEqual([]);
    const trimmed = trimToSound(words, [{ start: 1.02, end: 3 }], 4);
    expect(trimmed).toEqual([W("hello", 0, 1), W("there", 3, 4)]);
    expect(buildCutPlan(trimmed, { duration: 4 }).removed).toEqual([
      { start: 1.06, end: 2.94, kind: "pause" },
    ]);
    expect(trimToSound([W("ghost", 1.2, 2)], [{ start: 1.02, end: 3 }], 4)).toEqual([]);
    expect(isWhisperWords({ source: "whisper.cpp", words })).toBe(true);
    expect(isWhisperWords(words)).toBe(false);
  });

  it("builds a render that trims picture and sound at the same times, fading 10 ms at each join", async () => {
    const { cutArgs } = await plan();
    const keeps = [
      { start: 0, end: 1.06 },
      { start: 2.94, end: 4 },
    ];
    const a = cutArgs({ file: "/a.mp4", out: "/o.mp4", keeps }, { audio: true }).join(" ");
    expect(a).toContain("[0:v]trim=start=0:end=1.06,setpts=PTS-STARTPTS[v0]");
    expect(a).toContain(
      "[0:a]atrim=start=2.94:end=4,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.01,afade=t=out:st=1.05:d=0.01[a1]",
    );
    expect(a).toContain("concat=n=2:v=1:a=1");
    expect(cutArgs({ file: "/a", out: "/o", keeps }, { audio: false }).join(" ")).toContain(
      "concat=n=2:v=1:a=0",
    );
    expect(() => cutArgs({ file: "/a", out: "/o", keeps: [] }, { audio: true })).toThrow(
      /keeps nothing/,
    );
    expect(() =>
      cutArgs(
        {
          file: "/a",
          out: "/o",
          keeps: Array.from({ length: 401 }, (_, i) => ({ start: i, end: i + 0.5 })),
        },
        { audio: true },
      ),
    ).toThrow(/400/);
  });

  it("reads silencedetect's log and turns the gaps into spans", async () => {
    const { parseSilence, speechSpans, silenceArgs } = await plan();
    const log =
      "[silencedetect @ 0x1] silence_start: 1.0\n[silencedetect @ 0x1] silence_end: 3.0 | silence_duration: 2.0\n[silencedetect @ 0x1] silence_start: 3.9";
    const s = parseSilence(log, 4);
    expect(s).toEqual([
      { start: 1, end: 3 },
      { start: 3.9, end: 4 },
    ]);
    expect(speechSpans(s, 4)).toEqual([
      { text: "", start: 0, end: 1 },
      { text: "", start: 3, end: 3.9 },
    ]);
    expect(silenceArgs({ file: "/a.mp4" }).join(" ")).toContain("silencedetect=noise=-35dB:d=0.35");
  });
});

describe("whisper helpers", () => {
  it("give the same answers as video-voice's align.mjs", async () => {
    const mine = await loadScript<Whisper>("video-edit", "scripts/_whisper.mjs");
    const theirs = await loadScript<Whisper>("video-voice", "scripts/align.mjs");
    for (const m of [
      "/m/ggml-base.bin",
      "/m/ggml-small.en.bin",
      "/m/ggml-large-v3-turbo.bin",
      "/m/custom.bin",
    ])
      expect(mine.dtwPreset(m)).toBe(theirs.dtwPreset(m));
    const o = { model: "/m/ggml-base.bin", wav: "/a.wav", lang: "en", outPrefix: "/o" };
    expect(mine.whisperArgs(o)).toEqual(theirs.whisperArgs(o));
    expect(mine.whisperArgs({ ...o, model: "/m/custom.bin" })).toEqual(
      theirs.whisperArgs({ ...o, model: "/m/custom.bin" }),
    );
    const json = {
      transcription: [
        {
          text: " Hello",
          offsets: { from: 0, to: 400 },
          tokens: [{ text: " Hello", t_dtw: 40, offsets: { from: 0, to: 400 } }],
        },
      ],
    };
    expect(mine.parseWhisperJson(json)).toEqual(theirs.parseWhisperJson(json));
    expect(mine.configuredModel("/nonexistent")).toBeNull();
  });
});

describe.skipIf(!haveFF)("cut on real files", () => {
  const dir = tmp("cut");
  const clip = makeClip(path.join(dir, "talk.mp4"), [
    { color: "0x303030", seconds: 1 },
    { color: "0x606060", seconds: 2, tone: null },
    { color: "0x909090", seconds: 1 },
  ]);
  const cli = (...args: string[]) =>
    spawnSync(process.execPath, [skillFile("video-edit", "scripts/edit.mjs"), ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: ffPath, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
    });

  it("is a dry run until --apply, and says what it would do", () => {
    const out = path.join(dir, "no.mp4");
    const r = cli("cut", "--in", clip, "--silence-only", "--plan", path.join(dir, "cut.json"));
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("4 s -> 2.12 s (saves 1.88 s): 1 pause(s), 0 filler(s)");
    expect(r.stdout).toContain("Dry run");
    expect(existsSync(out)).toBe(false);
    expect(JSON.parse(readFileSync(path.join(dir, "cut.json"), "utf8")).keeps).toHaveLength(2);
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(40);
    expect(r.stdout + r.stderr).not.toContain("sk-canary");
  });

  it("removes the known 2 s silence, leaving a breath (output within 0.1 s of the plan)", () => {
    const out = path.join(dir, "tight.mp4");
    const r = cli("cut", "--in", clip, "--silence-only", "--apply", "--out", out);
    expect(r.status, r.stderr).toBe(0);
    expect(Math.abs(seconds(out) - 2.12)).toBeLessThan(0.1);
  });

  it("cuts by given words, and removes a filler word", () => {
    const words = path.join(dir, "words.json");
    writeFileSync(
      words,
      JSON.stringify([W("so", 0, 0.5), W("um", 0.5, 0.9), W("hello", 1, 1.5), W("bye", 3.2, 4)]),
    );
    const out = path.join(dir, "words.mp4");
    const r = cli("cut", "--in", clip, "--words", words, "--apply", "--out", out);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('filler "um"');
    // um (0.4 s) and the pause 1.5-3.2 (1.7 s, minus a 0.12 s breath) are gone
    expect(Math.abs(seconds(out) - (4 - 0.4 - 1.58))).toBeLessThan(0.15);
    expect(
      cli("cut", "--in", clip, "--words", words, "--no-fillers", "--pause", "0.01").stderr,
    ).toContain("0.15 to 3");
  });

  it("refuses to run without whisper, words or --silence-only, with a way out", () => {
    const r = spawnSync(
      process.execPath,
      [skillFile("video-edit", "scripts/edit.mjs"), "cut", "--in", clip],
      {
        encoding: "utf8",
        env: { ...process.env, PATH: ffPath, HOME: tmp("nohome") },
      },
    );
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/whisper.cpp is not set up.*--silence-only/);
  });
});

const model = (() => {
  try {
    const m = JSON.parse(
      readFileSync(path.join(os.homedir(), ".aisle-video", "tools.json"), "utf8"),
    );
    return existsSync(m.whisperModel) && existsSync(m["whisper-cli"]) ? m : null;
  } catch {
    return null;
  }
})();
const demo = path.join(
  skillFile("video-core", "."),
  "..",
  "..",
  "..",
  "docs",
  "video",
  "demos",
  "rate-limit",
  "rate-limit.mp4",
);

describe.skipIf(!haveFF || !model || !existsSync(demo))("transcribe with real whisper.cpp", () => {
  it("hears the demo narration and cuts a plan from it", { timeout: 300_000 }, () => {
    const dir = tmp("whisper");
    const first = path.join(dir, "first.mp4");
    const run = (...a: string[]) =>
      spawnSync(process.execPath, [skillFile("video-edit", "scripts/edit.mjs"), ...a], {
        encoding: "utf8",
        env: { ...process.env, PATH: ffPath },
      });
    expect(run("trim", "--in", demo, "--out", first, "--to", "5").status).toBe(0);
    const words = path.join(dir, "words.json");
    const t = run("transcribe", "--in", first, "--out", words);
    expect(t.status, t.stderr).toBe(0);
    const heard = JSON.parse(readFileSync(words, "utf8"))
      .words.map((w: Loose) => w.text.toLowerCase())
      .join(" ");
    expect(heard).toContain("limit");
    expect(heard).toContain("five");
    const c = run("cut", "--in", first, "--words", words);
    expect(c.status, c.stderr).toBe(0);
    expect(c.stdout).toContain("Dry run");
  });
});
