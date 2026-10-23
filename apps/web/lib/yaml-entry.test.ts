import { CommunityEntry } from "@agentsaisle/registry-schema";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { emptyDraft, entryToYaml, fieldErrors, newFileUrl, type EntryDraft } from "./yaml-entry";

const SHA = "3f9c2e1a".repeat(5);
const good: EntryDraft = {
  name: "reel-scriptwriter",
  author: "someone",
  repo: "someone/their-skills",
  path: "skills/reel-scriptwriter",
  versions: [
    { version: "1.1.0", ref: "v1.1.0", sha: SHA },
    { version: "1.0.0", ref: "main", sha: "a81b77d0".repeat(5) },
  ],
  category: ["video", "social"],
  clients: ["claude-code", "codex"],
  runs_scripts: false,
};

describe("entryToYaml", () => {
  it("round-trips through the yaml package and the registry schema", () => {
    const parsed = parse(entryToYaml(good));
    expect(parsed).toEqual({ ...good });
    expect(CommunityEntry.safeParse(parsed).success).toBe(true);
  });
  it("quotes SHAs so an all-digit SHA stays a string", () => {
    const digits = "1".repeat(40);
    const parsed = parse(
      entryToYaml({ ...good, versions: [{ version: "1.0.0", ref: "v1", sha: digits }] }),
    );
    expect(parsed.versions[0].sha).toBe(digits);
    expect(typeof parsed.versions[0].sha).toBe("string");
  });
  it("keeps tricky values as strings", () => {
    const parsed = parse(
      entryToYaml({
        ...good,
        author: "yes",
        category: ["no", "on-call"],
        path: "skills/a b",
        versions: [{ version: "1.0.0", ref: "1e5", sha: SHA }],
      }),
    );
    expect(parsed.author).toBe("yes");
    expect(parsed.category).toEqual(["no", "on-call"]);
    expect(parsed.path).toBe("skills/a b");
    expect(parsed.versions[0].ref).toBe("1e5");
  });
  it("never writes verified", () => {
    expect(entryToYaml(good)).not.toContain("verified");
  });
  it("writes runs_scripts as a boolean", () => {
    expect(parse(entryToYaml({ ...good, runs_scripts: true })).runs_scripts).toBe(true);
  });
});

describe("fieldErrors", () => {
  it("is empty for a valid entry", () => {
    expect(fieldErrors(good)).toEqual({});
  });
  it("says Required for an empty draft", () => {
    const e = fieldErrors(emptyDraft);
    expect(e.name).toBe("Required");
    expect(e.repo).toBe("Required");
    expect(e["versions.0.sha"]).toBe("Required");
    expect(e.category).toBe("Pick or add at least one");
  });
  it("explains bad values in plain language", () => {
    const e = fieldErrors({
      ...good,
      name: "Bad_Name",
      repo: "not-a-repo",
      versions: [{ version: "v1", ref: "x", sha: "abc" }],
    });
    expect(e.name).toMatch(/^Must be lowercase kebab-case/);
    expect(e.repo).toMatch(/<owner>\/<repo>/);
    expect(e["versions.0.version"]).toMatch(/semantic version/);
    expect(e["versions.0.sha"]).toMatch(/40-character/);
  });
});

describe("newFileUrl", () => {
  it("prefills the file name and content for GitHub", () => {
    const url = new URL(newFileUrl("reel-scriptwriter", entryToYaml(good)));
    expect(url.pathname).toBe("/HazemSalah29/agentsaisle/new/main/registry/community");
    expect(url.searchParams.get("filename")).toBe("reel-scriptwriter.yaml");
    expect(url.searchParams.get("value")).toBe(entryToYaml(good));
  });
});
