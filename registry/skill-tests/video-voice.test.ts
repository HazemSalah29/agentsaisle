import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Providers = {
  PROVIDERS: Record<string, Loose>;
  wavSeconds: (b: Buffer) => number | null;
  defaultProvider: (l: string) => string;
};
type Voice = { cloneRefusal: (o: Loose, exists?: (f: string) => boolean) => string | null };

const SCRIPT =
  "# t\n[l1] Hello there friend.\n  beat: hook\n[l2] One two three four five six.\n  beat: step\n";
const script = (dir: string) => path.join(dir, "script.md");
const project = (text = SCRIPT, video?: Loose) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "video-voice-"));
  writeFileSync(script(dir), text);
  if (video) writeFileSync(path.join(dir, "video.json"), JSON.stringify(video));
  return dir;
};
const voice = (dir: string, ...args: string[]) =>
  spawnSync(
    "node",
    [skillFile("video-voice", "scripts/voice.mjs"), dir, "--provider", "test", ...args],
    { encoding: "utf8" },
  );
const manifest = (dir: string) =>
  JSON.parse(readFileSync(path.join(dir, "voice", "manifest.json"), "utf8"));

describe("video-voice test provider", () => {
  it("makes a tone whose length follows the word count and speed, the same bytes every time", async () => {
    const { PROVIDERS, wavSeconds } = await loadScript<Providers>(
      "video-voice",
      "scripts/providers.mjs",
    );
    const make = (text: string, speed = 1, seed = 1) => {
      let buf: Buffer = Buffer.alloc(0);
      PROVIDERS.test!.synthesize({
        text,
        speed,
        seed,
        out: "x",
        write: (_f: string, b: Buffer) => (buf = b),
      });
      return buf;
    };
    expect(wavSeconds(make("one two three four five"))).toBeCloseTo(2, 3);
    expect(wavSeconds(make("one two three four five", 2))).toBeCloseTo(1, 3);
    expect(wavSeconds(make("hi"))).toBeCloseTo(0.4, 3);
    expect(make("same words").equals(make("same words"))).toBe(true);
    expect(make("same words", 1, 1).equals(make("same words", 1, 2))).toBe(false);
  });

  it("picks 3arab for Arabic and kokoro otherwise", async () => {
    const { defaultProvider } = await loadScript<Providers>("video-voice", "scripts/providers.mjs");
    expect([
      defaultProvider("ar"),
      defaultProvider("ar-EG"),
      defaultProvider("en"),
      defaultProvider("fr"),
    ]).toEqual(["3arab", "3arab", "kokoro", "kokoro"]);
  });
});

describe("video-voice python providers", () => {
  it("run our script through the runner with an argument array and the text in a temp file", async () => {
    const { PROVIDERS } = await loadScript<Providers>("video-voice", "scripts/providers.mjs");
    const calls: { cmd: string; args: string[]; text: string }[] = [];
    const run = (cmd: string, args: string[]) => {
      calls.push({ cmd, args, text: readFileSync(args[args.indexOf("--text-file") + 1]!, "utf8") });
      return { status: 0, stdout: 'log\n{"model":"kokoro-82m"}\n', stderr: "" };
    };
    const r = PROVIDERS.kokoro!.synthesize({
      text: 'rm -rf / ; $(x) "quoted"',
      voice: "af_heart",
      speed: 1,
      seed: 3,
      out: "/o.wav",
      run,
    });
    expect(r.model).toBe("kokoro-82m");
    const c = calls[0]!;
    expect(c.cmd).toBe("python");
    expect(c.args[0]).toBe(skillFile("video-voice", "providers/kokoro.py"));
    expect(c.args.join(" ")).not.toContain("rm -rf");
    expect(c.text).toBe('rm -rf / ; $(x) "quoted"');
    expect(existsSync(c.args[c.args.indexOf("--text-file") + 1]!)).toBe(false); // removed afterwards
  });

  it("report a failing script with its last lines", async () => {
    const { PROVIDERS } = await loadScript<Providers>("video-voice", "scripts/providers.mjs");
    const run = () => ({ status: 1, stdout: "", stderr: "a\nb\nImportError: no kokoro" });
    expect(() =>
      PROVIDERS.kokoro!.synthesize({ text: "x", voice: "v", speed: 1, seed: 1, out: "o", run }),
    ).toThrow(/kokoro failed: .*ImportError: no kokoro/);
  });
});

describe("video-voice run", () => {
  it("writes one wav per line, a manifest with hashes, and records the choice in video.json", () => {
    const dir = project(SCRIPT, { version: 1, meta: { lang: "en" }, scenes: [] });
    const r = voice(dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Voiced 2 line\(s\), kept 0/);
    expect(r.stdout).toMatch(/a tone, not speech/);
    const m = manifest(dir);
    expect(m).toMatchObject({
      version: 1,
      provider: "test",
      voice: "tone",
      speed: 1,
      seed: 1,
      model: "test-tone-1",
    });
    expect(Object.keys(m.lines)).toEqual(["l1", "l2"]);
    expect(m.lines.l1.seconds).toBeCloseTo(1.2, 2);
    expect(m.lines.l1.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(existsSync(path.join(dir, "voice", "l2.wav"))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8")).voice).toEqual({
      provider: "test",
      voiceId: "tone",
      speed: 1,
    });
  });

  it("keeps lines that did not change, re-voices only the edited one, and --force redoes all", () => {
    const dir = project();
    voice(dir);
    expect(voice(dir).stdout).toMatch(/Voiced 0 line\(s\), kept 2/);
    writeFileSync(script(dir), SCRIPT.replace("Hello there friend.", "Hello there my friend."));
    const r = voice(dir);
    expect(r.stdout).toMatch(/\+ l1/);
    expect(r.stdout).toMatch(/Voiced 1 line\(s\), kept 1/);
    expect(voice(dir, "--force").stdout).toMatch(/Voiced 2 line\(s\)/);
    expect(voice(dir, "--only", "l2", "--force").stdout).toMatch(/Voiced 1 line\(s\), kept 1/);
    expect(voice(dir, "--speed", "2").stdout).toMatch(/Voiced 2 line\(s\)/); // new speed, new key
  });

  it("never lets an environment key reach the output, the manifest or video.json", () => {
    const dir = project(SCRIPT, { version: 1, meta: { lang: "en" }, scenes: [] });
    const canary = "CANARY-" + "q".repeat(24);
    const r = spawnSync(
      "node",
      [skillFile("video-voice", "scripts/voice.mjs"), dir, "--provider", "test"],
      { encoding: "utf8", env: { ...process.env, ELEVENLABS_API_KEY: canary } },
    );
    const all =
      r.stdout +
      r.stderr +
      readFileSync(path.join(dir, "voice", "manifest.json"), "utf8") +
      readFileSync(path.join(dir, "video.json"), "utf8");
    expect(all).not.toContain(canary);
  });

  it("refuses Arabic lines with digits, a provider for the wrong language, and unbuilt providers", () => {
    const ar = project("[l1] واجهتك تحتاج 3 حدود\n  beat: hook\n", {
      version: 1,
      meta: { lang: "ar" },
      scenes: [],
    });
    const a = voice(ar);
    expect(a.status).toBe(1);
    expect(a.stderr).toMatch(/Arabic lines with digits \(l1\)/);
    const wrong = project(SCRIPT, { version: 1, meta: { lang: "ar" }, scenes: [] });
    const w = spawnSync(
      "node",
      [skillFile("video-voice", "scripts/voice.mjs"), wrong, "--provider", "kokoro"],
      { encoding: "utf8" },
    );
    expect(w.status).toBe(1);
    expect(w.stderr).toMatch(/speaks en, not "ar"/);
    const un = spawnSync(
      "node",
      [skillFile("video-voice", "scripts/voice.mjs"), project(), "--provider", "elevenlabs"],
      { encoding: "utf8" },
    );
    expect(un.stderr).toMatch(/not built yet/);
    const none = spawnSync(
      "node",
      [skillFile("video-voice", "scripts/voice.mjs"), project(), "--provider", "nope"],
      { encoding: "utf8" },
    );
    expect(none.stderr).toMatch(/Unknown provider/);
  });

  it("rejects a script that is not valid", () => {
    const r = voice(project("stray text\n[l1] ok\n"));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/script\.md:1 {2}not a script line/);
  });
});

describe("video-voice consent gate", () => {
  it("refuses --clone without consent, with a missing consent file, and even with consent (no cloning provider yet)", async () => {
    const { cloneRefusal } = await loadScript<Voice>("video-voice", "scripts/voice.mjs");
    expect(cloneRefusal({})).toBeNull();
    expect(cloneRefusal({ clone: "me.wav" })).toMatch(
      /needs consent.*Public figures are never cloned/,
    );
    expect(cloneRefusal({ clone: "me.wav", consent: "c.txt" }, () => false)).toMatch(
      /consent file "c.txt" does not exist/,
    );
    expect(cloneRefusal({ clone: "me.wav", consent: "self" })).toMatch(
      /No voice provider in this version can clone/,
    );
    expect(cloneRefusal({ clone: "me.wav", consent: "c.txt" }, () => true)).toMatch(/can clone/);
  });

  it("stops the process before any audio is made", () => {
    const dir = project();
    const run = (...a: string[]) =>
      spawnSync(
        "node",
        [skillFile("video-voice", "scripts/voice.mjs"), dir, "--provider", "test", ...a],
        { encoding: "utf8" },
      );
    expect(run("--clone", "me.wav").status).toBe(1);
    expect(run("--clone", "me.wav", "--consent", "self").status).toBe(1);
    expect(existsSync(path.join(dir, "voice"))).toBe(false);
  });
});

describe("video-voice copies", () => {
  it("keeps shared files identical to their originals", () => {
    const same = (_skill: string, from: string, file: string) =>
      expect(readFileSync(skillFile("video-voice", file), "utf8")).toBe(
        readFileSync(skillFile(from, file), "utf8"),
      );
    same("video-voice", "video-core", "scripts/_lib.mjs");
    same("video-voice", "video-core", "scripts/run.mjs");
    same("video-voice", "video-write", "scripts/script-parse.mjs");
  });
});
