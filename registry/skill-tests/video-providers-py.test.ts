import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skillFile } from "./load";

const hasPython = spawnSync("python3", ["--version"]).status === 0;
const PROVIDERS = ["tts_kokoro.py", "tts_arab3.py"];

describe.each(PROVIDERS)("python provider %s: source", (file) => {
  const src = readFileSync(skillFile("video-voice", `providers/${file}`), "utf8");

  it("never fetches, shells out or evaluates text", () => {
    for (const bad of [
      /\burllib\b/,
      /\brequests\b/,
      /\bsocket\b/,
      /\bsubprocess\b/,
      /os\.system/,
      /\beval\(/,
      /\bexec\(/,
      /https?:\/\//,
      /\bpickle\b/,
    ])
      expect(src, String(bad)).not.toMatch(bad);
  });

  it("forces offline mode before importing any model library", () => {
    const offline = src.indexOf('os.environ["HF_HUB_OFFLINE"] = "1"');
    expect(offline).toBeGreaterThan(-1);
    const firstImport = [src.indexOf("from kokoro"), src.indexOf("import infer")].filter(
      (i) => i > -1,
    )[0]!;
    expect(offline).toBeLessThan(firstImport);
  });

  it("takes the text from a file, never from an argument", () => {
    expect(src).toMatch(/--text-file/);
    expect(src).not.toMatch(/add_argument\("--text"/);
  });
});

describe.skipIf(!hasPython)("python provider tts_kokoro.py: arguments", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "video-py-"));
  const text = path.join(dir, "t.txt");
  writeFileSync(text, "Hello");
  const run = (...a: string[]) =>
    spawnSync(
      "python3",
      [
        skillFile("video-voice", "providers/tts_kokoro.py"),
        "--text-file",
        text,
        "--out",
        path.join(dir, "o.wav"),
        ...a,
      ],
      { encoding: "utf8" },
    );

  it("refuses a voice that is a path, and a speed out of range, before loading anything", () => {
    const v = run("--voice", "../../etc/passwd");
    expect(v.status).toBe(2);
    expect(v.stderr).toMatch(/voice must be an id like af_heart/);
    expect(run("--voice", "af_heart", "--speed", "9").status).toBe(2);
    expect(run("--voice", "/tmp/x.pt").status).toBe(2);
  });

  it("exits 3 with a clear message when kokoro is not installed (or 0/4 when it is)", () => {
    const r = run("--voice", "af_heart");
    if (r.status === 3) expect(r.stderr).toMatch(/kokoro is not installed in this Python/);
    else expect([0, 4]).toContain(r.status);
  });

  it("needs its arguments", () => {
    const r = spawnSync("python3", [skillFile("video-voice", "providers/tts_kokoro.py")], {
      encoding: "utf8",
    });
    expect(r.status).toBe(2);
  });
});

describe.skipIf(!hasPython)("python provider tts_arab3.py: arguments", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "video-py-"));
  const text = path.join(dir, "t.txt");
  writeFileSync(text, "مرحبا");
  const home = mkdtempSync(path.join(os.tmpdir(), "home-"));
  const run = (...a: string[]) =>
    spawnSync(
      "python3",
      [
        skillFile("video-voice", "providers/tts_arab3.py"),
        "--text-file",
        text,
        "--out",
        path.join(dir, "o.wav"),
        ...a,
      ],
      { encoding: "utf8", env: { ...process.env, HOME: home } },
    );

  it("wants the voice described in Arabic, of a sensible length", () => {
    const latin = run("--voice", "calm adult woman");
    expect(latin.status).toBe(2);
    expect(latin.stderr).toMatch(/voice must be described in Arabic/);
    expect(run("--voice", "ص").status).toBe(2);
    expect(run("--voice", "ص".repeat(200)).status).toBe(2);
    expect(run("--voice", "صوت هادئ", "--speed", "3").status).toBe(2);
  });

  it("exits 3 and says what is missing when it is not set up", () => {
    const r = run("--voice", "صوت هادئ وواضح");
    expect(r.status).toBe(3);
    expect(r.stderr).toMatch(/3arab-tts is not set up: tools\.json needs arab3 .* and arab3Model/);
  });
});
