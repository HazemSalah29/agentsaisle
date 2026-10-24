import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

interface Cf {
  isTestFile(f: string): boolean;
  isSourceFile(f: string): boolean;
  testCandidates(f: string): string[];
  detectFramework(
    pkg: unknown,
    has: (f: string) => boolean,
  ): { name: string; command: string; perFile: ((f: string[]) => string) | null } | null;
  classify(
    changed: string[],
    exists: (f: string) => boolean,
  ): { source: Array<{ file: string; tests: string[] }>; tests: string[] };
  report(r: unknown): string;
}
interface Trim {
  detectRunner(t: string): string;
  trim(t: string): { runner: string; blocks: string[][]; summary: string[]; read: number };
  format(r: unknown): string;
}
interface Weak {
  parseDiff(d: string): Array<{
    path: string;
    deleted: boolean;
    removed: Array<{ text: string; line: number }>;
    added: Array<{ text: string; line: number }>;
  }>;
  analyze(d: string): Array<{ file: string; line: number; rule: string }>;
  format(f: unknown[]): string;
}
interface Log {
  trimLog(t: string, o?: { max?: number; frames?: number }): string[];
}

let cf: Cf;
let trim: Trim;
let weak: Weak;
let log: Log;
beforeAll(async () => {
  cf = await loadScript<Cf>("test-write", "scripts/changed-files.mjs");
  trim = await loadScript<Trim>("test-fix", "scripts/trim-test-output.mjs");
  weak = await loadScript<Weak>("test-fix", "scripts/weakened-assertions.mjs");
  log = await loadScript<Log>("debug-trace", "scripts/trim-log.mjs");
});

describe("test-write: changed-files", () => {
  it("tells test files from source files", () => {
    for (const f of [
      "a.test.ts",
      "src/a.spec.tsx",
      "tests/x.py",
      "test_a.py",
      "pkg/a_test.go",
      "src/__tests__/a.js",
      "Foo/BarTest.java",
    ])
      expect(cf.isTestFile(f), f).toBe(true);
    for (const f of ["src/a.ts", "lib/b.py", "main.go", "app/c.tsx"]) {
      expect(cf.isTestFile(f), f).toBe(false);
      expect(cf.isSourceFile(f), f).toBe(true);
    }
    for (const f of ["README.md", "types.d.ts", "node_modules/x/i.js", "dist/a.js", "package.json"])
      expect(cf.isSourceFile(f), f).toBe(false);
  });

  it("suggests where a test for a file would live", () => {
    expect(cf.testCandidates("src/util.ts")).toEqual(
      expect.arrayContaining([
        "src/util.test.ts",
        "src/util.spec.ts",
        "src/__tests__/util.test.ts",
      ]),
    );
    expect(cf.testCandidates("lib/db.py")).toEqual(
      expect.arrayContaining(["lib/test_db.py", "tests/test_db.py"]),
    );
    expect(cf.testCandidates("pkg/a.go")).toEqual(["pkg/a_test.go"]);
    expect(cf.testCandidates("style.css")).toEqual([]);
  });

  it("detects the framework and the package manager", () => {
    const none = () => false;
    expect(
      cf.detectFramework({ devDependencies: { vitest: "5" } }, (f) => f === "pnpm-lock.yaml")
        ?.command,
    ).toBe("pnpm exec vitest run");
    expect(cf.detectFramework({ devDependencies: { vitest: "5" } }, none)?.command).toBe(
      "npx vitest run",
    );
    expect(
      cf.detectFramework({ devDependencies: { jest: "29" } }, (f) => f === "yarn.lock")?.command,
    ).toBe("yarn jest");
    expect(cf.detectFramework({ scripts: { test: "node t.js" } }, none)?.command).toBe("npm test");
    expect(cf.detectFramework(null, (f) => f === "pyproject.toml")?.name).toBe("pytest");
    expect(cf.detectFramework(null, (f) => f === "go.mod")?.command).toBe("go test ./...");
    expect(cf.detectFramework(null, (f) => f === "Cargo.toml")?.command).toBe("cargo test");
    expect(cf.detectFramework(null, none)).toBeNull();
  });

  it("builds a run command for just the relevant test files", () => {
    const fw = cf.detectFramework({ devDependencies: { vitest: "5" } }, () => false)!;
    expect(fw.perFile!(["a.test.ts", "b.test.ts"])).toBe("npx vitest run a.test.ts b.test.ts");
  });

  it("classifies changed files and finds existing tests", () => {
    const exists = (f: string) => f === "src/a.test.ts";
    const r = cf.classify(["src/a.ts", "src/b.ts", "src/c.test.ts", "README.md"], exists);
    expect(r.source).toEqual([
      { file: "src/a.ts", tests: ["src/a.test.ts"] },
      { file: "src/b.ts", tests: [] },
    ]);
    expect(r.tests).toEqual(["src/c.test.ts"]);
  });

  it("reports what needs tests and the exact command", () => {
    const framework = cf.detectFramework({ devDependencies: { vitest: "5" } }, () => false);
    const out = cf.report({
      framework,
      source: [
        { file: "src/a.ts", tests: ["src/a.test.ts"] },
        { file: "src/b.ts", tests: [] },
      ],
      tests: [],
    });
    expect(out).toContain("needs tests: src/b.ts");
    expect(out).toContain("has tests: src/a.ts -> src/a.test.ts");
    expect(out).toContain("run: npx vitest run src/a.test.ts");
    expect(cf.report({ framework: null, source: [], tests: [] })).toContain("none detected");
  });

  it("works in a real git repository, including new untracked files", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cf-"));
    const git = (...a: string[]) =>
      execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...a], { cwd: dir });
    git("init", "-q");
    await mkdir(path.join(dir, "src"), { recursive: true });
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ devDependencies: { vitest: "5" } }),
    );
    await writeFile(path.join(dir, "src/old.ts"), "export const a = 1;\n");
    await writeFile(path.join(dir, "src/old.test.ts"), "// t\n");
    git("add", "-A");
    git("commit", "-q", "-m", "init");
    await writeFile(path.join(dir, "src/old.ts"), "export const a = 2;\n");
    await writeFile(path.join(dir, "src/new.ts"), "export const b = 1;\n");
    const r = spawnSync(
      process.execPath,
      [skillFile("test-write", "scripts/changed-files.mjs"), "--cwd", dir],
      { encoding: "utf8" },
    );
    expect(r.stdout).toContain("has tests: src/old.ts -> src/old.test.ts");
    expect(r.stdout).toContain("needs tests: src/new.ts");
    expect(r.stdout).toContain("framework: vitest");
    const notRepo = spawnSync(
      process.execPath,
      [
        skillFile("test-write", "scripts/changed-files.mjs"),
        "--cwd",
        await mkdtemp(path.join(os.tmpdir(), "nogit-")),
      ],
      { encoding: "utf8" },
    );
    expect(notRepo.stdout).toMatch(/not a git repository/);
    expect(notRepo.status).toBe(1);
  });
});

const VITEST = `
 RUN  v5.0.5 /app

 ✓ src/ok.test.ts (3 tests) 4ms
 ❯ src/math.test.ts (2 tests | 1 failed) 8ms
   × adds numbers
 FAIL  src/math.test.ts > adds numbers
AssertionError: expected 3 to be 4 // Object.is equality

- Expected
+ Received

- 4
+ 3

 ❯ src/math.test.ts:6:19
      4| it("adds numbers", () => {
      5|   expect(1 + 2).toBe(4);

 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 4 passed (5)
   Duration  412ms
`;
const JEST = `
PASS src/ok.test.js
FAIL src/math.test.js
  ● math › adds

    expect(received).toBe(expected) // Object.is equality

    Expected: 4
    Received: 3

      5 |   expect(1 + 2).toBe(4);

Test Suites: 1 failed, 1 passed, 2 total
Tests:       1 failed, 3 passed, 4 total
Time:        1.2 s
`;
const PYTEST = `============================= test session starts ==============================
collected 3 items

tests/test_math.py .F.                                                   [100%]

=================================== FAILURES ===================================
__________________________________ test_adds ___________________________________

    def test_adds():
>       assert add(1, 2) == 4
E       assert 3 == 4
E        +  where 3 = add(1, 2)

tests/test_math.py:5: AssertionError
=========================== short test summary info ============================
FAILED tests/test_math.py::test_adds - assert 3 == 4
========================= 1 failed, 2 passed in 0.03s ==========================
`;
const GO = `=== RUN   TestAdd
    math_test.go:9: Add(1,2) = 3, want 4
--- FAIL: TestAdd (0.00s)
=== RUN   TestSub
--- PASS: TestSub (0.00s)
FAIL
FAIL	example.com/m	0.003s
`;

describe("test-fix: trim-test-output", () => {
  it("recognizes each runner", () => {
    expect(trim.detectRunner(VITEST)).toBe("js");
    expect(trim.detectRunner(JEST)).toBe("js");
    expect(trim.detectRunner(PYTEST)).toBe("pytest");
    expect(trim.detectRunner(GO)).toBe("go");
    expect(trim.detectRunner("hello")).toBe("unknown");
  });

  it("keeps the failing test, the assertion and the totals from vitest", () => {
    const out = trim.format(trim.trim(VITEST));
    expect(out).toContain("1 failure");
    expect(out).toContain("src/math.test.ts > adds numbers");
    expect(out).toContain("expected 3 to be 4");
    expect(out).toMatch(/Tests\s+1 failed \| 4 passed/);
    expect(out).not.toContain("ok.test.ts");
  });

  it("works for jest", () => {
    const out = trim.format(trim.trim(JEST));
    expect(out).toContain("● math › adds");
    expect(out).toContain("Expected: 4");
    expect(out).not.toContain("PASS src/ok");
  });

  it("works for pytest", () => {
    const out = trim.format(trim.trim(PYTEST));
    expect(out).toContain("FAILED test_adds");
    expect(out).toContain("E       assert 3 == 4");
    expect(out).toContain("tests/test_math.py:5");
    expect(out).toMatch(/1 failed, 2 passed/);
  });

  it("works for go test", () => {
    const out = trim.format(trim.trim(GO));
    expect(out).toContain("--- FAIL: TestAdd");
    expect(out).toContain("want 4");
    expect(out).not.toContain("TestSub");
  });

  it("says so when nothing failed, strips color codes, and handles unknown input", () => {
    const green =
      "\u001b[32m ✓ a.test.ts\u001b[0m\n Test Files  1 passed (1)\n      Tests  3 passed (3)\n";
    const out = trim.format(trim.trim(green));
    expect(out).toContain("no failures found");
    expect(out).not.toContain("\u001b");
    expect(trim.format(trim.trim("nothing useful"))).toMatch(/could not recognize/);
  });

  it("never prints more than 40 lines", () => {
    const many = Array.from(
      { length: 30 },
      (_, i) => ` FAIL  src/a.test.ts > case ${i}\nAssertionError: boom ${i}\n  at x\n  at y\n`,
    ).join("\n");
    expect(trim.format(trim.trim(many)).split("\n").length).toBeLessThanOrEqual(40);
  });

  it("exits 1 when there are failures and 0 when there are none", () => {
    const script = skillFile("test-fix", "scripts/trim-test-output.mjs");
    expect(spawnSync(process.execPath, [script], { input: VITEST, encoding: "utf8" }).status).toBe(
      1,
    );
    expect(
      spawnSync(process.execPath, [script], {
        input: " ✓ a\n Test Files  1 passed (1)\n",
        encoding: "utf8",
      }).status,
    ).toBe(0);
  });
});

const diff = (file: string, body: string, extra = "") =>
  `diff --git a/${file} b/${file}\n${extra}--- a/${file}\n+++ b/${file}\n@@ -1,6 +1,6 @@\n${body}`;

describe("test-fix: weakened-assertions", () => {
  const rules = (d: string) => weak.analyze(d).map((f) => f.rule);

  it("parses files, removed and added lines with new-file line numbers", () => {
    const [f] = weak.parseDiff(diff("a.test.ts", " keep\n-old\n+new\n keep2\n"));
    expect(f).toMatchObject({ path: "a.test.ts", deleted: false });
    expect(f!.removed).toEqual([{ text: "old", line: 2 }]);
    expect(f!.added).toEqual([{ text: "new", line: 2 }]);
  });

  it("flags a removed assertion", () => {
    expect(
      rules(diff("a.test.ts", " it('x', () => {\n-  expect(add(1, 2)).toBe(3);\n })\n")),
    ).toContain("removed-assertion");
  });

  it("flags a strict matcher loosened to a weak one", () => {
    const found = weak.analyze(
      diff(
        "a.test.ts",
        " it('x', () => {\n-  expect(add(1, 2)).toBe(3);\n+  expect(add(1, 2)).toBeTruthy();\n })\n",
      ),
    );
    expect(found.map((f) => f.rule)).toEqual(["loosened-matcher"]);
    expect(found[0]!.line).toBe(2);
  });

  it("flags new skips and focused tests", () => {
    for (const added of [
      "+it.skip('x', () => {})",
      "+xit('x', () => {})",
      "+describe.only('x', () => {})",
      "+@pytest.mark.skip",
      '+  t.Skip("later")',
      "+test.fixme('x')",
    ])
      expect(rules(diff("a.test.ts", ` ctx\n${added}\n`)), added).toContain("new-skip");
  });

  it("flags a deleted test and a deleted test file", () => {
    expect(
      rules(diff("a.test.ts", "-it('does a thing', () => {\n- expect(1).toBe(1);\n-});\n")),
    ).toContain("deleted-test");
    expect(rules(diff("a.test.ts", "", "deleted file mode 100644\n"))).toContain("deleted-file");
  });

  it("flags the same patterns in python and go tests", () => {
    expect(rules(diff("tests/test_a.py", "-    assert add(1, 2) == 3\n"))).toContain(
      "removed-assertion",
    );
    expect(rules(diff("pkg/a_test.go", '-\tif got != want { t.Errorf("bad") }\n'))).toContain(
      "removed-assertion",
    );
  });

  it("does not flag moved, replaced or added assertions, or non-test files", () => {
    expect(rules(diff("a.test.ts", "-  expect(a).toBe(1);\n+  expect(a).toBe(1);\n"))).toEqual([]);
    expect(rules(diff("a.test.ts", "-  expect(a).toBe(1);\n+  expect(a).toBe(2);\n"))).toEqual([]);
    expect(rules(diff("a.test.ts", "+  expect(a).toBe(1);\n"))).toEqual([]);
    expect(rules(diff("src/a.ts", "-  expect(a).toBe(1);\n"))).toEqual([]);
  });

  it("formats within 40 lines and asks the user", () => {
    expect(weak.format([])).toMatch(/no weakened tests/);
    const many = Array.from({ length: 60 }, (_, i) => ({
      file: "a.test.ts",
      line: i + 1,
      rule: "new-skip",
      message: "x",
    }));
    const out = weak.format(many);
    expect(out.split("\n").length).toBeLessThanOrEqual(40);
    expect(out).toMatch(/Ask the user/);
  });

  it("runs as a command on stdin: exit 1 with findings, 0 without", () => {
    const script = skillFile("test-fix", "scripts/weakened-assertions.mjs");
    const bad = spawnSync(process.execPath, [script], {
      input: diff("a.test.ts", " c\n+it.skip('x')\n"),
      encoding: "utf8",
    });
    expect(bad.status).toBe(1);
    expect(bad.stdout).toMatch(/a\.test\.ts:2\s+new-skip/);
    expect(
      spawnSync(process.execPath, [script], {
        input: diff("a.test.ts", "+expect(1).toBe(1)\n"),
        encoding: "utf8",
      }).status,
    ).toBe(0);
  });
});

describe("debug-trace: trim-log", () => {
  it("collapses repeated lines", () => {
    expect(log.trimLog("retrying\nretrying\nretrying\ndone\n")).toEqual(["retrying (x3)", "done"]);
  });

  it("keeps project frames and counts the library frames it hides", () => {
    const out = log.trimLog(
      [
        "TypeError: x is undefined",
        "    at run (/app/src/a.ts:3:1)",
        "    at go (/app/src/b.ts:4:1)",
        "    at i (/app/node_modules/lib/i.js:1:1)",
        "    at j (node:internal/m:1:1)",
        "    at main (/app/src/c.ts:9:1)",
      ].join("\n"),
    );
    expect(out).toEqual([
      "TypeError: x is undefined",
      "    at run (/app/src/a.ts:3:1)",
      "    at go (/app/src/b.ts:4:1)",
      "    ... 2 library frames hidden",
      "    at main (/app/src/c.ts:9:1)",
    ]);
  });

  it("limits how many project frames it keeps per trace", () => {
    const frames = Array.from({ length: 12 }, (_, i) => `    at f${i} (/app/src/f${i}.ts:1:1)`);
    const out = log.trimLog(["Error: deep", ...frames].join("\n"), { frames: 3 });
    expect(out.filter((l) => l.includes("/app/src/"))).toHaveLength(3);
    expect(out.at(-1)).toMatch(/9 library frames hidden/);
  });

  it("handles python tracebacks", () => {
    const out = log.trimLog(
      [
        "Traceback (most recent call last):",
        '  File "/app/main.py", line 3, in <module>',
        "    run()",
        '  File "/usr/lib/python3/site-packages/x.py", line 9, in run',
        "    boom()",
        "ValueError: nope",
      ].join("\n"),
    );
    expect(out).toContain('  File "/app/main.py", line 3, in <module>');
    expect(out.join("\n")).toMatch(/library frame/);
    expect(out.at(-1)).toBe("ValueError: nope");
  });

  it("strips color codes and blank lines", () => {
    expect(log.trimLog("\u001b[31mERROR\u001b[0m bad\n\n\n")).toEqual(["ERROR bad"]);
  });

  it("cuts a long log to the limit, keeping the first error with context and the tail", () => {
    const lines = [
      ...Array.from({ length: 100 }, (_, i) => `info ${i}`),
      "Error: the real problem",
      ...Array.from({ length: 100 }, (_, i) => `late ${i}`),
    ];
    const out = log.trimLog(lines.join("\n"), { max: 40 });
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out).toContain("Error: the real problem");
    expect(out.some((l) => /lines omitted/.test(l))).toBe(true);
    expect(out.at(-1)).toBe("late 99");
  });

  it("runs as a command with --lines", () => {
    const script = skillFile("debug-trace", "scripts/trim-log.mjs");
    const input = Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n");
    const r = spawnSync(process.execPath, [script, "--lines", "12"], { input, encoding: "utf8" });
    expect(r.stdout.trim().split("\n").length).toBeLessThanOrEqual(12);
    expect(spawnSync(process.execPath, [script], { input: "", encoding: "utf8" }).stdout).toMatch(
      /input was empty/,
    );
  });
});

describe("testing and debugging skills: shared checks", () => {
  const scripts: Array<[string, string]> = [
    ["test-write", "scripts/changed-files.mjs"],
    ["test-fix", "scripts/trim-test-output.mjs"],
    ["test-fix", "scripts/weakened-assertions.mjs"],
    ["debug-trace", "scripts/trim-log.mjs"],
  ];

  it.each(scripts)(
    "%s/%s still runs when started through a symlinked path",
    async (skill, file) => {
      const real = await mkdtemp(path.join(os.tmpdir(), "tds-real-"));
      await mkdir(path.join(real, "scripts"), { recursive: true });
      await cp(skillFile(skill, file), path.join(real, "scripts", path.basename(file)));
      const link = path.join(await mkdtemp(path.join(os.tmpdir(), "tds-link-")), "linked");
      await symlink(real, link);
      const r = spawnSync(process.execPath, [path.join(link, "scripts", path.basename(file))], {
        cwd: await mkdtemp(path.join(os.tmpdir(), "tds-proj-")),
        input: "hello",
        encoding: "utf8",
      });
      expect(r.stdout.trim().length, `${file} printed nothing: ${r.stderr}`).toBeGreaterThan(0);
    },
  );
});
