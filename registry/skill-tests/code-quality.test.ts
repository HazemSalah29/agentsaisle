import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

interface Result {
  name: string;
  code: number;
  timedOut?: boolean;
  output: string;
}
interface Check {
  detectPackageManager(files: string[], pkg?: { packageManager?: string }): string;
  pickScripts(pkg: unknown): string[];
  trimOutput(text: string, maxLines: number): string[];
  summarize(results: Result[], maxLines?: number): { ok: boolean; text: string };
  runChecks(opts: {
    cwd: string;
    only?: string[];
    timeoutMs?: number;
    run?: (pm: string, name: string) => Result;
  }): { ok: boolean; empty?: boolean; text: string };
}

let check: Check;
beforeEach(async () => {
  check = await loadScript<Check>("code-quality", "scripts/check.mjs");
});

describe("detectPackageManager", () => {
  it("prefers the lockfile, then the packageManager field, then npm", () => {
    expect(check.detectPackageManager(["pnpm-lock.yaml", "package-lock.json"])).toBe("pnpm");
    expect(check.detectPackageManager(["yarn.lock"])).toBe("yarn");
    expect(check.detectPackageManager(["bun.lockb"])).toBe("bun");
    expect(check.detectPackageManager(["bun.lock"])).toBe("bun");
    expect(check.detectPackageManager(["package-lock.json"])).toBe("npm");
    expect(check.detectPackageManager([], { packageManager: "pnpm@10.18.0" })).toBe("pnpm");
    expect(check.detectPackageManager([], { packageManager: "deno@2" })).toBe("npm");
    expect(check.detectPackageManager([], {})).toBe("npm");
  });
});

describe("pickScripts", () => {
  it("returns lint, type check and test in that order, only those that exist", () => {
    expect(
      check.pickScripts({
        scripts: { test: "vitest", lint: "eslint .", typecheck: "tsc --noEmit", build: "x" },
      }),
    ).toEqual(["lint", "typecheck", "test"]);
  });
  it("accepts type-check and tsc as type check names", () => {
    expect(check.pickScripts({ scripts: { "type-check": "tsc" } })).toEqual(["type-check"]);
    expect(check.pickScripts({ scripts: { tsc: "tsc" } })).toEqual(["tsc"]);
  });
  it("ignores npm's placeholder test script and missing scripts", () => {
    expect(
      check.pickScripts({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }),
    ).toEqual([]);
    expect(check.pickScripts({})).toEqual([]);
    expect(check.pickScripts(null)).toEqual([]);
  });
});

describe("trimOutput", () => {
  it("strips colors and collapses blank runs", () => {
    expect(check.trimOutput("\u001b[31merror\u001b[0m\n\n\n\nnext\n\n", 10)).toEqual([
      "error",
      "",
      "next",
    ]);
  });
  it("keeps the start and the end of long output and says how much was omitted", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
    const out = check.trimOutput(lines.join("\n"), 10);
    expect(out).toHaveLength(10);
    expect(out[0]).toBe("line 1");
    expect(out[out.length - 1]).toBe("line 100");
    expect(out.join("\n")).toMatch(/\.\.\. \d+ lines omitted \.\.\./);
    expect(out.join("\n")).toContain("... 91 lines omitted ...");
  });
  it("leaves short output alone", () => {
    expect(check.trimOutput("a\nb", 10)).toEqual(["a", "b"]);
  });
});

describe("summarize", () => {
  it("prints one line when everything passes", () => {
    const r = check.summarize([
      { name: "lint", code: 0, output: "lots of output" },
      { name: "test", code: 0, output: "more" },
    ]);
    expect(r).toEqual({ ok: true, text: "check: passed (lint, test)" });
  });
  it("prints only failures, with the exit code, and lists what passed", () => {
    const r = check.summarize([
      { name: "lint", code: 0, output: "clean" },
      { name: "test", code: 1, output: "FAIL a.test.ts\nexpected 1 to be 2" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.text).toContain("check: test failed (exit 1)");
    expect(r.text).toContain("expected 1 to be 2");
    expect(r.text).toContain("passed: lint");
    expect(r.text).not.toContain("clean");
  });
  it("reports a timeout", () => {
    expect(check.summarize([{ name: "test", code: 1, timedOut: true, output: "" }]).text).toContain(
      "check: test timed out",
    );
  });
  it("never exceeds 40 lines, even with several long failures", () => {
    const long = Array.from({ length: 200 }, (_, i) => `noise ${i}`).join("\n");
    const r = check.summarize([
      { name: "lint", code: 1, output: long },
      { name: "typecheck", code: 2, output: long },
      { name: "test", code: 1, output: long },
    ]);
    expect(r.text.split("\n").length).toBeLessThanOrEqual(40);
    for (const name of ["lint", "typecheck", "test"])
      expect(r.text).toContain(`check: ${name} failed`);
  });
});

describe("runChecks", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "aisle-check-"));
  });
  const pkg = (scripts: Record<string, string>, extra = {}) =>
    writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "x", scripts, ...extra }));

  it("says so when there is no package.json", () => {
    const r = check.runChecks({ cwd: dir });
    expect(r.ok).toBe(true);
    expect(r.empty).toBe(true);
    expect(r.text).toContain("no package.json");
  });

  it("refuses to call a project with no checks a pass", async () => {
    await pkg({ build: "x" });
    const r = check.runChecks({ cwd: dir });
    expect(r.empty).toBe(true);
    expect(r.text).toContain("do not report this as passing");
  });

  it("reports invalid package.json", async () => {
    await writeFile(path.join(dir, "package.json"), "{nope");
    expect(check.runChecks({ cwd: dir })).toEqual({
      ok: false,
      text: "check: package.json is not valid JSON.",
    });
  });

  it("uses the detected package manager and the script names, in order", async () => {
    await pkg({ test: "t", lint: "l" });
    await writeFile(path.join(dir, "pnpm-lock.yaml"), "");
    const calls: string[] = [];
    const r = check.runChecks({
      cwd: dir,
      run: (pm, name) => {
        calls.push(`${pm}:${name}`);
        return { name, code: 0, output: "" };
      },
    });
    expect(calls).toEqual(["pnpm:lint", "pnpm:test"]);
    expect(r.ok).toBe(true);
  });

  it("honours --only", async () => {
    await pkg({ lint: "l", test: "t" });
    const calls: string[] = [];
    check.runChecks({
      cwd: dir,
      only: ["test"],
      run: (_pm, name) => (calls.push(name), { name, code: 0, output: "" }),
    });
    expect(calls).toEqual(["test"]);
  });

  it("runs the real scripts as a process: fails with only the failing output, then passes", async () => {
    await pkg({
      lint: "node -e \"console.log('lint is fine')\"",
      test: "node -e \"console.error('1 test failed: add() returned 3'); process.exit(1)\"",
    });
    const script = skillFile("code-quality", "scripts/check.mjs");
    let failed = "";
    let exit = 0;
    try {
      execFileSync(process.execPath, [script, "--cwd", dir], { encoding: "utf8", stdio: "pipe" });
    } catch (e) {
      const err = e as { status: number; stdout: string };
      exit = err.status;
      failed = err.stdout;
    }
    expect(exit).toBe(1);
    expect(failed).toContain("check: test failed (exit 1)");
    expect(failed).toContain("1 test failed: add() returned 3");
    expect(failed).toContain("passed: lint");
    expect(failed).not.toContain("lint is fine");

    await mkdir(path.join(dir, "ok"), { recursive: true });
    await writeFile(
      path.join(dir, "ok", "package.json"),
      JSON.stringify({ scripts: { test: 'node -e "process.exit(0)"' } }),
    );
    const out = execFileSync(process.execPath, [script, "--cwd", path.join(dir, "ok")], {
      encoding: "utf8",
    });
    expect(out.trim()).toBe("check: passed (test)");
  });
});
