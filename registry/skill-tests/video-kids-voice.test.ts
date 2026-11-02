import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { GOOD } from "./video-puppet-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type KV = {
  pitchFilter: (st: number) => string;
  speakers: (v: Loose) => Map<string, string>;
  pitchOf: (dir: string, name: string) => { semitones?: number; error?: string };
};
const mod = () => loadScript<KV>("video-kids", "scripts/kidvoice.mjs");
const project = (bible: string | null) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kidvoice-"));
  if (bible !== null) {
    mkdirSync(path.join(dir, "characters", "nour"), { recursive: true });
    writeFileSync(path.join(dir, "characters", "nour", "bible.md"), bible);
  }
  return dir;
};

describe("kid voice", () => {
  it("builds a pitch filter that keeps length and shifts formants", async () => {
    const { pitchFilter } = await mod();
    expect(pitchFilter(12)).toBe("rubberband=pitch=2.00000:formant=shifted");
    expect(pitchFilter(0)).toContain("pitch=1.00000");
  });
  it("finds who says each line, the first speaker winning", async () => {
    const { speakers } = await mod();
    const video = {
      scenes: [
        { kind: "title", props: {} },
        {
          kind: "puppet",
          props: {
            cast: [
              { rig: "a", speaks: ["l1", "l2"] },
              { rig: "b", speaks: ["l2", "l3"] },
            ],
          },
        },
      ],
    };
    expect([...speakers(video)]).toEqual([
      ["l1", "a"],
      ["l2", "a"],
      ["l3", "b"],
    ]);
  });
  it("reads the bible's Voice pitch and refuses silly values", async () => {
    const { pitchOf } = await mod();
    expect(pitchOf(project(GOOD), "nour")).toEqual({ semitones: 0 });
    expect(
      pitchOf(project(GOOD.replace("- Personality:", "- Voice pitch: 4\n- Personality:")), "nour"),
    ).toEqual({ semitones: 4 });
    expect(
      pitchOf(project(GOOD.replace("- Personality:", "- Voice pitch: 15\n- Personality:")), "nour")
        .error,
    ).toMatch(/0 to 8/);
    expect(
      pitchOf(
        project(GOOD.replace("- Personality:", "- Voice pitch: high\n- Personality:")),
        "nour",
      ).error,
    ).toMatch(/0 to 8/);
  });
  it("runs as a process: dry run lists lines, missing audio is an error", () => {
    const dir = project(GOOD.replace("- Personality:", "- Voice pitch: 4\n- Personality:"));
    writeFileSync(
      path.join(dir, "video.json"),
      JSON.stringify({
        scenes: [{ kind: "puppet", props: { cast: [{ rig: "nour", speaks: ["k1"] }] } }],
      }),
    );
    const run = (...a: string[]) =>
      spawnSync("node", [skillFile("video-kids", "scripts/kidvoice.mjs"), dir, ...a], {
        encoding: "utf8",
      });
    const missing = run();
    expect(missing.status).toBe(1);
    expect(missing.stdout).toMatch(/voice\/k1\.wav is missing/);
    mkdirSync(path.join(dir, "voice"));
    writeFileSync(path.join(dir, "voice", "k1.wav"), "x");
    const dry = run("--dry-run");
    expect(dry.status).toBe(0);
    expect(dry.stdout).toMatch(/would shift k1 \(nour\) by \+4 semitones/);
    expect(dry.stdout).toMatch(/not a real child's/);
  });
});
