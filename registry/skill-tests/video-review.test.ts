import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rv = () => loadScript<Loose>("video-core", "scripts/review.mjs");

function project(extra: Loose = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "review-"));
  mkdirSync(path.join(dir, "voice"));
  writeFileSync(path.join(dir, "script.md"), "[l1] Hello there bots.\n");
  writeFileSync(path.join(dir, "voice", "l1.wav"), "abc");
  writeFileSync(
    path.join(dir, "video.json"),
    JSON.stringify({ version: 1, meta: { fps: 30 }, script: "script.md", scenes: [], ...extra }),
  );
  return dir;
}

describe("project hash and approval", () => {
  it("changes when the video, script or a voice file changes, and not otherwise", async () => {
    const { projectHash } = await rv();
    const dir = project();
    const a = projectHash(dir);
    expect(projectHash(dir)).toBe(a);
    writeFileSync(path.join(dir, "script.md"), "[l1] Hello there robots.\n");
    expect(projectHash(dir)).not.toBe(a);
    const b = projectHash(dir);
    writeFileSync(path.join(dir, "voice", "l1.wav"), "abd");
    expect(projectHash(dir)).not.toBe(b);
  });
  it("is none before approval, current after, stale once the project changes", async () => {
    const { projectHash, approvalState } = await rv();
    const dir = project();
    expect(approvalState(dir).state).toBe("none");
    writeFileSync(path.join(dir, "approval.json"), JSON.stringify({ hash: projectHash(dir) }));
    expect(approvalState(dir).state).toBe("current");
    writeFileSync(path.join(dir, "script.md"), "changed");
    expect(approvalState(dir)).toMatchObject({ state: "stale" });
    writeFileSync(path.join(dir, "approval.json"), "{not json");
    expect(approvalState(dir).state).toBe("stale");
  });
});

describe("render validation", () => {
  const ok = { width: 1080, height: 1920, fps: 30, seconds: 10, frames: 300, audio: true };
  const want = { size: [1080, 1920], fps: 30, seconds: 10, wantsAudio: true };
  it("passes a render that matches", async () => {
    const { validateRender } = await rv();
    expect(validateRender(ok, want).every((c: Loose) => c.level === "pass")).toBe(true);
  });
  it("fails the wrong size, rate, length, frame count and a missing track", async () => {
    const { validateRender } = await rv();
    const bad = validateRender(
      { ...ok, width: 720, fps: 24, seconds: 12, frames: 250, audio: false },
      want,
    );
    expect(bad.filter((c: Loose) => c.level === "fail").map((c: Loose) => c.id)).toEqual([
      "size",
      "fps",
      "duration",
      "frames",
      "audio",
    ]);
  });
  it("accepts a draft of the same shape and a silent video that has no sound", async () => {
    const { validateRender } = await rv();
    const draft = validateRender(
      { ...ok, width: 304, height: 540, audio: false },
      { ...want, wantsAudio: false },
      { draft: true },
    );
    expect(draft.every((c: Loose) => c.level === "pass")).toBe(true);
  });
});

describe("word cues for stills", () => {
  it("finds the time a word is spoken in the film, a moment after it starts", async () => {
    const { wordTimes } = await rv();
    const dir = project();
    writeFileSync(
      path.join(dir, "timing.json"),
      JSON.stringify({
        scenes: [{ id: "s", start: 4, seconds: 5, lines: [{ id: "l1", start: 0.5 }] }],
      }),
    );
    writeFileSync(
      path.join(dir, "voice", "words.json"),
      JSON.stringify({
        lines: [
          {
            id: "l1",
            words: [
              { text: "Hello", start: 0.1 },
              { text: "bots.", start: 0.9 },
            ],
          },
        ],
      }),
    );
    expect(wordTimes(dir, ["Bots"])).toEqual([5.55]); // 4 + 0.5 + 0.9 + 0.15
    expect(() => wordTimes(dir, ["missing"])).toThrow("not in voice/words.json");
  });
});
