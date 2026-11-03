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
const hasArab =
  hasKokoro &&
  typeof cfg.arab3 === "string" &&
  existsSync(cfg.arab3) &&
  typeof cfg.arab3Model === "string" &&
  existsSync(cfg.arab3Model) &&
  spawnSync(cfg.python, ["-c", "import silentcipher, dacvae, peft"]).status === 0;
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

describe.skipIf(!hasArab)("real 3arab-TTS Arabic voice", () => {
  it(
    "speaks Arabic at 48 kHz and the output carries the model's watermark",
    { timeout: 600_000 },
    () => {
      const dir = project("[l1] مرحبا بكم في هذا الفيديو القصير.\n  beat: hook\n");
      writeFileSync(
        path.join(dir, "video.json"),
        JSON.stringify({ version: 1, meta: { lang: "ar" }, scenes: [] }),
      );
      const r = step("video-voice", "voice.mjs", dir, "--provider", "3arab");
      expect(r.status, r.stderr).toBe(0);
      const m = JSON.parse(readFileSync(path.join(dir, "voice", "manifest.json"), "utf8"));
      expect(m).toMatchObject({
        provider: "3arab",
        model: "sherif1313/3arab-TTS-500M-v2-VoiceDesign",
      });
      expect(m.lines.l1.seconds).toBeGreaterThan(1.5);
      const file = path.join(dir, "voice", "l1.wav");
      expect(readFileSync(file).readUInt32LE(24)).toBe(48000);
      // decode the watermark back out of the file (offline: the model files are already cached)
      const code = `import os; os.environ["HF_HUB_OFFLINE"]="1"
import silentcipher, soundfile as sf
m = silentcipher.get_model(model_type="44.1k", device="cpu")
a, sr = sf.read(${JSON.stringify(file)}, dtype="float32")
r = m.decode_wav(a, sr, phase_shift_decoding=False)
print("WM", r.get("status"), r.get("messages"))`;
      const d = spawnSync(cfg.python, ["-c", code], { encoding: "utf8" });
      expect(d.stdout).toMatch(/WM True \[\[73, 82, 68, 84, 83\]\]/);
    },
  );

  it("refuses an English voice description", () => {
    const dir = project("[l1] مرحبا\n  beat: hook\n");
    writeFileSync(
      path.join(dir, "video.json"),
      JSON.stringify({ version: 1, meta: { lang: "ar" }, scenes: [] }),
    );
    const r = step("video-voice", "voice.mjs", dir, "--provider", "3arab", "--voice", "calm woman");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/voice must be described in Arabic/);
  });
});
