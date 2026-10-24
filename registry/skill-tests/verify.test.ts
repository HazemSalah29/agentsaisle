import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

interface Result {
  name: string;
  code: number;
  timedOut?: boolean;
  output: string;
}
interface Step {
  name: string;
  kind: string;
  file?: string;
}
interface Verify {
  detectPackageManager(files: string[], pkg?: { packageManager?: string }): string;
  pickScripts(pkg: unknown): string[];
  trimOutput(text: string, max: number): string[];
  siblingScript(
    skillDir: string,
    skill: string,
    file: string,
    exists: (p: string) => boolean,
  ): string | null;
  planSteps(o: { pkg: unknown; hasBuild: boolean; perfScript: string | null }): {
    steps: Step[];
    skip: string[];
  };
  summarize(
    results: Result[],
    skip?: string[],
    max?: number,
  ): { ok: boolean; empty?: boolean; text: string };
  verify(o: { cwd: string; skillDir: string; run?: (s: Step, pm: string) => Result }): {
    ok: boolean;
    empty?: boolean;
    text: string;
  };
}

let v: Verify;
beforeAll(async () => {
  v = await loadScript<Verify>("verify", "scripts/verify.mjs");
});

describe("verify: pure helpers", () => {
  it("detects the package manager like code-quality does", () => {
    expect(v.detectPackageManager(["pnpm-lock.yaml"])).toBe("pnpm");
    expect(v.detectPackageManager(["yarn.lock"])).toBe("yarn");
    expect(v.detectPackageManager([], { packageManager: "bun@1" })).toBe("bun");
    expect(v.detectPackageManager([])).toBe("npm");
  });
  it("picks lint, type check and test in order and ignores the npm placeholder", () => {
    expect(v.pickScripts({ scripts: { test: "t", lint: "l", tsc: "x" } })).toEqual([
      "lint",
      "tsc",
      "test",
    ]);
    expect(
      v.pickScripts({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }),
    ).toEqual([]);
    expect(v.pickScripts(undefined)).toEqual([]);
  });
  it("trims long output to its start and end", () => {
    const out = v.trimOutput(Array.from({ length: 80 }, (_, i) => `l${i + 1}`).join("\n"), 10);
    expect(out).toHaveLength(10);
    expect(out[0]).toBe("l1");
    expect(out.at(-1)).toBe("l80");
  });
  it("finds a sibling skill's script only when it exists", () => {
    const dir = path.join("/skills", "verify");
    const hit = path.join("/skills", "web-performance", "scripts", "perf-budget.mjs");
    expect(v.siblingScript(dir, "web-performance", "perf-budget.mjs", (p) => p === hit)).toBe(hit);
    expect(v.siblingScript(dir, "web-performance", "perf-budget.mjs", () => false)).toBeNull();
  });
});

describe("verify: planning", () => {
  const pkg = { scripts: { lint: "l", test: "t" } };
  it("adds the budget only when the skill is installed and a build exists", () => {
    expect(
      v.planSteps({ pkg, hasBuild: true, perfScript: "/p.mjs" }).steps.map((s) => s.name),
    ).toEqual(["lint", "test", "perf-budget"]);
    expect(
      v.planSteps({ pkg, hasBuild: false, perfScript: "/p.mjs" }).steps.map((s) => s.name),
    ).toEqual(["lint", "test"]);
  });
  it("says why the budget was skipped", () => {
    expect(v.planSteps({ pkg, hasBuild: true, perfScript: null }).skip).toEqual([
      "perf-budget skipped: web-performance is not installed",
    ]);
    expect(v.planSteps({ pkg, hasBuild: false, perfScript: "/p.mjs" }).skip[0]).toMatch(
      /no production build in \.next/,
    );
  });
});

describe("verify: summary", () => {
  it("prints a pass with skipped notes", () => {
    const r = v.summarize([{ name: "lint", code: 0, output: "" }], ["perf-budget skipped: x"]);
    expect(r.ok).toBe(true);
    expect(r.text).toBe("verify: passed (lint)\nnote: perf-budget skipped: x");
  });
  it("prints only failures, with passed steps listed by name", () => {
    const r = v.summarize([
      { name: "lint", code: 0, output: "very long clean output" },
      {
        name: "perf-budget",
        code: 1,
        output: "perf-budget: 1 of 9 routes over budget\n  /submit 200 kB > 180 kB",
      },
    ]);
    expect(r.ok).toBe(false);
    expect(r.text).toContain("verify: perf-budget failed (exit 1)");
    expect(r.text).toContain("/submit 200 kB > 180 kB");
    expect(r.text).toContain("passed: lint");
    expect(r.text).not.toContain("very long clean output");
  });
  it("refuses to call an empty run a pass", () => {
    const r = v.summarize([]);
    expect(r.empty).toBe(true);
    expect(r.text).toContain("do not report this as passing");
  });
  it("stays within 40 lines", () => {
    const long = Array.from({ length: 300 }, (_, i) => `n${i}`).join("\n");
    const r = v.summarize(
      [
        { name: "lint", code: 1, output: long },
        { name: "test", code: 1, output: long },
      ],
      ["a skipped"],
    );
    expect(r.text.split("\n").length).toBeLessThanOrEqual(40);
  });
});

describe("verify: run with fakes", () => {
  it("reports a missing package.json, bad JSON, and runs steps in order with the detected manager", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "aisle-verify-"));
    const skillDir = path.join(dir, "skills", "verify");
    expect(v.verify({ cwd: dir, skillDir }).text).toContain("no package.json");
    await writeFile(path.join(dir, "package.json"), "{bad");
    expect(v.verify({ cwd: dir, skillDir }).text).toContain("not valid JSON");
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ scripts: { lint: "l", test: "t" } }),
    );
    await writeFile(path.join(dir, "yarn.lock"), "");
    const calls: string[] = [];
    const r = v.verify({
      cwd: dir,
      skillDir,
      run: (s, pm) => (calls.push(`${pm}:${s.name}`), { name: s.name, code: 0, output: "" }),
    });
    expect(calls).toEqual(["yarn:lint", "yarn:test"]);
    expect(r.text).toContain("verify: passed (lint, test)");
    expect(r.text).toContain("web-performance is not installed");
  });
});

describe("verify: as a command with the budget skill installed next to it", () => {
  async function setup(withPerf: boolean, withBuild: boolean, budgetKb?: number) {
    const root = await mkdtemp(path.join(os.tmpdir(), "aisle-verify-cmd-"));
    const skills = path.join(root, ".claude", "skills");
    await mkdir(path.join(skills, "verify", "scripts"), { recursive: true });
    await cp(
      skillFile("verify", "scripts/verify.mjs"),
      path.join(skills, "verify", "scripts", "verify.mjs"),
    );
    if (withPerf) {
      await mkdir(path.join(skills, "web-performance", "scripts"), { recursive: true });
      await cp(
        skillFile("web-performance", "scripts/perf-budget.mjs"),
        path.join(skills, "web-performance", "scripts", "perf-budget.mjs"),
      );
    }
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ scripts: { lint: "node -e \"console.log('lint ok')\"" } }),
    );
    if (withBuild) {
      const next = path.join(root, ".next");
      await mkdir(path.join(next, "server", "app"), { recursive: true });
      await mkdir(path.join(next, "static", "chunks"), { recursive: true });
      await writeFile(
        path.join(next, "build-manifest.json"),
        JSON.stringify({ rootMainFiles: ["static/chunks/a.js"] }),
      );
      await writeFile(
        path.join(next, "app-path-routes-manifest.json"),
        JSON.stringify({ "/page": "/" }),
      );
      await writeFile(
        path.join(next, "static", "chunks", "a.js"),
        Array.from({ length: 5000 }, (_, i) => `var v${i}=${Math.random()};`).join("\n"),
      );
      await writeFile(
        path.join(next, "server", "app", "page_client-reference-manifest.js"),
        `globalThis.__RSC_MANIFEST["/page"] = ${JSON.stringify({ entryJSFiles: { "[project]/app/page": ["static/chunks/a.js"] } })};`,
      );
    }
    if (budgetKb !== undefined)
      await writeFile(path.join(root, "perf.config.json"), JSON.stringify({ budgetKb }));
    const run = () => {
      const r = spawnSync(
        process.execPath,
        [path.join(skills, "verify", "scripts", "verify.mjs"), "--cwd", root],
        { encoding: "utf8" },
      );
      return { code: r.status, out: r.stdout };
    };
    return run;
  }

  it("passes and includes the budget when installed and built", async () => {
    const run = await setup(true, true, 10_000);
    const r = run();
    expect(r.code).toBe(0);
    expect(r.out).toContain("verify: passed (lint, perf-budget)");
  });
  it("fails on a budget overrun and shows the route", async () => {
    const run = await setup(true, true, 1);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.out).toContain("verify: perf-budget failed");
    expect(r.out).toContain("passed: lint");
  });
  it("skips the budget with a note when the skill or the build is missing", async () => {
    expect((await setup(false, true))().out).toContain("web-performance is not installed");
    expect((await setup(true, false))().out).toContain("no production build in .next");
    expect((await setup(false, false))().code).toBe(0);
  });
});
