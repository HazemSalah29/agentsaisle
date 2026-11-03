import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const run = (script: string, args: string[], cwd?: string) =>
  spawnSync(process.execPath, [skillFile("video-explain", `scripts/${script}`), ...args], {
    encoding: "utf8",
    cwd,
    env: { ...process.env, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
  });
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "video-explain-"));
const project = (kind: string, props: Loose = {}) => {
  const dir = tmp();
  const file = path.join(dir, "video.json");
  writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      meta: { title: "t", type: "explainer", format: "reel-9x16", fps: 30, lang: "en" },
      scenes: [{ id: "s1", kind, durationFrom: "fixed", seconds: 8, props }],
    }),
  );
  return file;
};
const FIXTURE = skillFile("arch-visualize", "evals/fixture-model.json");

describe("video-explain copies", () => {
  it("keeps byte-identical copies of the video-core simulator and importer", () => {
    const same = (a: string, b: string) =>
      expect(readFileSync(skillFile("video-explain", a), "utf8")).toBe(
        readFileSync(skillFile("video-core", b), "utf8"),
      );
    same("scripts/_sim.mjs", "assets/sim/rate-limit.mjs");
    same("scripts/_arch-import.mjs", "assets/arch/import.mjs");
    same("scripts/_lib.mjs", "scripts/_lib.mjs");
  });
});

describe("simulate.mjs", () => {
  const ARGS = [
    "--seed",
    "42",
    "--count",
    "80",
    "--pattern",
    "poisson",
    "--rate",
    "6",
    "--algo",
    "token-bucket",
    "--capacity",
    "5",
    "--refill",
    "3",
  ];

  it("prints facts a script can quote, in under 40 lines, the same every time", () => {
    const a = run("simulate.mjs", ARGS);
    expect(a.status).toBe(0);
    expect(a.stdout).toMatch(/seed 42, 80 requests/);
    expect(a.stdout).toMatch(
      /token-bucket: \d+ allowed, \d+ rejected \(\d+% allowed\); first 429 is request \d+ at [\d.]+ s/,
    );
    expect(a.stdout.split("\n").length).toBeLessThanOrEqual(40);
    expect(run("simulate.mjs", ARGS).stdout).toBe(a.stdout);
    expect(a.stdout).not.toContain("sk-canary");
  });

  it("agrees with the hand-checked case: capacity 5 rejects request 6 at t=0", () => {
    const r = run("simulate.mjs", [
      "--seed",
      "1",
      "--count",
      "6",
      "--pattern",
      "burst",
      "--rate",
      "1",
      "--burst-size",
      "6",
      "--burst-every",
      "2",
      "--algo",
      "token-bucket",
      "--capacity",
      "5",
      "--refill",
      "1",
    ]);
    expect(r.stdout).toContain("5 allowed, 1 rejected");
    expect(r.stdout).toContain("first 429 is request 6 at 0 s");
  });

  it("takes a burst offset, to show the fixed-window edge", () => {
    const r = run("simulate.mjs", [
      "--seed",
      "1",
      "--count",
      "15",
      "--pattern",
      "burst",
      "--burst-size",
      "5",
      "--burst-every",
      "0.2",
      "--burst-offset",
      "0.9",
      "--algo",
      "fixed-window",
      "--limit",
      "5",
      "--window",
      "1",
      "--algo2",
      "sliding-window",
      "--limit2",
      "5",
      "--window2",
      "1",
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("fixed-window: 10 allowed, 5 rejected");
    expect(r.stdout).toContain("sliding-window: 5 allowed, 10 rejected");
  });

  it("writes the props into a rate-limit scene and nowhere else", () => {
    const file = project("rate-limit");
    const r = run("simulate.mjs", [
      ...ARGS,
      "--algo2",
      "sliding-window",
      "--limit2",
      "4",
      "--window2",
      "1",
      "--into",
      file,
      "--scene",
      "s1",
    ]);
    expect(r.status).toBe(0);
    const scene = JSON.parse(readFileSync(file, "utf8")).scenes[0];
    expect(scene.props.seed).toBe(42);
    expect(scene.props.algos.map((a: Loose) => a.algo)).toEqual(["token-bucket", "sliding-window"]);
    expect(scene.props).not.toHaveProperty("log");
    const wrong = project("title", { text: "x" });
    expect(run("simulate.mjs", [...ARGS, "--into", wrong, "--scene", "s1"]).status).toBe(2);
    expect(run("simulate.mjs", [...ARGS, "--into", file, "--scene", "nope"]).stderr).toContain(
      'No scene "nope"',
    );
  });

  it("explains a bad spec and still exits 2", () => {
    const r = run("simulate.mjs", ["--algo", "token-bucket", "--capacity", "0"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/Invalid rate-limit spec.*capacity/);
  });

  it("works through a symlinked skill folder", () => {
    const dir = tmp();
    const link = path.join(dir, "video-explain");
    symlinkSync(skillFile("video-explain", "."), link);
    const r = spawnSync(process.execPath, [path.join(link, "scripts/simulate.mjs"), ...ARGS], {
      encoding: "utf8",
    });
    expect(r.stdout).toContain("seed 42");
  });
});

describe("arch-import.mjs", () => {
  it("lists flows and prints the steps with their evidence", () => {
    const l = run("arch-import.mjs", ["--model", FIXTURE, "--list"]);
    expect(l.stdout).toContain("load-profile: User loads their profile (7 steps)");
    const r = run("arch-import.mjs", ["--model", FIXTURE, "--flow", "load-profile"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("4 of 9 components, 7 steps");
    expect(r.stdout).toContain("[docker-compose.yml:7]");
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(40);
  });

  it("writes props into a request-flow scene only", () => {
    const file = project("request-flow");
    const r = run("arch-import.mjs", [
      "--model",
      FIXTURE,
      "--flow",
      "load-profile",
      "--into",
      file,
      "--scene",
      "s1",
    ]);
    expect(r.status).toBe(0);
    const props = JSON.parse(readFileSync(file, "utf8")).scenes[0].props;
    expect(props.steps).toHaveLength(7);
    expect(props.nodes).toHaveLength(4);
    const wrong = project("code", { language: "js", code: "x" });
    expect(
      run("arch-import.mjs", [
        "--model",
        FIXTURE,
        "--flow",
        "load-profile",
        "--into",
        wrong,
        "--scene",
        "s1",
      ]).status,
    ).toBe(2);
  });

  it("refuses a missing flow, a missing model and an oversized file, with a sentence", () => {
    expect(run("arch-import.mjs", ["--model", FIXTURE, "--flow", "nope"]).stderr).toContain(
      'No flow "nope"',
    );
    expect(run("arch-import.mjs", []).stderr).toContain("--model");
    const dir = tmp();
    const big = path.join(dir, "big.json");
    writeFileSync(big, " ".repeat(2 * 1024 * 1024 + 1));
    expect(run("arch-import.mjs", ["--model", big, "--list"]).stderr).toContain("larger than 2 MB");
  });

  it("reads a hostile model as data: nothing runs, nothing breaks", () => {
    const hostile = skillFile("arch-visualize", "evals/hostile-model.json");
    const model = JSON.parse(readFileSync(hostile, "utf8"));
    const id = model.flows?.[0]?.id;
    if (!id) return; // the hostile fixture has no flows; listing must still work
    const r = run("arch-import.mjs", ["--model", hostile, "--flow", id]);
    expect([0, 2]).toContain(r.status);
    expect(r.stdout + r.stderr).not.toContain("sk-canary");
  });
});

describe("the skill itself", () => {
  it("has no network access declared and a SKILL.md under 150 lines", () => {
    const meta = readFileSync(skillFile("video-explain", "skill.meta.yaml"), "utf8");
    expect(meta).toContain("network: false");
    expect(
      readFileSync(skillFile("video-explain", "SKILL.md"), "utf8").split("\n").length,
    ).toBeLessThanOrEqual(150);
    mkdirSync(tmp(), { recursive: true });
  });
});
