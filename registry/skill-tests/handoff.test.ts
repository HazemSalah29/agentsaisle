import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

interface Result {
  ok: boolean;
  lines: number;
  problems: string[];
}
interface Handoff {
  MAX_LINES: number;
  SECTIONS: string[];
  validateHandoff(text: string): Result;
  report(r: Result, file: string): string;
}

let h: Handoff;
beforeAll(async () => {
  h = await loadScript<Handoff>("handoff", "scripts/check-handoff.mjs");
});

const good = `# Handoff

## Goal
Ship the catalog filters.

## Done
- Search works (lib/search.ts)

## Next
1. Add the aisle chips test

## Open questions
None.
`;

describe("validateHandoff", () => {
  it("accepts a short note with the four sections in order", () => {
    expect(h.validateHandoff(good)).toEqual({ ok: true, lines: 13, problems: [] });
  });
  it("rejects an empty file", () => {
    expect(h.validateHandoff("  \n").problems).toEqual(["the file is empty"]);
  });
  it("rejects a note over 40 lines", () => {
    const long = good + "- filler\n".repeat(40);
    const r = h.validateHandoff(long);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/lines \(max 40\)/);
  });
  it("names each missing section", () => {
    const r = h.validateHandoff("## Goal\nx\n\n## Next\ny\n");
    expect(r.problems).toEqual([
      'missing section "## Done"',
      'missing section "## Open questions"',
    ]);
  });
  it("catches sections out of order", () => {
    const swapped = "## Goal\nx\n\n## Next\ny\n\n## Done\nz\n\n## Open questions\nNone.\n";
    expect(h.validateHandoff(swapped).problems.join()).toMatch(/out of order/);
  });
  it("catches an empty section and accepts 'None.'", () => {
    const empty = "## Goal\nx\n\n## Done\n\n## Next\ny\n\n## Open questions\nNone.\n";
    expect(h.validateHandoff(empty).problems).toEqual([
      'section "## Done" is empty (write "None." if there is nothing)',
    ]);
  });
  it("is case-insensitive about section titles", () => {
    expect(h.validateHandoff(good.replace("## Open questions", "## open QUESTIONS")).ok).toBe(true);
  });
  it("counts exactly 40 lines as fine", () => {
    const exactly = good.replace("None.\n", "None.\n") + "";
    const lines = exactly.replace(/\n$/, "").split("\n");
    const padded = [...lines, ...Array(40 - lines.length).fill("- note")].join("\n") + "\n";
    expect(h.validateHandoff(padded).ok).toBe(true);
  });
});

describe("report and command", () => {
  it("formats pass and fail", () => {
    expect(h.report({ ok: true, lines: 12, problems: [] }, "h.md")).toBe(
      "handoff: ok (12 lines, max 40) h.md",
    );
    expect(h.report({ ok: false, lines: 50, problems: ["a", "b"] }, "h.md")).toBe(
      "handoff: 2 problems in h.md\n  a\n  b",
    );
  });
  const run = (cwd: string, ...args: string[]) => {
    const r = spawnSync(
      process.execPath,
      [skillFile("handoff", "scripts/check-handoff.mjs"), ...args],
      { cwd, encoding: "utf8" },
    );
    return { code: r.status, out: r.stdout };
  };
  it("checks .agent-aisle/handoff.md by default, or a given file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "aisle-handoff-"));
    expect(run(dir)).toMatchObject({ code: 1 });
    expect(run(dir).out).toContain("does not exist yet");
    await mkdir(path.join(dir, ".agent-aisle"));
    await writeFile(path.join(dir, ".agent-aisle", "handoff.md"), good);
    expect(run(dir)).toMatchObject({ code: 0 });
    expect(run(dir).out).toContain("handoff: ok");
    await writeFile(path.join(dir, "other.md"), "## Goal\nx\n");
    const bad = run(dir, "other.md");
    expect(bad.code).toBe(1);
    expect(bad.out).toContain('missing section "## Done"');
  });
});
