import { describe, expect, it } from "vitest";
import {
  AuditReport,
  CommunityEntry,
  OfficialMeta,
  Profile,
  Question,
  RegistryIndex,
  SkillFrontmatter,
  compareSemver,
  splitFrontmatter,
} from "./index";

const sha = "a".repeat(40);
const valid = {
  name: "reel-scriptwriter",
  author: "someone",
  repo: "someone/skills",
  path: "skills/reel-scriptwriter",
  versions: [{ version: "1.0.0", ref: "v1.0.0", sha }],
  category: ["video"],
  clients: ["claude-code"],
  runs_scripts: false,
};

describe("CommunityEntry", () => {
  it("accepts a valid entry and defaults verified to false", () => {
    expect(CommunityEntry.parse(valid).verified).toBe(false);
  });
  it("rejects bad names, short SHAs and unknown keys", () => {
    expect(CommunityEntry.safeParse({ ...valid, name: "Bad_Name" }).success).toBe(false);
    expect(
      CommunityEntry.safeParse({ ...valid, versions: [{ version: "1.0.0", ref: "v", sha: "abc" }] })
        .success,
    ).toBe(false);
    expect(CommunityEntry.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});

describe("OfficialMeta / SkillFrontmatter", () => {
  it("validates meta", () => {
    expect(
      OfficialMeta.safeParse({
        version: "1.0.0",
        category: ["code"],
        clients: ["codex"],
        runs_scripts: false,
      }).success,
    ).toBe(true);
    expect(
      OfficialMeta.safeParse({ version: "1", category: [], clients: [], runs_scripts: false })
        .success,
    ).toBe(false);
  });
  it("allows extra frontmatter keys", () => {
    expect(
      SkillFrontmatter.safeParse({ name: "x", description: "d", "allowed-tools": "Read" }).success,
    ).toBe(true);
  });
});

describe("helpers", () => {
  it("splits frontmatter", () => {
    expect(splitFrontmatter("---\nname: a\n---\nbody")).toEqual({
      frontmatter: "name: a",
      body: "body",
    });
    expect(splitFrontmatter("no fm")).toBeNull();
  });
  it("compares semver", () => {
    expect(compareSemver("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareSemver("1.0.0-beta", "1.0.0")).toBeLessThan(0);
  });
});

describe("profiles and questions", () => {
  it("keeps older registries without profiles valid", () => {
    const idx = RegistryIndex.parse({ generatedAt: "2026-01-01T00:00:00.000Z", skills: [] });
    expect(idx.profiles).toEqual([]);
    expect(idx.questions).toEqual([]);
  });
  it("validates profiles and questions", () => {
    expect(
      Profile.safeParse({ id: "code", name: "Code", description: "d", skills: ["explore"] })
        .success,
    ).toBe(true);
    expect(
      Profile.safeParse({ id: "Code!", name: "Code", description: "d", skills: ["explore"] })
        .success,
    ).toBe(false);
    expect(
      Profile.safeParse({ id: "code", name: "Code", description: "d", skills: [] }).success,
    ).toBe(false);
    const q = {
      id: "kind",
      prompt: "What?",
      options: [
        { label: "A", adds: ["explore"] },
        { label: "B", adds: [] },
      ],
    };
    expect(Question.safeParse(q).success).toBe(true);
    expect(Question.safeParse({ ...q, options: [q.options[0]] }).success).toBe(false);
  });
});

describe("house standard meta fields", () => {
  const base = {
    version: "1.0.0",
    category: ["code"],
    clients: ["claude-code"],
    runs_scripts: false,
  };
  const full = {
    ...base,
    niche: "design",
    kind: "quality",
    tier: "specialty",
    tested: {
      model: "claude-sonnet-5-5",
      date: "2026-10-23",
      tasks: 30,
      token_savings_median: 0.42,
      success_rate: 0.9,
      baseline_success_rate: 0.7,
      preferred_in_blind_test: 0.65,
    },
    permissions: {
      tools: ["Read", "Write"],
      writes_files: true,
      runs_scripts: false,
      network: false,
      needs_api_keys: [],
    },
    demo: { url: "https://demo.example.dev", screenshots: ["preview/home-1440.png"] },
  };

  it("keeps V1 meta valid with none of the new fields", () => {
    expect(OfficialMeta.safeParse(base).success).toBe(true);
  });
  it("accepts every new field", () => {
    expect(OfficialMeta.safeParse(full).success).toBe(true);
  });
  it("rejects bad values and unknown nested keys", () => {
    expect(OfficialMeta.safeParse({ ...full, kind: "fast" }).success).toBe(false);
    expect(OfficialMeta.safeParse({ ...full, tier: "gold" }).success).toBe(false);
    expect(
      OfficialMeta.safeParse({ ...full, tested: { ...full.tested, date: "yesterday" } }).success,
    ).toBe(false);
    expect(
      OfficialMeta.safeParse({ ...full, tested: { ...full.tested, success_rate: 1.2 } }).success,
    ).toBe(false);
    expect(
      OfficialMeta.safeParse({ ...full, permissions: { ...full.permissions, shell: true } })
        .success,
    ).toBe(false);
    expect(OfficialMeta.safeParse({ ...full, demo: { url: "not a url" } }).success).toBe(false);
    expect(OfficialMeta.safeParse({ ...full, demo: { url: "//evil.example/x" } }).success).toBe(
      false,
    );
    expect(OfficialMeta.safeParse({ ...full, demo: { url: "/demos/a b.html" } }).success).toBe(
      false,
    );
  });
  it("allows a skill to use more tokens than the baseline", () => {
    expect(
      OfficialMeta.safeParse({ ...full, tested: { ...full.tested, token_savings_median: -0.08 } })
        .success,
    ).toBe(true);
  });
  it("accepts a demo path on this site and an optional caption", () => {
    const demo = { url: "/demos/arch-visualize/devpath.html", caption: "What the preview shows." };
    expect(OfficialMeta.parse({ ...base, demo }).demo).toEqual({ ...demo, screenshots: [] });
    expect(OfficialMeta.safeParse({ ...base, demo: { caption: "" } }).success).toBe(false);
  });
  it("defaults demo screenshots to an empty list", () => {
    expect(
      OfficialMeta.parse({ ...base, demo: { url: "https://demo.example.dev" } }).demo?.screenshots,
    ).toEqual([]);
  });
  it("keeps older registries without houseRules valid", () => {
    const idx = RegistryIndex.parse({ generatedAt: "2026-01-01T00:00:00.000Z", skills: [] });
    expect(idx.houseRules).toBeUndefined();
    expect(
      RegistryIndex.parse({ generatedAt: "x", skills: [], houseRules: "rules" }).houseRules,
    ).toBe("rules");
  });
});

describe("AuditReport", () => {
  const base = {
    skill: "demo",
    auditedAt: "2026-10-24T00:00:00.000Z",
    auditVersion: "1.0.0",
    files: 1,
    bytes: 10,
    counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    grade: "A",
    findings: [],
    disclaimer: "Not a guarantee.",
  };
  it("accepts a clean report", () => {
    expect(AuditReport.parse(base).grade).toBe("A");
  });
  it("rejects bad rule ids and long excerpts", () => {
    const finding = {
      rule: "AA-X02",
      severity: "high",
      title: "t",
      file: "a",
      why: "w",
      fix: "f",
      source: "static",
    };
    expect(AuditReport.safeParse({ ...base, findings: [finding] }).success).toBe(true);
    expect(AuditReport.safeParse({ ...base, findings: [{ ...finding, rule: "X2" }] }).success).toBe(
      false,
    );
    expect(
      AuditReport.safeParse({ ...base, findings: [{ ...finding, excerpt: "x".repeat(161) }] })
        .success,
    ).toBe(false);
  });
});
