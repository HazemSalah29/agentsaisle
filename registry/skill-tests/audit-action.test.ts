import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const dir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "integrations",
  "aisle-audit-action",
);
const text = readFileSync(path.join(dir, "action.yml"), "utf8");
const action = parse(text) as {
  inputs: Record<string, { default?: string; description: string }>;
  outputs: Record<string, { value: string }>;
  runs: { using: string; steps: Array<Record<string, unknown>> };
};

describe("aisle-audit-action", () => {
  it("is a composite action with documented inputs and outputs", () => {
    expect(action.runs.using).toBe("composite");
    expect(Object.keys(action.inputs).sort()).toEqual(
      ["category", "cli-version", "fail-on", "path", "upload"].sort(),
    );
    for (const i of Object.values(action.inputs)) expect(i.description.length).toBeGreaterThan(10);
    expect(Object.keys(action.outputs).sort()).toEqual(["exit-code", "grades", "sarif-file"]);
  });

  it("pins the CLI version and every action it uses to a version tag", () => {
    expect(action.inputs["cli-version"]?.default).toMatch(/^\d+\.\d+\.\d+$/);
    const uses = action.runs.steps.flatMap((s) => (typeof s.uses === "string" ? [s.uses] : []));
    expect(uses.length).toBeGreaterThanOrEqual(2);
    for (const u of uses) expect(u).toMatch(/@v\d+$|@[0-9a-f]{40}$/);
  });

  it("runs the documented command and uploads SARIF even when the audit fails", () => {
    expect(text).toContain('audit "$AISLE_PATH"');
    expect(text).toContain("--format sarif --output");
    expect(text).toContain('--fail-on "$AISLE_FAIL_ON"');
    const upload = action.runs.steps.find((s) =>
      String(s.uses).startsWith("github/codeql-action/upload-sarif"),
    );
    expect(String(upload?.if)).toContain("always()");
    // hashFiles only sees the workspace, and the report lives in RUNNER_TEMP, so use our own flag
    expect(String(upload?.if)).toContain("sarif-written");
    expect(text).not.toContain("hashFiles");
    const fail = action.runs.steps.find((s) => String(s.name).startsWith("Fail if"));
    expect(String(fail?.if)).toContain("exit-code");
  });

  it("never puts an input inside script text (no expression injection)", () => {
    for (const step of action.runs.steps) {
      if (typeof step.run !== "string") continue;
      expect(step.run, String(step.name)).not.toMatch(/\$\{\{/);
      expect(step.shell).toBe("bash");
    }
  });

  it("ships a README and an example workflow that ask for the right permissions", () => {
    const readme = readFileSync(path.join(dir, "README.md"), "utf8");
    expect(readme).toContain("security-events: write");
    expect(readme).toContain("not a guarantee of safety");
    const example = parse(readFileSync(path.join(dir, "examples", "audit.yml"), "utf8")) as {
      permissions: Record<string, string>;
    };
    expect(example.permissions["security-events"]).toBe("write");
    expect(example.permissions.contents).toBe("read");
  });
});
