import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { skillFile } from "./load";

const frontmatter = (skill: string) =>
  parse(
    /^---\n([\s\S]*?)\n---/.exec(readFileSync(skillFile(skill, "SKILL.md"), "utf8"))![1]!,
  ) as Record<string, unknown>;
const meta = (skill: string) =>
  parse(readFileSync(skillFile(skill, "skill.meta.yaml"), "utf8")) as Record<string, unknown>;

describe("core kit", () => {
  const core = [
    "plan",
    "implement",
    "explore",
    "review",
    "edit",
    "commit",
    "verify",
    "handoff",
    "budget",
  ];

  it("every core skill is in the core niche and tier", () => {
    for (const s of core) expect([s, meta(s).niche, meta(s).tier]).toEqual([s, "core", "core"]);
  });

  it("the V1 skills were refreshed to 1.1.0 and the new ones start at 1.0.0", () => {
    for (const s of ["plan", "implement", "explore", "review", "edit", "commit"])
      expect([s, meta(s).version]).toEqual([s, "1.1.0"]);
    for (const s of ["verify", "handoff", "budget"])
      expect([s, meta(s).version]).toEqual([s, "1.0.0"]);
  });

  it("budget is slash-command only", () => {
    expect(frontmatter("budget")["disable-model-invocation"]).toBe(true);
  });

  it("read-only skills ask for no write tools", () => {
    for (const s of ["plan", "explore", "review", "budget"]) {
      expect([s, frontmatter(s)["allowed-tools"]]).toEqual([
        s,
        expect.not.stringMatching(/\b(Edit|Write)\b/),
      ]);
      expect([s, (meta(s).permissions as { writes_files: boolean }).writes_files]).toEqual([
        s,
        false,
      ]);
    }
  });

  it("only skills that ship scripts say they run scripts", () => {
    const withScripts = new Set([
      "verify",
      "handoff",
      "code-quality",
      "web-performance",
      "web-security",
    ]);
    for (const s of [...core, "code-quality", "web-performance", "web-security"])
      expect([s, meta(s).runs_scripts]).toEqual([s, withScripts.has(s)]);
  });
});

describe("every skill script", () => {
  const scripts: Array<[string, string, string]> = [
    ["code-quality", "scripts/check.mjs", ""],
    ["web-performance", "scripts/perf-budget.mjs", ""],
    ["web-security", "scripts/secrets-scan.mjs", ""],
    ["web-security", "scripts/headers-check.mjs", ""],
    ["web-security", "scripts/audit-summary.mjs", "not json"],
    ["verify", "scripts/verify.mjs", ""],
    ["handoff", "scripts/check-handoff.mjs", ""],
  ];

  // Regression: when a script was reached through a symlinked folder (macOS /tmp, a linked
  // workspace) it did not recognise itself as the entry point and printed nothing at all.
  it.each(scripts)(
    "%s/%s still runs when started through a symlinked path",
    async (skill, file, input) => {
      const real = await mkdtemp(path.join(os.tmpdir(), "aisle-link-real-"));
      const dest = path.join(real, "scripts");
      await mkdir(dest, { recursive: true });
      await cp(skillFile(skill, file), path.join(dest, path.basename(file)));
      const link = path.join(await mkdtemp(path.join(os.tmpdir(), "aisle-link-")), "linked");
      await symlink(real, link);
      const emptyProject = await mkdtemp(path.join(os.tmpdir(), "aisle-link-proj-"));

      const r = spawnSync(process.execPath, [path.join(link, "scripts", path.basename(file))], {
        cwd: emptyProject,
        input,
        encoding: "utf8",
      });
      expect(r.stdout.trim().length, `${file} printed nothing: ${r.stderr}`).toBeGreaterThan(0);
    },
  );
});
