import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skillFile } from "./load";

// Real engines: run only on a machine where they are set up (~/.aisle-video/tools.json), skipped elsewhere.
type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const cfg: Loose = (() => {
  try {
    return JSON.parse(readFileSync(path.join(os.homedir(), ".aisle-video", "tools.json"), "utf8"));
  } catch {
    return {};
  }
})();
const hasKokoro =
  typeof cfg.python === "string" &&
  existsSync(cfg.python) &&
  spawnSync(cfg.python, ["-c", "import kokoro"]).status === 0;
const hasWhisper =
  typeof cfg["whisper-cli"] === "string" &&
  existsSync(cfg["whisper-cli"]) &&
  typeof cfg.whisperModel === "string" &&
  existsSync(cfg.whisperModel);
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

const project = (script: string) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "video-real-"));
  writeFileSync(path.join(dir, "script.md"), script);
  return dir;
};
const step = (skill: string, file: string, dir: string, ...a: string[]) =>
  spawnSync("node", [skillFile(skill, `scripts/${file}`), dir, ...a], { encoding: "utf8" });

describe.skipIf(!hasKokoro)("real Kokoro voice", () => {
  it(
    "speaks a line: a mono 24 kHz wav of plausible length, recorded in the manifest",
    { timeout: 300_000 },
    () => {
      const dir = project("[l1] Your API needs a speed limit.\n  beat: hook\n");
      const r = step("video-voice", "voice.mjs", dir, "--provider", "kokoro");
      expect(r.status, r.stderr).toBe(0);
      const m = JSON.parse(readFileSync(path.join(dir, "voice", "manifest.json"), "utf8"));
      expect(m).toMatchObject({
        provider: "kokoro",
        voice: "af_heart",
        model: "hexgrad/Kokoro-82M",
      });
      expect(m.lines.l1.seconds).toBeGreaterThan(1.5);
      expect(m.lines.l1.seconds).toBeLessThan(5);
      const wav = readFileSync(path.join(dir, "voice", "l1.wav"));
      expect(wav.readUInt32LE(24)).toBe(24000);
      const again = step("video-voice", "voice.mjs", dir, "--provider", "kokoro");
      expect(again.stdout).toMatch(/Voiced 0 line\(s\), kept 1/);
    },
  );

  it("refuses an Arabic project", () => {
    const dir = project("[l1] مرحبا بكم\n  beat: hook\n");
    writeFileSync(
      path.join(dir, "video.json"),
      JSON.stringify({ version: 1, meta: { lang: "ar" }, scenes: [] }),
    );
    expect(step("video-voice", "voice.mjs", dir, "--provider", "kokoro").stderr).toMatch(
      /speaks en, not "ar"/,
    );
  });
});

describe.skipIf(!(hasKokoro && hasWhisper && hasFfmpeg))("real whisper.cpp alignment", () => {
  it(
    "gives measured word times that follow the script's words, in order, inside the audio",
    { timeout: 300_000 },
    () => {
      const dir = project("[l1] Each request takes one token from the bucket.\n  beat: step\n");
      expect(step("video-voice", "voice.mjs", dir, "--provider", "kokoro").status).toBe(0);
      const r = step("video-voice", "align.mjs", dir, "--engine", "whisper");
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toMatch(/timings from whisper\.cpp/);
      const w = JSON.parse(readFileSync(path.join(dir, "voice", "words.json"), "utf8"));
      expect(w.approximate).toBe(false);
      const line = w.lines[0];
      expect(line.words.map((x: Loose) => x.text).join(" ")).toBe(
        "Each request takes one token from the bucket.",
      );
      let prev = 0;
      for (const x of line.words) {
        expect(x.start).toBeGreaterThanOrEqual(prev - 0.001);
        expect(x.end).toBeGreaterThanOrEqual(x.start);
        expect(x.end).toBeLessThanOrEqual(line.seconds + 0.001);
        prev = x.start;
      }
      expect(line.words[0].start).toBeGreaterThan(0.1); // the voice starts a little after zero
    },
  );
});
