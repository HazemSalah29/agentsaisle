import { cp, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { MARKER, auditEntries, failed, renderComment } from "./audit-pr";

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages",
  "audit",
  "fixtures",
);
const SHA = "d4".repeat(20);
const now = new Date("2026-10-24T12:00:00Z");

const yaml = (name: string) =>
  `name: ${name}\nauthor: someone\nrepo: someone/skills\npath: skills/${name}\nversions:\n  - {version: 1.0.0, ref: v1, sha: "${SHA}"}\ncategory: [x]\nclients: [claude-code]\nruns_scripts: true\n`;

/** A downloader that "downloads" a local fixture instead of touching the network. */
const fromFixture =
  (kind: "malicious" | "benign", dir: string) => async (_s: unknown, dest: string) => {
    await cp(path.join(fixtures, kind, dir), dest, { recursive: true });
  };

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "aisle-prpr-"));
});

describe("auditEntries", () => {
  it("a malicious entry fails and the comment says why in plain words", async () => {
    const results = await auditEntries(
      [{ file: "registry/community/x02.yaml", text: yaml("x02") }],
      { rootDir: root, download: fromFixture("malicious", "x02"), now },
    );
    expect(results[0]?.report?.grade).toBe("F");
    expect(failed(results)).toBe(true);
    const comment = renderComment(results);
    expect(comment.startsWith(MARKER)).toBe(true);
    expect(comment).toContain("cannot be merged yet");
    expect(comment).toContain("Critical findings cannot be suppressed by the author");
    expect(comment).toContain("x02@1.0.0, grade F");
    expect(comment).toContain("AA-X02");
    expect(comment).toContain("Why:");
    expect(comment).toContain("Fix:");
    expect(comment).toContain("not a guarantee of safety");
    expect(comment).toMatchSnapshot();
  });

  it("a benign entry passes", async () => {
    const results = await auditEntries(
      [{ file: "registry/community/commit-helper.yaml", text: yaml("commit-helper") }],
      { rootDir: root, download: fromFixture("benign", "commit-helper"), now },
    );
    expect(results[0]?.report?.grade).toBe("A");
    expect(failed(results)).toBe(false);
    expect(renderComment(results)).toContain("No critical findings");
  });

  it("an invalid entry or a failed download is a problem, not a pass", async () => {
    const bad = await auditEntries([{ file: "registry/community/nope.yaml", text: "name: [" }], {
      rootDir: root,
      now,
    });
    expect(bad[0]?.problem).toMatch(/not valid/);
    expect(failed(bad)).toBe(true);
    const down = await auditEntries(
      [{ file: "registry/community/gone.yaml", text: yaml("gone") }],
      {
        rootDir: root,
        now,
        download: async () => {
          throw new Error("commit not found");
        },
      },
    );
    expect(down[0]?.problem).toMatch(/commit not found/);
    expect(renderComment(down)).toContain("Could not audit: ");
  });

  it("says so when nothing changed, and shortens a huge report", () => {
    expect(renderComment([])).toContain("No community entries changed.");
    const big = Array.from({ length: 400 }, () => "x".repeat(200)).join("\n");
    const report = {
      skill: "big",
      version: "1.0.0",
      auditedAt: now.toISOString(),
      auditVersion: "1.0.0",
      files: 1,
      bytes: 1,
      counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      grade: "A" as const,
      findings: [],
      disclaimer: big,
    };
    const text = renderComment([{ file: "f", name: "big", report }]);
    expect(text.length).toBeLessThan(65_000);
    expect(text).toContain("Report shortened");
  });
});
