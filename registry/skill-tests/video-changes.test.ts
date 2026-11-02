import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const run = (args: string[]) =>
  spawnSync(process.execPath, [skillFile("video-changes", "scripts/changes.mjs"), ...args], {
    encoding: "utf8",
    env: { ...process.env, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
  });
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "video-changes-"));
const DIFF = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 export { a };
diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
 # Hi
+More text.
diff --git a/src/wide.ts b/src/wide.ts
--- a/src/wide.ts
+++ b/src/wide.ts
@@ -1 +1 @@
-x
+${"y".repeat(80)}
`;
const CHANGELOG = "# Log\n\n## 1.2.0\n\n- Adds `tour`\n* Fixes **bugs**\n\n## 1.1.0\n\n- old\n";

describe("video-changes copies", () => {
  it("keeps a byte-identical _lib.mjs", () => {
    expect(readFileSync(skillFile("video-changes", "scripts/_lib.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "scripts/_lib.mjs"), "utf8"),
    );
  });
});

describe("changes.mjs", () => {
  it("counts lines from the diff and builds code diff scenes", () => {
    const dir = tmp();
    writeFileSync(path.join(dir, "c.diff"), DIFF);
    writeFileSync(path.join(dir, "CHANGELOG.md"), CHANGELOG);
    const out = path.join(dir, "p");
    const r = run([
      "--diff",
      path.join(dir, "c.diff"),
      "--out",
      out,
      "--changelog",
      path.join(dir, "CHANGELOG.md"),
      "--release",
      "1.2.0",
    ]);
    expect(r.status).toBe(0);
    const video = JSON.parse(readFileSync(path.join(out, "video.json"), "utf8")) as Loose;
    const facts = readFileSync(path.join(out, "facts.md"), "utf8");
    expect(facts).toContain("3 files changed, 4 lines added and 2 removed");
    const code = video.scenes.filter((s: Loose) => s.kind === "code");
    expect(code).toHaveLength(1);
    expect(code[0].props.diff.after).toContain("const c = 4;");
    const changelog = video.scenes.find((s: Loose) => s.props.heading === "From the changelog");
    expect(changelog.props.items).toEqual(["Adds tour", "Fixes bugs"]);
    expect(r.stdout).toContain("src/wide.ts");
  });

  it("refuses bad input and never overwrites", () => {
    const dir = tmp();
    writeFileSync(path.join(dir, "empty.diff"), "nothing here\n");
    expect(run(["--diff", path.join(dir, "empty.diff"), "--out", path.join(dir, "o")]).status).toBe(
      2,
    );
    writeFileSync(path.join(dir, "c.diff"), DIFF);
    const out = path.join(dir, "p");
    expect(run(["--diff", path.join(dir, "c.diff"), "--out", out]).status).toBe(0);
    expect(run(["--diff", path.join(dir, "c.diff"), "--out", out]).stderr).toContain("exists");
    expect(
      run(["--diff", path.join(dir, "c.diff"), "--out", path.join(dir, "q"), "--release", "1"])
        .status,
    ).toBe(2);
  });

  it("parses file names, counts and hunks", async () => {
    const { parseDiff } = await loadScript<{ parseDiff: (t: string) => Loose[] }>(
      "video-changes",
      "scripts/changes.mjs",
    );
    const files = parseDiff(DIFF);
    expect(files.map((f) => [f.file, f.added, f.removed])).toEqual([
      ["src/a.ts", 2, 1],
      ["README.md", 1, 0],
      ["src/wide.ts", 1, 1],
    ]);
  });
});
