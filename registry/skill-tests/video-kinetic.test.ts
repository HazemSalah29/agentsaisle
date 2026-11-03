import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const plan = () => loadScript<Loose>("video-kinetic", "scripts/_plan.mjs");
const presets = () =>
  JSON.parse(readFileSync(skillFile("video-kinetic", "assets/presets.json"), "utf8")) as Loose;
const same = (a: [string, string], b: [string, string]) =>
  expect(readFileSync(skillFile(...a), "utf8")).toBe(readFileSync(skillFile(...b), "utf8"));
const L = (id: string, text: string, attrs: Loose = {}) => ({ id, text, attrs });
const lines = [
  L("l1", "Check a skill before you trust it."),
  L("l2", "Skills are scripts your agent follows."),
  L("l3", "Never runs it.", { card: "Audit|Reads as text=ok;Never runs it=ok" }),
  L("l4", "One command.", {}),
  L("l5", "Run an audit today.", { flow: "add>audit>install", transition: "zoom-through" }),
];
const run = (script: string, args: string[], cwd?: string) =>
  spawnSync(process.execPath, [skillFile("video-kinetic", `scripts/${script}`), ...args], {
    encoding: "utf8",
    cwd,
  });

describe("video-kinetic copies", () => {
  it("keeps byte-identical copies", () => {
    same(["video-kinetic", "scripts/_lib.mjs"], ["video-core", "scripts/_lib.mjs"]);
    same(
      ["video-kinetic", "scripts/_script-parse.mjs"],
      ["video-voice", "scripts/script-parse.mjs"],
    );
  });
});

describe("planKinetic", () => {
  it("makes one kinetic scene per line with the user's lines as narration and a transition into each beat", async () => {
    const { planKinetic } = await plan();
    const r = planKinetic(lines, { preset: "ember", title: "T" }, presets());
    expect(r.video.scenes.map((s: Loose) => s.narration)).toEqual([
      ["l1"],
      ["l2"],
      ["l3"],
      ["l4"],
      ["l5"],
    ]);
    expect(r.video.scenes.every((s: Loose) => s.kind === "kinetic")).toBe(true);
    expect(r.video.scenes[0].transitionIn).toBeUndefined();
    expect(r.video.scenes[1].transitionIn).toBe("slash");
    expect(r.video.scenes[4].transitionIn).toBe("zoom-through"); // the user's choice wins
    expect(r.video.scenes[2].props.cards[0].rows).toEqual([
      { text: "Reads as text", tag: "ok" },
      { text: "Never runs it", tag: "ok" },
    ]);
    expect(r.video.scenes[4].props.flow.nodes).toEqual(["add", "audit", "install"]);
    expect(r.brand.colors.accent).toBe("#ee4f12");
    expect(JSON.stringify(r.video)).not.toMatch(/best|#1|guarantee/i);
  });
  it("uses a slab for short lines now and then and never invents cards or flows", async () => {
    const { planKinetic } = await plan();
    const many = Array.from({ length: 9 }, (_, i) =>
      L(`l${i + 1}`, i % 2 ? "Short line." : "A longer line with some words in it."),
    );
    const r = planKinetic(many, { preset: "volt" }, presets());
    const slabs = r.video.scenes.filter((s: Loose) => s.props.bg === "accent");
    expect(slabs.length).toBeGreaterThanOrEqual(1);
    expect(r.video.scenes[0].props.bg).toBe("black");
    expect(r.video.scenes.at(-1).props.bg).toBe("black");
    for (const s of r.video.scenes) expect(s.props.cards ?? s.props.flow).toBeUndefined();
  });
  it("picks a key word when none is named, and the user's words when given", async () => {
    const { autoEmph, planKinetic } = await plan();
    expect(autoEmph("It reads everything quickly")).toEqual(["everything"]);
    expect(autoEmph("It is on")).toEqual([]);
    const r = planKinetic(
      [L("l1", "Never runs it", { emph: "never,runs" }), L("l2", "Fine.")],
      { preset: "ice" },
      presets(),
    );
    expect(r.video.scenes[0].props.emph).toEqual(["never", "runs"]);
  });
  it("refuses bad input", async () => {
    const { planKinetic, inputProblems } = await plan();
    expect(inputProblems([L("l1", "one")], { preset: "volt" }, presets())[0]).toContain("2 to 24");
    expect(inputProblems(lines, { preset: "neon" }, presets())[0]).toContain("preset");
    expect(inputProblems(lines, { preset: "volt", accent: "red" }, presets())[0]).toContain(
      "accent",
    );
    expect(
      inputProblems(
        [L("l1", "a"), L("l2", "b", { transition: "wipe" })],
        { preset: "volt" },
        presets(),
      )[0],
    ).toContain("transition");
    expect(
      inputProblems(
        [L("l1", "a"), L("l2", Array(30).fill("w").join(" "))],
        { preset: "volt" },
        presets(),
      )[0],
    ).toContain("1 to 24 words");
    expect(() => planKinetic(lines, { preset: "x" }, presets())).toThrow("preset");
  });
});

describe("plan, cues and sync on a real project (no voice engine needed)", () => {
  const make = () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "vk-"));
    writeFileSync(
      path.join(dir, "script.md"),
      `# Demo\n\n[l1] Check a skill before you trust it.\n  beat: hook\n[l2] Skills are scripts your agent follows.\n  beat: step\n[l3] Then it grades the skill.\n  beat: step\n  emph: grades\n`,
    );
    return dir;
  };
  it("builds, voices (test tone), times, checks and syncs", () => {
    const dir = make();
    const R = (skill: string, script: string, args: string[]) =>
      spawnSync(process.execPath, [skillFile(skill, `scripts/${script}`), ...args], {
        encoding: "utf8",
      });
    const p = run("plan.mjs", ["--project", dir, "--preset", "volt"]);
    expect(p.status, p.stderr).toBe(0);
    expect(run("plan.mjs", ["--project", dir, "--preset", "volt"]).stderr).toContain("exists");
    for (const [skill, script, args] of [
      ["video-voice", "voice.mjs", [dir, "--provider", "test"]],
      ["video-voice", "align.mjs", [dir, "--engine", "estimate"]],
      ["video-core", "timing.mjs", [dir]],
    ] as const) {
      const r = R(skill, script, [...args]);
      expect(r.status, `${script}: ${r.stderr}${r.stdout}`).toBe(0);
    }
    const video = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8")) as Loose;
    expect(video.meta.type).toBe("kinetic");
    expect(video.style).toEqual({ preset: "volt", captions: "none" });
    const chk = R("video-core", "check.mjs", [dir]);
    expect(chk.stdout + chk.stderr).toContain("OK");
    // Estimated word times are refused unless allowed.
    const strict = run("sync.mjs", [dir]);
    expect(strict.status).toBe(1);
    expect(strict.stdout).toContain("estimated");
    const lenient = run("sync.mjs", [dir, "--allow-estimated"]);
    expect(lenient.stdout).toMatch(/ok: \d+ phrases|warn/);
  });
  it("needs the script and refuses a malformed one", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "vk-"));
    expect(run("plan.mjs", ["--project", dir, "--preset", "volt"]).stderr).toContain(
      "script.md is missing",
    );
    writeFileSync(path.join(dir, "script.md"), "[l1] One.\nsome stray text\n[l2] Two.\n");
    expect(run("plan.mjs", ["--project", dir, "--preset", "volt"]).stderr).toContain(
      "script.md line 2",
    );
  });
});
