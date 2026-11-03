import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const bd = () => loadScript<Loose>("video-core", "scripts/build.mjs");

describe("build steps", () => {
  it("runs check, timing and render, and adds credits for a final only", async () => {
    const { buildSteps } = await bd();
    expect(buildSteps("/p", { draft: true }).map((s: Loose) => s.id)).toEqual([
      "check",
      "timing",
      "render",
    ]);
    expect(buildSteps("/p").map((s: Loose) => s.id)).toEqual([
      "check",
      "timing",
      "render",
      "credits",
    ]);
  });
  it("passes the flags on to render only", async () => {
    const { buildSteps } = await bd();
    const steps = buildSteps("/p", { draft: true, ignoreApproval: true, preset: "ember" });
    expect(steps[2].args).toEqual(["/p", "--draft", "--ignore-approval", "--preset", "ember"]);
    expect(steps[0].args).toEqual(["/p"]);
  });
});

describe("build command", () => {
  const script = skillFile("video-core", "scripts/build.mjs");
  it("stops at the first failing step and says which, exit 1", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "build-"));
    mkdirSync(path.join(dir, "voice"));
    writeFileSync(
      path.join(dir, "video.json"),
      JSON.stringify({
        version: 1,
        meta: { title: "t", type: "explainer", format: "short-9x16", fps: 30, lang: "en" },
        scenes: [{ id: "a", kind: "nonsense", durationFrom: "fixed", seconds: 2, props: {} }],
      }),
    );
    const r = spawnSync("node", [script, dir, "--draft"], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("FAILED at check");
    expect(r.stderr).toContain("nonsense");
    expect(r.stderr).not.toContain("timing:");
  });
  it("exits 2 without a project", () => {
    expect(spawnSync("node", [script], { encoding: "utf8" }).status).toBe(2);
    const empty = mkdtempSync(path.join(os.tmpdir(), "build-empty-"));
    expect(spawnSync("node", [script, empty], { encoding: "utf8" }).status).toBe(2);
  });
});
