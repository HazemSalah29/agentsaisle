import { spawnSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Tools = Record<string, { found: boolean; version?: { major: number; text?: string } | null }>;
interface Doctor {
  TOOLS: Array<{ id: string; cmd: string; args: string[] }>;
  KEY_NAMES: string[];
  parseVersion(t: string): { major: number; text: string } | null;
  hardwareTier(t: Tools): string;
  installLines(t: Tools, platform: string): string[];
  probe(tool: unknown, run: unknown): { found: boolean };
  report(a: { tools: Tools; keys: Record<string, boolean>; platform: string }): string;
}

let d: Doctor;
beforeAll(async () => {
  d = await loadScript<Doctor>("video", "scripts/doctor.mjs");
});

const all = (found: boolean, over: Tools = {}): Tools => ({
  ...Object.fromEntries(
    d.TOOLS.map((t) => [t.id, { found, version: { major: 24, text: "24.1.0" } }]),
  ),
  ...over,
});

describe("video doctor", () => {
  it("parses versions out of tool banners", () => {
    expect(d.parseVersion("ffmpeg version 7.1.1 Copyright")?.major).toBe(7);
    expect(d.parseVersion("v22.3.0")?.text).toBe("22.3.0");
    expect(d.parseVersion("no digits")).toBeNull();
  });

  it("works out the tier", () => {
    expect(d.hardwareTier(all(true, { "nvidia-smi": { found: false } }))).toBe("$0 laptop");
    expect(d.hardwareTier(all(true))).toBe("local GPU");
    expect(d.hardwareTier(all(true, { ffmpeg: { found: false } }))).toBe("not ready");
    expect(d.hardwareTier(all(true, { node: { found: true, version: { major: 18 } } }))).toBe(
      "not ready",
    );
  });

  it("suggests one install line per missing core tool, per platform", () => {
    const lines = d.installLines(
      all(true, { ffmpeg: { found: false }, ffprobe: { found: false } }),
      "darwin",
    );
    expect(lines).toEqual(["  ffmpeg: brew install ffmpeg", "  ffprobe: brew install ffmpeg"]);
    expect(d.installLines(all(true), "darwin")).toEqual([]);
    expect(
      d.installLines(all(true, { node: { found: true, version: { major: 18 } } }), "win32")[0],
    ).toContain("too old");
  });

  it("spawns only fixed argument lists without a shell", () => {
    for (const t of d.TOOLS) expect(t.args.every((a) => /^-{1,2}[a-z]+$/.test(a))).toBe(true);
    let seen: unknown;
    d.probe(
      d.TOOLS[0],
      (_c: string, _a: string[], o: unknown) => ((seen = o), { status: 0, stdout: "v24.0.0" }),
    );
    expect(seen).toMatchObject({ shell: false });
    expect(d.probe(d.TOOLS[0], () => ({ error: new Error("ENOENT"), status: null })).found).toBe(
      false,
    );
  });

  // The real doctor probes the voice and face engines, which import heavy Python libraries: allow it time.
  it("needs no API key and never prints one", { timeout: 60_000 }, () => {
    const secret = "sk-canary-1234567890";
    expect(d.KEY_NAMES).toEqual([]);
    const run = spawnSync("node", [skillFile("video", "scripts/doctor.mjs")], {
      encoding: "utf8",
      env: { ...process.env, KLING_API_KEY: secret },
    });
    expect(run.stdout + run.stderr).not.toContain(secret);
  });

  it("caps output at 40 lines", () => {
    const out = d.report({ tools: all(false), keys: {}, platform: "linux" });
    expect(out.split("\n").length).toBeLessThanOrEqual(40);
  });
});

describe("video doctor engines", () => {
  type Engines = {
    engineLines(
      cfg: Record<string, unknown>,
      o: { run: unknown; exists: (f: string) => boolean },
    ): string[];
    readToolsConfig(home: string): Record<string, unknown>;
  };
  const e = () => d as unknown as Engines;
  const fake =
    (answers: Record<string, { status: number; out?: string }>) =>
    (cmd: string, args: string[]) => {
      const key = [cmd, ...args].join(" ");
      const hit = answers[key];
      return hit
        ? { status: hit.status, stdout: hit.out ?? "", stderr: "" }
        : { status: 1, stdout: "", stderr: "" };
    };
  const cfg = {
    python: "/v/bin/python3.12",
    "whisper-cli": "/b/whisper-cli",
    whisperModel: "/m/ggml-base.bin",
    arab3: "/a",
    arab3Model: "/a/model.safetensors",
  };

  it("says everything is missing when nothing is set up", () => {
    const text = e()
      .engineLines({}, { run: fake({}), exists: () => false })
      .join("\n");
    expect(text).toMatch(/python venv not set up/);
    expect(text).toMatch(/kokoro +not set up/);
    expect(text).toMatch(/3arab-tts +not set up/);
    expect(text).toMatch(/whisper.cpp +not set up \(captions use ESTIMATED word times\)/);
  });

  it("reports each engine ready when its checks pass", () => {
    const run = fake({
      "/v/bin/python3.12 --version": { status: 0, out: "Python 3.12.4\n" },
      "/v/bin/python3.12 -c import kokoro": { status: 0 },
      "/v/bin/python3.12 -c import kokoro_onnx": { status: 0 },
      "/b/whisper-cli --help": { status: 0 },
    });
    const text = e()
      .engineLines(cfg, { run, exists: () => true })
      .join("\n");
    expect(text).toMatch(/python venv found 3\.12\.4/);
    expect(text).toMatch(/kokoro +ready \(English voice, onnx on CPU\)/);
    expect(text).toMatch(/3arab-tts +set up/);
    expect(text).toMatch(/whisper.cpp +ready \(ggml-base\.bin\)/);
  });

  it("rejects a python that is too old and a model file that is missing", () => {
    const run = fake({
      "/v/bin/python3.12 --version": { status: 0, out: "Python 3.9.6\n" },
      "/b/whisper-cli --help": { status: 0 },
    });
    const text = e()
      .engineLines(cfg, { run, exists: (f) => f !== "/m/ggml-base.bin" })
      .join("\n");
    expect(text).toMatch(/not usable \(needs 3\.10 to 3\.12\)/);
    expect(text).toMatch(/kokoro +not set up/);
    expect(text).toMatch(/whisper.cpp +not set up/);
  });

  it("ignores relative paths in the config and never runs them", () => {
    const calls: string[] = [];
    const run = (cmd: string) => (
      calls.push(cmd),
      { status: 0, stdout: "Python 3.12.0", stderr: "" }
    );
    e().engineLines(
      { python: "python3", "whisper-cli": "whisper-cli" },
      { run, exists: () => true },
    );
    expect(calls).toEqual([]);
  });

  it("reads tools.json safely", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const home = mkdtempSync(path.join(os.tmpdir(), "video-tools-"));
    expect(e().readToolsConfig(home)).toEqual({});
    mkdirSync(path.join(home, ".aisle-video"));
    writeFileSync(path.join(home, ".aisle-video", "tools.json"), '{"python":"/p/python3.12"}');
    expect(e().readToolsConfig(home)).toEqual({ python: "/p/python3.12" });
    writeFileSync(path.join(home, ".aisle-video", "tools.json"), "[1]");
    expect(e().readToolsConfig(home)).toEqual({});
    writeFileSync(path.join(home, ".aisle-video", "tools.json"), "{nope");
    expect(e().readToolsConfig(home)).toEqual({});
  });
});

describe("doctor capture line", () => {
  it("reports the screen-capture library from its package.json only", async () => {
    const { mkdirSync, mkdtempSync, writeFileSync } = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { captureLine } = await loadScript<{ captureLine(home: string): string }>(
      "video",
      "scripts/doctor.mjs",
    );
    const home = mkdtempSync(path.join(os.tmpdir(), "video-pw-"));
    expect(captureLine(home)).toMatch(/not installed.*own screen recording/);
    const dir = path.join(home, ".aisle-video", "node_modules", "playwright-core");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "package.json"), '{"name":"playwright-core","version":"1.2.3"}');
    expect(captureLine(home)).toBe("  playwright  ready 1.2.3 (screen capture for showcase)");
    writeFileSync(path.join(dir, "package.json"), "{nope");
    expect(captureLine(home)).toMatch(/unreadable/);
  });
});

describe("video doctor cache", () => {
  it("answers in one line when the last check is under a day old and was not 'not ready'", async () => {
    const { cachedLine } = await loadScript<{
      cachedLine: (c: unknown, now?: number) => string | null;
    }>("video", "scripts/doctor.mjs");
    const now = Date.parse("2026-11-02T12:00:00Z");
    const at = (h: number) => new Date(now - h * 3_600_000).toISOString();
    expect(cachedLine({ at: at(3), tier: "ready" }, now)).toContain("tier ready");
    expect(cachedLine({ at: at(3), tier: "ready" }, now)).toContain("3 h ago");
    expect(cachedLine({ at: at(25), tier: "ready" }, now)).toBeNull(); // too old
    expect(cachedLine({ at: at(3), tier: "not ready" }, now)).toBeNull(); // always look again when it was broken
    expect(cachedLine({ at: at(-2), tier: "ready" }, now)).toBeNull(); // from the future
    expect(cachedLine({ tier: "ready" }, now)).toBeNull();
    expect(cachedLine(null, now)).toBeNull();
  });
});
