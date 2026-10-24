import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { AuditReport } from "@agentsaisle/registry-schema";
import { describe, expect, it } from "vitest";
import {
  GRADES,
  RULES,
  RULE_GROUPS,
  auditSkill,
  formatMarkdown,
  formatMarkdownMany,
  formatSarif,
  ruleInfo,
} from "../src/index.js";
import { MALICIOUS } from "./cases.js";
import { makeSkill } from "./helpers.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "..", "fixtures");
const NOW = new Date("2026-10-24T12:00:00.000Z");

/** The OASIS schema is JSON Schema draft-04; ajv 8 reads draft-07, so map the two draft-04 keywords. */
function sarifValidator() {
  const raw = JSON.parse(
    readFileSync(path.join(here, "schemas", "sarif-schema-2.1.0.json"), "utf8"),
  ) as Record<string, unknown>;
  const schema: Record<string, unknown> = { ...raw, $id: raw.id };
  delete schema.id;
  delete schema.$schema;
  return new Ajv({ strict: false, allErrors: true }).compile(schema);
}

const x02 = () => auditSkill(path.join(fixtures, "malicious", "x02"), { now: NOW });

describe("inventory", () => {
  it("lists tools, scripts, urls and domains and parses with the report schema", async () => {
    const dir = makeSkill("inv", {
      "SKILL.md":
        "---\nname: inv\ndescription: Inventory test.\nallowed-tools: Read Bash(node *)\n---\n\n# inv\n\nDocs at https://docs.example.com/guide and http://localhost:3000/x.\n",
      "scripts/run.mjs": "// see https://api.example.org/v1\nconsole.log(1);\n",
    });
    const report = await auditSkill(dir, { now: NOW });
    expect(AuditReport.parse(report).inventory).toEqual({
      tools: ["Read", "Bash(node *)"],
      scripts: ["scripts/run.mjs"],
      urls: [
        "http://localhost:3000/x",
        "https://api.example.org/v1",
        "https://docs.example.com/guide",
      ],
      domains: ["api.example.org", "docs.example.com"],
    });
  });

  it("an old stored report without inventory still parses", async () => {
    const old: Record<string, unknown> = { ...(await x02()) };
    delete old.inventory;
    expect(AuditReport.safeParse(old).success).toBe(true);
  });
});

describe("catalog", () => {
  it("lists every rule id used in the code, once", () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const srcDir = path.join(here, "..", "src");
    const files = [
      ...readdirSync(srcDir).filter((f) => f.endsWith(".ts") && f !== "catalog.ts"),
      ...readdirSync(path.join(srcDir, "rules")).map((f) => `rules/${f}`),
    ];
    const src = files.map((f) => readFileSync(path.join(srcDir, f), "utf8")).join("\n");
    const inCode = [...new Set(src.match(/AA-[A-Z]\d{2}/g))].sort();
    expect([...ids].sort()).toEqual(inCode);
  });

  it("covers every rule a malicious fixture triggers, with matching groups", () => {
    for (const c of MALICIOUS) expect(ruleInfo(c.rule), c.rule).toBeTruthy();
    for (const g of RULE_GROUPS)
      for (const r of g.rules) expect(r.id.startsWith(`AA-${g.prefix}`)).toBe(true);
    expect(GRADES.map((g) => g.grade)).toEqual(["A", "B", "C", "D", "F"]);
  });
});

describe("markdown", () => {
  it("matches the snapshot for a malicious fixture", async () => {
    expect(formatMarkdown(await x02())).toMatchSnapshot();
  });

  it("puts critical findings in the open, hides the rest in details, and carries the disclaimer", async () => {
    const md = formatMarkdown(await x02());
    expect(md).toContain("grade F");
    expect(md).toContain("#### Critical (");
    expect(md).toContain("not a guarantee of safety");
    const clean = formatMarkdown(
      await auditSkill(path.join(fixtures, "benign", "commit-helper"), { now: NOW }),
    );
    expect(clean).toContain("No findings.");
    expect(clean).toContain(
      "Automated checks found no known risky patterns. This is not a guarantee of safety.",
    );
    expect(clean).toContain("What this skill can use");
  });

  it("joins several reports", async () => {
    const r = await x02();
    expect(formatMarkdownMany([r, r]).split("\n---\n").length).toBe(2);
  });
});

describe("sarif", () => {
  it("is valid SARIF 2.1.0 for a malicious fixture", async () => {
    const validate = sarifValidator();
    const log = JSON.parse(formatSarif(await x02()));
    expect(validate(log), JSON.stringify(validate.errors?.slice(0, 3))).toBe(true);
  });

  it("is valid for every malicious fixture combined, and for a clean skill", async () => {
    const validate = sarifValidator();
    const reports = [];
    for (const c of MALICIOUS.filter((m) => !m.runtime))
      reports.push(await auditSkill(path.join(fixtures, "malicious", c.id), { now: NOW }));
    const log = JSON.parse(formatSarif(reports));
    expect(validate(log), JSON.stringify(validate.errors?.slice(0, 3))).toBe(true);
    expect(log.runs[0].results.length).toBeGreaterThan(10);
    const clean = JSON.parse(
      formatSarif(await auditSkill(path.join(fixtures, "benign", "commit-helper"), { now: NOW })),
    );
    expect(validate(clean)).toBe(true);
    expect(clean.runs[0].results).toEqual([]);
  });

  it("maps severities, rule indexes, fingerprints and path prefixes", async () => {
    const report = await x02();
    const log = JSON.parse(formatSarif(report, { pathPrefix: { [report.skill]: "skills/x02" } }));
    const run = log.runs[0];
    const crit = run.results.find((r: { ruleId: string }) => r.ruleId === "AA-X02");
    expect(crit.level).toBe("error");
    expect(run.tool.driver.rules[crit.ruleIndex].id).toBe("AA-X02");
    expect(crit.partialFingerprints["aisleAudit/v1"]).toMatch(/^[0-9a-f]{32}$/);
    expect(crit.locations[0].physicalLocation.artifactLocation.uri).toMatch(/^skills\/x02\//);
    expect(run.results.every((r: { level: string }) => r.level !== undefined)).toBe(true);
    // info inventory findings are not alerts
    expect(run.results.some((r: { ruleId: string }) => r.ruleId === "AA-P06")).toBe(false);
  });

  it("carries author suppressions as SARIF suppressions", async () => {
    const dir = makeSkill("sup", {
      "SKILL.md":
        "---\nname: sup\ndescription: Suppression test.\n---\n\n# sup\n\nSee http://example.com/legacy for the old endpoint.\n",
      ".aisleaudit.yaml":
        "ignore:\n  - rule: AA-N01\n    path: SKILL.md\n    reason: Documents an old HTTP-only endpoint; no requests are made.\n",
    });
    const log = JSON.parse(formatSarif(await auditSkill(dir, { now: NOW })));
    const hit = log.runs[0].results.find((r: { ruleId: string }) => r.ruleId === "AA-N01");
    expect(hit.suppressions[0].kind).toBe("inSource");
    expect(hit.suppressions[0].justification).toContain("old HTTP-only");
  });
});
