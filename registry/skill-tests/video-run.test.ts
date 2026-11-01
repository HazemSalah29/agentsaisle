import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Runner = {
  ALLOWED: string[];
  scrubEnv: (env?: Record<string, string>) => Record<string, string>;
  assertAllowed: (cmd: unknown, args: unknown) => void;
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
    let seen: { cmd: string; args: string[]; opts: Record<string, any> } | undefined;
    const fake = (cmd: string, args: string[], opts: Record<string, any>) => {
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
});
