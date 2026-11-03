import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rc = () => loadScript<Loose>("video-voice", "scripts/recorded.mjs");
const H = (text: string, start: number, end = start + 0.3) => ({ text, start, end });

const lines = [
  { id: "l1", text: "Rate limits protect servers." },
  { id: "l2", text: "A bucket holds tokens." },
];
// two lines read in order with a pause between them
const heard = [
  H("Rate", 0.5),
  H("limits", 0.8),
  H("protect", 1.1),
  H("servers.", 1.4, 1.9),
  H("A", 3.0),
  H("bucket", 3.3),
  H("holds", 3.6),
  H("tokens.", 3.9, 4.4),
];

describe("recording guards", () => {
  it("refuses a recording whose speaker is not stated, and another voice without consent", async () => {
    const { speakerRefusal } = await rc();
    expect(speakerRefusal({})).toMatch(/whose voice/);
    expect(speakerRefusal({ speaker: "me" })).toMatch(/whose voice/);
    expect(speakerRefusal({ speaker: "self" })).toBeNull();
    expect(speakerRefusal({ speaker: "other" })).toMatch(/consent/);
    const missing = () => false;
    expect(speakerRefusal({ speaker: "other", consent: "c.txt" }, missing)).toMatch(
      /does not exist/,
    );
    expect(
      speakerRefusal(
        { speaker: "other", consent: "c.txt" },
        () => true,
        () => 0,
      ),
    ).toMatch(/empty/);
    expect(
      speakerRefusal(
        { speaker: "other", consent: "c.txt" },
        () => true,
        () => 12,
      ),
    ).toBeNull();
  });
  it("accepts only a plain local media file name", async () => {
    const { checkRecording } = await rc();
    for (const bad of ["", "-i", "http://example.com/a.wav", "pipe:0", "a\nb.wav", "notes.txt"])
      expect(() => checkRecording(bad), bad).toThrow();
    expect(() => checkRecording("/nonexistent/mic.wav")).toThrow(/does not exist/);
    const dir = mkdtempSync(path.join(os.tmpdir(), "rec-"));
    writeFileSync(path.join(dir, "mic.wav"), "x");
    expect(checkRecording(path.join(dir, "mic.wav"))).toBe(path.join(dir, "mic.wav"));
  });
});

describe("locating lines in a recording", () => {
  it("gives each line its own span and counts how many of its words were heard", async () => {
    const { locateLines } = await rc();
    const r = locateLines(lines, heard, 6);
    expect(r.matched).toBe(r.of);
    expect(r.lines[0]).toMatchObject({ id: "l1", found: 4, of: 4 });
    expect(r.lines[0].start).toBeCloseTo(0.5);
    expect(r.lines[0].end).toBeCloseTo(1.9);
    expect(r.lines[1].start).toBeCloseTo(3.0);
  });
  it("reports a line the recording does not contain", async () => {
    const { locateLines, weakLines } = await rc();
    const only1 = locateLines(lines, heard.slice(0, 4), 6);
    expect(only1.lines[0].found).toBe(4);
    expect(weakLines(only1.lines)).toEqual([{ id: "l2", found: 0, of: 4 }]);
    const mumbled = locateLines(lines, [...heard.slice(0, 4), H("a", 3), H("tokens.", 3.9)], 6);
    expect(weakLines(mumbled.lines)).toEqual([{ id: "l2", found: 2, of: 4 }]);
  });
  it("tolerates a word whisper mis-heard inside a line", async () => {
    const { locateLines, weakLines } = await rc();
    const slip = heard.map((h) => (h.text === "protect" ? H("protects", 1.1) : h));
    const r = locateLines(lines, slip, 6);
    expect(weakLines(r.lines)).toEqual([]);
    expect(r.lines[0].found).toBe(3);
    expect(r.lines[0].words).toHaveLength(4); // the script's own words, never whisper's
    expect(r.lines[0].words[2].text).toBe("protect");
  });
});

describe("cutting", () => {
  it("adds a little air each side, splits the gap between lines and stays inside the recording", async () => {
    const { locateLines, planCuts } = await rc();
    const cuts = planCuts(locateLines(lines, heard, 6).lines, 6);
    expect(cuts[0].from).toBeCloseTo(0.35); // 0.5 - 0.15
    expect(cuts[0].to).toBeCloseTo(2.2); // 1.9 + 0.3
    expect(cuts[1].from).toBeCloseTo(2.85); // 3.0 - 0.15
    expect(cuts[1].to).toBeCloseTo(4.7);
    expect(cuts[0].to).toBeLessThanOrEqual(cuts[1].from);
    const tight = planCuts(
      locateLines(
        lines,
        [
          ...heard.slice(0, 4),
          ...heard.slice(4).map((h) => ({ ...h, start: h.start - 1.3, end: h.end - 1.3 })),
        ],
        6,
      ).lines,
      6,
    );
    expect(tight[0].to).toBeLessThanOrEqual(tight[1].from + 1e-9); // lines close together never overlap
    expect(planCuts(locateLines(lines, heard, 4.5).lines, 4.5)[1].to).toBeLessThanOrEqual(4.5);
  });
  it("writes words relative to each cut, measured and marked as a recording", async () => {
    const { locateLines, planCuts, wordsJson } = await rc();
    const found = locateLines(lines, heard, 6);
    const cuts = planCuts(found.lines, 6);
    const j = wordsJson(found.lines, cuts);
    expect(j).toMatchObject({ approximate: false, recorded: true });
    expect(j.lines[0].words[0].start).toBeCloseTo(0.15); // 0.5 - 0.35
    expect(j.lines[1].words[0].start).toBeCloseTo(0.15);
    for (const l of j.lines) {
      expect(l.approximate).toBe(false);
      for (const w of l.words) {
        expect(w.start).toBeGreaterThanOrEqual(0);
        expect(w.end).toBeLessThanOrEqual(l.seconds + 1e-9);
      }
    }
  });
});

describe("recorded.mjs", () => {
  const script = skillFile("video-voice", "scripts/recorded.mjs");
  const run = (...a: string[]) => spawnSync("node", [script, ...a], { encoding: "utf8" });
  it("refuses without a stated speaker before touching anything, exit 1", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "rec-cli-"));
    writeFileSync(path.join(dir, "script.md"), "[l1] Hi.\n");
    writeFileSync(path.join(dir, "mic.wav"), "x");
    const r = run(dir, "--file", path.join(dir, "mic.wav"));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/whose voice/);
    expect(run(dir, "--file", path.join(dir, "mic.wav"), "--speaker", "other").stderr).toMatch(
      /consent/,
    );
  });
  it("exits 2 without a project, a script or a usable file", () => {
    expect(run().status).toBe(2);
    const dir = mkdtempSync(path.join(os.tmpdir(), "rec-cli2-"));
    expect(run(dir, "--file", "x.wav", "--speaker", "self").status).toBe(2); // no script.md
    writeFileSync(path.join(dir, "script.md"), "[l1] Hi.\n");
    const url = run(dir, "--file", "https://example.com/a.wav", "--speaker", "self");
    expect(url.status).toBe(2);
    expect(url.stderr).toMatch(/URLs/);
  });
  it("voice.mjs points a recorded project to recorded.mjs", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "rec-cli3-"));
    writeFileSync(path.join(dir, "script.md"), "[l1] Hi.\n  beat: hook\n");
    writeFileSync(
      path.join(dir, "video.json"),
      JSON.stringify({
        version: 1,
        meta: { lang: "en" },
        voice: { provider: "recorded" },
        scenes: [],
      }),
    );
    const r = spawnSync("node", [skillFile("video-voice", "scripts/voice.mjs"), dir], {
      encoding: "utf8",
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("recorded.mjs");
  });
});

describe("disclosure for a recorded voice", () => {
  it("says it is a human recording, not a synthetic voice, and asks for the consent record for another speaker", async () => {
    const { voiceGuidance } = await loadScript<Loose>("video-core", "scripts/credits.mjs");
    expect(voiceGuidance({ provider: "recorded", speaker: "self" }).join(" ")).toMatch(
      /own recording, not a synthetic/,
    );
    expect(voiceGuidance({ provider: "recorded", speaker: "other" }).join(" ")).toMatch(/consent/);
    expect(voiceGuidance({ provider: "kokoro", model: "x" }).join(" ")).toMatch(
      /computer-generated/,
    );
  });
});
