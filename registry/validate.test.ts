import { describe, expect, it } from "vitest";
import { validateEntryFile, type GitHubApi, type ValidateContext } from "./validate";

const SHA = "3f9c2e1a".repeat(5);
const skillMd = (name: string) =>
  `---\nname: ${name}\ndescription: Does ${name}.\n---\n# ${name}\n`;

const entry = (over: Record<string, string> = {}) => {
  const f = {
    name: "reel-scriptwriter",
    author: "someone",
    repo: "someone/skills",
    path: "skills/reel-scriptwriter",
    runs: "false",
    verified: "",
    sha: `"${SHA}"`,
    ...over,
  };
  return `name: ${f.name}
author: ${f.author}
repo: ${f.repo}
path: ${f.path}
versions:
  - version: "1.0.0"
    ref: v1.0.0
    sha: ${f.sha}
category: [video]
clients: [claude-code]
runs_scripts: ${f.runs}
${f.verified}`;
};

function fakeGitHub(over: Partial<GitHubApi> = {}): GitHubApi {
  return {
    repoIsPublic: async () => true,
    commitExists: async () => true,
    rawFile: async () => skillMd("reel-scriptwriter"),
    listFiles: async () => ({ paths: ["skills/reel-scriptwriter/SKILL.md"], truncated: false }),
    ...over,
  };
}

const ctx = (over: Partial<ValidateContext> = {}): ValidateContext => ({
  github: fakeGitHub(),
  takenNames: new Set(["explore"]),
  allowVerified: false,
  ...over,
});

const FILE = "registry/community/reel-scriptwriter.yaml";
const errors = async (text: string, c = ctx(), file = FILE) =>
  (await validateEntryFile(file, text, c)).filter((f) => f.level === "error").map((f) => f.message);

describe("validateEntryFile", () => {
  it("passes a good entry with no errors", async () => {
    expect(await validateEntryFile(FILE, entry(), ctx())).toEqual([]);
  });

  it("rejects invalid YAML and non-yaml files", async () => {
    expect((await errors("name: [unclosed"))[0]).toMatch(/Not valid YAML/);
    expect((await errors(entry(), ctx(), "registry/community/x.yml"))[0]).toMatch(
      /must be \.yaml files/,
    );
  });

  it("reports a bad name and a short SHA with the field name", async () => {
    const msgs = await errors(entry({ name: "Bad_Name", sha: '"abc123"' }));
    expect(msgs.some((m) => /^name: .*kebab-case/.test(m))).toBe(true);
    expect(msgs.some((m) => /versions\.0\.sha: .*40-character/.test(m))).toBe(true);
  });

  it("explains a SHA that YAML parsed as a number", async () => {
    const msgs = await errors(entry({ sha: "1".repeat(40) }));
    expect(msgs.join("\n")).toMatch(/sha: .*YAML read this as a number.*quotes/);
  });

  it("rejects unknown fields", async () => {
    expect((await errors(entry() + "bogus: 1\n")).join("\n")).toMatch(/bogus|Unrecognized/i);
  });

  it("requires the file name to match the entry name", async () => {
    expect((await errors(entry(), ctx(), "registry/community/other.yaml"))[0]).toMatch(
      /File name must be "reel-scriptwriter\.yaml"/,
    );
  });

  it("rejects a duplicate name", async () => {
    const msgs = await errors(entry(), ctx({ takenNames: new Set(["reel-scriptwriter"]) }));
    expect(msgs).toEqual([
      'A skill named "reel-scriptwriter" already exists. Names must be unique.',
    ]);
  });

  it("rejects verified: true unless a maintainer runs the check", async () => {
    expect((await errors(entry({ verified: "verified: true" }))).join()).toMatch(
      /only be set by a maintainer/,
    );
    expect(
      await errors(entry({ verified: "verified: true" }), ctx({ allowVerified: true })),
    ).toEqual([]);
  });

  it("rejects duplicate versions", async () => {
    const dup = entry().replace(
      "category:",
      `  - version: "1.0.0"\n    ref: v1\n    sha: "${SHA}"\ncategory:`,
    );
    expect((await errors(dup)).join()).toMatch(/Version 1\.0\.0 is listed more than once/);
  });

  it("rejects a missing or private repository and stops there", async () => {
    const msgs = await errors(
      entry(),
      ctx({ github: fakeGitHub({ repoIsPublic: async () => false }) }),
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/someone\/skills was not found, or it is private/);
  });

  it("rejects a commit that does not exist", async () => {
    const msgs = await errors(
      entry(),
      ctx({ github: fakeGitHub({ commitExists: async () => false }) }),
    );
    expect(msgs[0]).toMatch(/Version 1\.0\.0 \(3f9c2e1\): commit not found/);
  });

  it("rejects a missing SKILL.md, bad frontmatter and a name mismatch", async () => {
    const gh = (rawFile: GitHubApi["rawFile"]) => ctx({ github: fakeGitHub({ rawFile }) });
    expect(
      (
        await errors(
          entry(),
          gh(async () => undefined),
        )
      )[0],
    ).toMatch(/no SKILL\.md at "skills\/reel-scriptwriter\/SKILL\.md"/);
    expect(
      (
        await errors(
          entry(),
          gh(async () => "# nothing"),
        )
      )[0],
    ).toMatch(/no frontmatter/);
    expect(
      (
        await errors(
          entry(),
          gh(async () => "---\nname: x\n---\n"),
        )
      )[0],
    ).toMatch(/frontmatter is invalid/);
    expect(
      (
        await errors(
          entry(),
          gh(async () => skillMd("other-name")),
        )
      )[0],
    ).toMatch(/SKILL\.md name is "other-name" but the entry name is "reel-scriptwriter"/);
  });

  it("errors when scripts/ exists but runs_scripts is false", async () => {
    const github = fakeGitHub({
      listFiles: async () => ({
        paths: ["skills/reel-scriptwriter/SKILL.md", "skills/reel-scriptwriter/scripts/run.sh"],
        truncated: false,
      }),
    });
    const msgs = await errors(entry(), ctx({ github }));
    expect(msgs[0]).toMatch(
      /contains a scripts\/ folder \(scripts\/run\.sh\) but runs_scripts is false/,
    );
  });

  it("only notes scripts/ when runs_scripts is true", async () => {
    const github = fakeGitHub({
      listFiles: async () => ({
        paths: ["skills/reel-scriptwriter/scripts/run.sh"],
        truncated: false,
      }),
    });
    const findings = await validateEntryFile(FILE, entry({ runs: "true" }), ctx({ github }));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ level: "notice" });
    expect(findings[0]!.message).toMatch(/scripts to review in full.*scripts\/run\.sh/);
  });

  it("ignores scripts/ folders that belong to other skills in the repo", async () => {
    const github = fakeGitHub({
      listFiles: async () => ({
        paths: ["skills/other/scripts/a.sh", "scripts/ci.sh"],
        truncated: false,
      }),
    });
    expect(await validateEntryFile(FILE, entry(), ctx({ github }))).toEqual([]);
  });

  it("warns when the file list was truncated", async () => {
    const github = fakeGitHub({ listFiles: async () => ({ paths: [], truncated: true }) });
    const findings = await validateEntryFile(FILE, entry(), ctx({ github }));
    expect(findings).toEqual([expect.objectContaining({ level: "warning" })]);
  });

  it("fails closed with a clear message when GitHub cannot be reached", async () => {
    const github = fakeGitHub({
      repoIsPublic: async () => {
        throw new Error("could not look up someone/skills (HTTP 403, possibly rate limited)");
      },
    });
    expect((await errors(entry(), ctx({ github })))[0]).toMatch(
      /Could not verify against GitHub: .*rate limited.*Re-run/,
    );
  });
});
