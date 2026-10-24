import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skillFile } from "./load";

describe("rtl-check companion", () => {
  it.each(["rtl-scan.mjs", "_lib.mjs", "_classmap.mjs"])(
    "keeps scripts/%s identical to arabic-rtl's copy",
    async (f) => {
      const a = await readFile(skillFile("arabic-rtl", `scripts/${f}`), "utf8");
      const b = await readFile(skillFile("rtl-check", `scripts/${f}`), "utf8");
      expect(b).toBe(a);
    },
  );

  it("is model-invoked, cheap and read-only", async () => {
    const skill = await readFile(skillFile("rtl-check", "SKILL.md"), "utf8");
    expect(skill).not.toMatch(/disable-model-invocation/);
    expect(skill).toMatch(/^model: haiku$/m);
    expect(skill).not.toMatch(/^allowed-tools:.*\b(Write|Edit)\b/m);
    expect(skill).not.toContain("--write");
    expect(skill.split("\n").length).toBeLessThanOrEqual(150);
  });

  it("scans the changed files it is given", () => {
    const fixture = skillFile("arabic-rtl", "evals/fixture-app");
    const r = spawnSync(
      process.execPath,
      [
        skillFile("rtl-check", "scripts/rtl-scan.mjs"),
        path.join(fixture, "components/Sidebar.tsx"),
        "--errors-only",
      ],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/physical-class/);
  });
});
