import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const FIXTURE = skillFile("arch-visualize", "evals/fixture-model.json");
const run = (args: string[]) =>
  spawnSync(process.execPath, [skillFile("video-tour", "scripts/tour.mjs"), ...args], {
    encoding: "utf8",
    env: { ...process.env, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
  });
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "video-tour-"));

describe("video-tour copies", () => {
  it("keeps byte-identical copies of the importer and helpers", () => {
    const same = (skill: string, a: string, b: string) =>
      expect(readFileSync(skillFile("video-tour", a), "utf8")).toBe(
        readFileSync(skillFile(skill, b), "utf8"),
      );
    same("video-core", "scripts/_arch-import.mjs", "assets/arch/import.mjs");
    same("video-core", "scripts/_lib.mjs", "scripts/_lib.mjs");
  });
});

describe("tour.mjs", () => {
  it("writes a project whose steps all come from the model", () => {
    const out = path.join(tmp(), "t");
    const r = run(["--model", FIXTURE, "--out", out]);
    expect(r.status).toBe(0);
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(40);
    const video = JSON.parse(readFileSync(path.join(out, "video.json"), "utf8")) as Loose;
    const kinds = video.scenes.map((s: Loose) => s.kind);
    expect(kinds[0]).toBe("title");
    expect(kinds).toContain("request-flow");
    const script = readFileSync(path.join(out, "script.md"), "utf8");
    const facts = readFileSync(path.join(out, "facts.md"), "utf8");
    for (const s of video.scenes) for (const l of s.narration) expect(script).toContain(`[${l}]`);
    for (const m of script.matchAll(/fact: (f\d+)/g)) expect(facts).toContain(`[${m[1]}]`);
    expect(facts).toMatch(/docker-compose\.yml:\d+/);
  });

  it("is deterministic and refuses to overwrite", () => {
    const a = path.join(tmp(), "a");
    const b = path.join(tmp(), "b");
    run(["--model", FIXTURE, "--out", a, "--flows", "checkout"]);
    run(["--model", FIXTURE, "--out", b, "--flows", "checkout"]);
    expect(readFileSync(path.join(a, "video.json"), "utf8")).toBe(
      readFileSync(path.join(b, "video.json"), "utf8"),
    );
    const again = run(["--model", FIXTURE, "--out", a]);
    expect(again.status).toBe(2);
    expect(again.stderr).toContain("exists");
  });

  it("rejects unknown flows, bad models and bad options without writing", () => {
    const out = path.join(tmp(), "x");
    expect(run(["--model", FIXTURE, "--out", out, "--flows", "nope"]).status).toBe(2);
    const bad = path.join(tmp(), "m.json");
    writeFileSync(bad, JSON.stringify({ version: 9 }));
    expect(run(["--model", bad, "--out", out]).status).toBe(2);
    expect(run(["--model", FIXTURE, "--out", out, "--max-flows", "99"]).status).toBe(2);
    expect(existsSync(out)).toBe(false);
  });

  it("strips control and bidi characters from labels", async () => {
    const { buildTour } = await loadScript<{
      buildTour: (m: Loose, o: Loose) => { script: string };
    }>("video-tour", "scripts/tour.mjs");
    const model = JSON.parse(readFileSync(FIXTURE, "utf8")) as Loose;
    model.nodes[0].label = `Evil‮\u0007node`;
    model.project = { name: `P‮x` };
    const flows = [model.flows[0]];
    const { script } = buildTour(model, { flows });
    const unsafe = new RegExp("[\\p{Cc}\\u202a-\\u202e]", "u");
    expect(unsafe.test(script.replace(/\n/g, ""))).toBe(false);
  });
});
