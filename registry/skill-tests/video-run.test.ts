import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type Runner = {
  ALLOWED: string[];
  scrubEnv: (env?: Record<string, string>) => Record<string, string>;
  assertAllowed: (cmd: unknown, args: unknown) => void;
  resolveCommand: (cmd: string, home?: string) => string;
  run: (
    cmd: string,
    args: string[],
    opts?: Record<string, unknown>,
  ) => { status: number | null; stdout: string; stderr: string };
};

const load = () => loadScript<Runner>("video-core", "scripts/run.mjs");

describe("video-core runner", () => {
  it("refuses programs that are not on the allow-list", async () => {
    const { run } = await load();
    for (const cmd of ["curl", "sh", "bash", "rm", "python3", "/usr/bin/ffmpeg", "ffmpeg; ls"])
      expect(() => run(cmd, [])).toThrow(/not an allowed program/);
  });

  it("refuses shell strings and non-string arguments", async () => {
    const { assertAllowed } = await load();
    expect(() => assertAllowed("ffmpeg", "-version" as unknown as string[])).toThrow(
      /array of strings/,
    );
    expect(() => assertAllowed("ffmpeg", ["-i", 5 as unknown as string])).toThrow(
      /array of strings/,
    );
    expect(() => assertAllowed("ffmpeg", ["a\0b"])).toThrow(/array of strings/);
  });

  it("lets node run only an absolute script file", async () => {
    const { assertAllowed } = await load();
    for (const args of [["-e", "1"], ["--eval=1"], ["-p", "1"], ["script.mjs"], ["/tmp/x.txt"], []])
      expect(() => assertAllowed("node", args)).toThrow(/node may only run/);
    expect(() => assertAllowed("node", ["/abs/path/render.mjs", "--flag"])).not.toThrow();
  });

  it("spawns without a shell, with the arguments untouched and a time limit", async () => {
    const { run } = await load();
    let seen: { cmd: string; args: string[]; opts: Loose } | undefined;
    const fake = (cmd: string, args: string[], opts: Loose) => {
      seen = { cmd, args, opts };
      return { status: 0, stdout: "ok", stderr: "" };
    };
    const r = run("ffprobe", ["-v", "error", "a b; rm -rf /.wav"], {
      spawn: fake,
      timeoutMs: 5000,
    });
    expect(r.stdout).toBe("ok");
    expect(seen?.opts.shell).toBe(false);
    expect(seen?.opts.timeout).toBe(5000);
    expect(seen?.args).toEqual(["-v", "error", "a b; rm -rf /.wav"]);
  });

  it("removes credential-looking variables, so a canary key never reaches a child or its output", async () => {
    const { run, scrubEnv } = await load();
    const canary = "CANARY-" + "z".repeat(24);
    const env = {
      PATH: process.env.PATH ?? "",
      KLING_API_KEY: canary,
      GITHUB_TOKEN: canary,
      HOME: "/h",
    };
    expect(Object.keys(scrubEnv(env)).sort()).toEqual(["HOME", "PATH"]);
    const dump = path.join(mkdtempSync(path.join(os.tmpdir(), "video-run-")), "dump.mjs");
    writeFileSync(dump, "console.log(JSON.stringify(process.env));");
    const r = run("node", [dump], { env });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain(canary);
    expect(r.stdout).toContain("/h");
  });

  it("runs an allowed program for real", async () => {
    const { run } = await load();
    const r = run("node", [skillFile("video-core", "scripts/check.mjs")]);
    expect(r.status).toBe(2); // check.mjs with no argument prints usage and exits 2
    expect(r.stderr).toMatch(/Usage/);
  });

  it("lets python run only a .py file inside a video skill folder", async () => {
    const { assertAllowed } = await load();
    const own = skillFile("video-core", "scripts/x.py");
    expect(() => assertAllowed("python", [own, "--arg"])).not.toThrow();
    expect(() =>
      assertAllowed("python", [skillFile("video-voice", "providers/tts_kokoro.py")]),
    ).not.toThrow();
    for (const args of [
      ["-c", "print(1)"],
      ["-m", "http.server"],
      ["x.py"],
      ["/tmp/x.py"],
      [skillFile("arch-visualize", "scripts/x.py")],
      [skillFile("video-core", "../../../etc/x.py")],
      [skillFile("video-core", "scripts/x.txt")],
      [],
    ])
      expect(() => assertAllowed("python", args)).toThrow(/python may only run/);
    expect(() => assertAllowed("python3", [own])).toThrow(/not an allowed program/);
  });

  it("allows whisper-cli with an argument array", async () => {
    const { assertAllowed } = await load();
    expect(() => assertAllowed("whisper-cli", ["-m", "model.bin", "-f", "a.wav"])).not.toThrow();
    expect(() => assertAllowed("whisper-cli", "-m x" as unknown as string[])).toThrow(
      /array of strings/,
    );
  });

  it("takes python and whisper-cli paths from tools.json only when they look right", async () => {
    const { resolveCommand } = await load();
    const home = mkdtempSync(path.join(os.tmpdir(), "video-tools-"));
    expect(resolveCommand("python", home)).toBe("python3");
    expect(resolveCommand("ffmpeg", home)).toBe("ffmpeg");
    mkdirSync(path.join(home, ".aisle-video"));
    const write = (o: unknown) =>
      writeFileSync(path.join(home, ".aisle-video", "tools.json"), JSON.stringify(o));
    write({ python: "/v/bin/python3.12", "whisper-cli": "/b/whisper-cli" });
    expect(resolveCommand("python", home)).toBe("/v/bin/python3.12");
    expect(resolveCommand("whisper-cli", home)).toBe("/b/whisper-cli");
    write({ python: "/bin/sh", "whisper-cli": "relative/whisper-cli" });
    expect(resolveCommand("python", home)).toBe("python3");
    expect(resolveCommand("whisper-cli", home)).toBe("whisper-cli");
    writeFileSync(path.join(home, ".aisle-video", "tools.json"), "{ not json");
    expect(resolveCommand("python", home)).toBe("python3");
  });
});
