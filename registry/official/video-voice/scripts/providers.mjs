// Voice providers behind one interface: synthesize({ text, voice, speed, seed, lang, out }) writes a WAV file and
// returns { model }. The python providers run our own scripts through the runner (allow-list, argument arrays);
// the "test" provider is plain JavaScript and makes a tone, not speech, so tests and demos work offline.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { run as defaultRun } from "./run.mjs";
import { skillDir } from "./_lib.mjs";
import { wordCount } from "./script-parse.mjs";

/** A mono 16-bit PCM WAV from samples in [-1, 1]. */
export function wavBuffer(samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2),
  );
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "latin1");
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8, "latin1");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36, "latin1");
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Seconds of audio in a WAV buffer written by wavBuffer (or any plain PCM WAV), else null. */
export function wavSeconds(buf) {
  if (buf.length < 44 || buf.toString("latin1", 0, 4) !== "RIFF") return null;
  for (let at = 12, rate = 0; at + 8 <= buf.length;) {
    const id = buf.toString("latin1", at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === "fmt ") rate = buf.readUInt32LE(at + 16);
    if (id === "data") return rate ? Math.min(size, buf.length - at - 8) / rate : null;
    at += 8 + size + (size % 2);
  }
  return null;
}

const RATE = 24000;

const testProvider = {
  id: "test",
  langs: ["*"],
  defaultVoice: "tone",
  license: "none (generated tone, not speech)",
  model: "test-tone-1",
  synthesize({ text, speed, seed, out, write }) {
    const seconds = Math.max(0.4, (wordCount(text) * 0.4) / speed);
    const freq = 180 + (Number(seed) % 7) * 20;
    const n = Math.round(seconds * RATE);
    const samples = new Array(n);
    for (let i = 0; i < n; i++) {
      const fade = Math.min(1, i / 480, (n - i) / 480);
      samples[i] = 0.25 * fade * Math.sin((2 * Math.PI * freq * i) / RATE);
    }
    write(out, wavBuffer(samples, RATE));
    return { model: this.model };
  },
};

/** Run one of our python provider scripts. The text goes in through a temporary file, never an argument. */
function pythonProvider(id, file, langs, defaultVoice, license) {
  return {
    id,
    langs,
    defaultVoice,
    license,
    synthesize({ text, voice, speed, seed, out, run = defaultRun, tmp = os.tmpdir() }) {
      const dir = mkdtempSync(path.join(tmp, "video-voice-"));
      try {
        const textFile = path.join(dir, "text.txt");
        writeFileSync(textFile, text);
        const r = run("python", [
          path.join(skillDir(), "providers", file),
          "--text-file",
          textFile,
          "--out",
          out,
          "--voice",
          voice,
          "--speed",
          String(speed),
          "--seed",
          String(seed),
        ]);
        if (r.status !== 0)
          throw new Error(
            `${id} failed: ${(r.stderr || r.stdout).trim().split("\n").slice(-3).join(" | ")}`,
          );
        const last = r.stdout.trim().split("\n").at(-1) ?? "";
        let info = {};
        try {
          info = JSON.parse(last);
        } catch {
          /* the script printed no summary; the model name stays unknown */
        }
        return { model: typeof info.model === "string" ? info.model : id };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

export const PROVIDERS = {
  test: testProvider,
  kokoro: pythonProvider("kokoro", "kokoro.py", ["en"], "af_heart", "Apache-2.0 (Kokoro-82M)"),
  "3arab": pythonProvider(
    "3arab",
    "arab3.py",
    ["ar"],
    "calm adult voice, Modern Standard Arabic",
    "Apache-2.0 (3arab-TTS-500M-v2); output carries a SilentCipher watermark",
  ),
};
/** Providers the schema names but this version does not build. */
export const UNBUILT = ["chatterbox", "elevenlabs"];

/** Default provider for a language: 3arab for Arabic, kokoro otherwise. */
export const defaultProvider = (lang) => (lang?.startsWith("ar") ? "3arab" : "kokoro");
