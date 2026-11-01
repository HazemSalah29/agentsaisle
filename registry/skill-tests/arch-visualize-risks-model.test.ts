import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Risk = {
  id: string;
  severity: string;
  nodes: string[];
  evidence: { file: string; line: number; note?: string }[];
  fixes: { text: string; tradeoff: string }[];
  source: string;
  title: string;
  check: string;
};
type RiskMod = {
  findRisks: (root: string, model: unknown) => { risks: Risk[] };
  toSarif: (risks: Risk[], modelPath: string) => Loose;
  FAN_OUT_LIMIT: number;
};
const mod = await loadScript<RiskMod>("arch-visualize", "scripts/risk-check.mjs");
const root = mkdtempSync(path.join(tmpdir(), "arch-risk-model-"));
const CANARY = "CANARY-SECRET-DO-NOT-READ";

const ev = (file: string, line = 1, note?: string) => ({ file, line, ...(note ? { note } : {}) });
const node = (id: string, extra: Loose = {}): Loose => ({
  id,
  label: id,
  role: "backend",
  tech: "generic-backend",
  tier: "backend",
  evidence: [ev(`${id}.ts`)],
  ...extra,
});
const edge = (id: string, from: string, to: string, extra: Loose = {}): Loose => ({
  id,
  from,
  to,
  sync: true,
  evidence: [ev(`${id}.ts`, 3)],
  ...extra,
});
const base = (over: Loose = {}): Loose => ({
  version: 2,
  project: "t",
  nodes: [node("a"), node("b"), node("c")],
  edges: [edge("a-b", "a", "b"), edge("a-c", "a", "c")],
  flows: [],
  risks: [],
  ...over,
});
const ids = (m: Loose) => mod.findRisks(root, m).risks.map((r) => r.id);
const only = (m: Loose, id: string) => mod.findRisks(root, m).risks.find((r) => r.id === id);

type Case = { rule: string; name: string; model: Loose; fires: boolean };
const flow = (steps: Loose[]) => [{ id: "f", name: "F", steps }];
const manyEdges = (n: number) => Array.from({ length: n }, (_, i) => edge(`e${i}`, "a", `n${i}`));
const manyNodes = (n: number) => Array.from({ length: n }, (_, i) => node(`n${i}`));
const together = (n: number) =>
  flow(Array.from({ length: n }, (_, i) => ({ edge: `e${i}`, ...(i ? { together: true } : {}) })));

const cases: Case[] = [
  // R11: only fires when some calls record a timeout and others do not
  {
    rule: "AV-R11",
    name: "one call has a timeout, one does not",
    fires: true,
    model: base({ edges: [edge("a-b", "a", "b", { timeoutMs: 500 }), edge("a-c", "a", "c")] }),
  },
  { rule: "AV-R11", name: "no timeouts recorded at all", fires: false, model: base() },
  {
    rule: "AV-R11",
    name: "every synchronous call has one",
    fires: false,
    model: base({
      edges: [edge("a-b", "a", "b", { timeoutMs: 1 }), edge("a-c", "a", "c", { timeoutMs: 2 })],
    }),
  },
  {
    rule: "AV-R11",
    name: "the call without a timeout is asynchronous",
    fires: false,
    model: base({
      edges: [edge("a-b", "a", "b", { timeoutMs: 1 }), edge("a-c", "a", "c", { sync: false })],
    }),
  },
  // R12
  {
    rule: "AV-R12",
    name: "retries and no backoff noted",
    fires: true,
    model: base({ edges: [edge("a-b", "a", "b", { retries: 3 })] }),
  },
  {
    rule: "AV-R12",
    name: "backoff noted in the evidence",
    fires: false,
    model: base({
      edges: [
        edge("a-b", "a", "b", {
          retries: 3,
          evidence: [ev("x.ts", 1, "exponential backoff with jitter")],
        }),
      ],
    }),
  },
  {
    rule: "AV-R12",
    name: "no retries",
    fires: false,
    model: base({ edges: [edge("a-b", "a", "b", { retries: 0 })] }),
  },
  // R13
  {
    rule: "AV-R13",
    name: "crosses zones without TLS",
    fires: true,
    model: base({
      nodes: [node("a", { zone: "public" }), node("b", { zone: "private" })],
      edges: [edge("a-b", "a", "b", { tls: false })],
    }),
  },
  {
    rule: "AV-R13",
    name: "crosses zones with no authentication",
    fires: true,
    model: base({
      nodes: [node("a", { zone: "dmz" }), node("b", { zone: "third-party" })],
      edges: [edge("a-b", "a", "b", { auth: "none" })],
    }),
  },
  {
    rule: "AV-R13",
    name: "crosses zones with TLS and a token",
    fires: false,
    model: base({
      nodes: [node("a", { zone: "public" }), node("b", { zone: "private" })],
      edges: [edge("a-b", "a", "b", { tls: true, auth: "jwt" })],
    }),
  },
  {
    rule: "AV-R13",
    name: "no TLS inside one zone",
    fires: false,
    model: base({
      nodes: [node("a", { zone: "private" }), node("b", { zone: "private" })],
      edges: [edge("a-b", "a", "b", { tls: false })],
    }),
  },
  {
    rule: "AV-R13",
    name: "zones unknown",
    fires: false,
    model: base({ edges: [edge("a-b", "a", "b", { tls: false })] }),
  },
  // R14
  {
    rule: "AV-R14",
    name: "personal data to a third party",
    fires: true,
    model: base({
      nodes: [node("a"), node("b", { zone: "third-party" })],
      edges: [edge("a-b", "a", "b", { carries: ["pii"] })],
    }),
  },
  {
    rule: "AV-R14",
    name: "personal data to a logging component",
    fires: true,
    model: base({
      nodes: [node("a"), node("b", { data: ["logs"] })],
      edges: [edge("a-b", "a", "b", { carries: ["pii"] })],
    }),
  },
  {
    rule: "AV-R14",
    name: "a third party holds personal data",
    fires: true,
    model: base({ nodes: [node("a", { data: ["pii"], zone: "third-party" })], edges: [] }),
  },
  {
    rule: "AV-R14",
    name: "personal data stays in the private zone",
    fires: false,
    model: base({
      nodes: [node("a"), node("b", { zone: "private", data: ["pii"] })],
      edges: [edge("a-b", "a", "b", { carries: ["pii"] })],
    }),
  },
  {
    rule: "AV-R14",
    name: "payments go to a third party, not personal data",
    fires: false,
    model: base({
      nodes: [node("a"), node("b", { zone: "third-party" })],
      edges: [edge("a-b", "a", "b", { carries: ["payments"] })],
    }),
  },
  // R15
  {
    rule: "AV-R15",
    name: "an agent with Bash and no grade",
    fires: true,
    model: base({ nodes: [node("a", { ai: { kind: "agent", tools: ["Read", "Bash"] } })] }),
  },
  {
    rule: "AV-R15",
    name: "a skill that can write, no grade",
    fires: true,
    model: base({ nodes: [node("a", { ai: { kind: "skill", tools: ["Write"] } })] }),
  },
  {
    rule: "AV-R15",
    name: "read-only tools",
    fires: false,
    model: base({ nodes: [node("a", { ai: { kind: "agent", tools: ["Read", "Grep"] } })] }),
  },
  {
    rule: "AV-R15",
    name: "write tools but graded",
    fires: false,
    model: base({
      nodes: [
        node("a", {
          ai: { kind: "agent", tools: ["Bash"], auditGrade: "A", auditSource: "a.json" },
        }),
      ],
    }),
  },
  {
    rule: "AV-R15",
    name: "an LLM provider is not an agent",
    fires: false,
    model: base({ nodes: [node("a", { ai: { kind: "llm-provider", tools: ["Write"] } })] }),
  },
  // R16
  {
    rule: "AV-R16",
    name: "grade D",
    fires: true,
    model: base({
      nodes: [node("a", { ai: { kind: "skill", auditGrade: "D", auditSource: "a.json" } })],
    }),
  },
  {
    rule: "AV-R16",
    name: "grade F",
    fires: true,
    model: base({
      nodes: [node("a", { ai: { kind: "mcp-server", auditGrade: "F", auditSource: "a.json" } })],
    }),
  },
  {
    rule: "AV-R16",
    name: "grade B",
    fires: false,
    model: base({
      nodes: [node("a", { ai: { kind: "skill", auditGrade: "B", auditSource: "a.json" } })],
    }),
  },
  // R17
  {
    rule: "AV-R17",
    name: "five calls in one step",
    fires: true,
    model: base({ nodes: [node("a"), ...manyNodes(5)], edges: manyEdges(5), flows: together(5) }),
  },
  {
    rule: "AV-R17",
    name: "four calls in one step",
    fires: false,
    model: base({ nodes: [node("a"), ...manyNodes(4)], edges: manyEdges(4), flows: together(4) }),
  },
  {
    rule: "AV-R17",
    name: "five calls in five separate steps",
    fires: false,
    model: base({
      nodes: [node("a"), ...manyNodes(5)],
      edges: manyEdges(5),
      flows: flow(Array.from({ length: 5 }, (_, i) => ({ edge: `e${i}` }))),
    }),
  },
  {
    rule: "AV-R17",
    name: "five asynchronous calls in one step",
    fires: false,
    model: base({
      nodes: [node("a"), ...manyNodes(5)],
      edges: manyEdges(5).map((e) => ({ ...e, sync: false })),
      flows: together(5),
    }),
  },
  // R18
  {
    rule: "AV-R18",
    name: "one replica used by three flows",
    fires: true,
    model: base({
      nodes: [node("a", { replicas: 1 }), node("b")],
      edges: [edge("a-b", "a", "b")],
      flows: [1, 2, 3].map((i) => ({ id: `f${i}`, name: `F${i}`, steps: [{ edge: "a-b" }] })),
    }),
  },
  {
    rule: "AV-R18",
    name: "one replica used by two flows",
    fires: false,
    model: base({
      nodes: [node("a", { replicas: 1 }), node("b")],
      edges: [edge("a-b", "a", "b")],
      flows: [1, 2].map((i) => ({ id: `f${i}`, name: `F${i}`, steps: [{ edge: "a-b" }] })),
    }),
  },
  {
    rule: "AV-R18",
    name: "three replicas, three flows",
    fires: false,
    model: base({
      nodes: [node("a", { replicas: 3 }), node("b")],
      edges: [edge("a-b", "a", "b")],
      flows: [1, 2, 3].map((i) => ({ id: `f${i}`, name: `F${i}`, steps: [{ edge: "a-b" }] })),
    }),
  },
  {
    rule: "AV-R18",
    name: "replicas unknown",
    fires: false,
    model: base({
      nodes: [node("a", { replicas: "unknown" }), node("b")],
      edges: [edge("a-b", "a", "b")],
      flows: [1, 2, 3].map((i) => ({ id: `f${i}`, name: `F${i}`, steps: [{ edge: "a-b" }] })),
    }),
  },
];

describe("arch-visualize model-driven risk rules (AV-R11 to AV-R18)", () => {
  it("has a seeded case and a benign case for every rule", () => {
    for (let n = 11; n <= 18; n++) {
      const id = `AV-R${n}`;
      expect(
        cases.some((c) => c.rule === id && c.fires),
        `${id} seeded`,
      ).toBe(true);
      expect(
        cases.some((c) => c.rule === id && !c.fires),
        `${id} benign`,
      ).toBe(true);
    }
  });

  it.each(cases)("$rule: $name", ({ rule, model, fires }) => {
    const got = ids(model);
    if (fires) expect(got).toContain(rule);
    else expect(got).not.toContain(rule);
  });

  it("names the components and edges, carries the options, and points at evidence", () => {
    const r = only(cases[0]!.model, "AV-R11")!;
    expect(r.nodes).toEqual(["a"]);
    expect(r.evidence[0]).toMatchObject({ file: "a-c.ts", line: 3 });
    expect(r.evidence[0]!.note).toContain("a-c");
    expect(r.fixes.length).toBeGreaterThan(0);
    expect(r.source).toBe("rule");
    expect(["info", "warn"]).toContain(r.severity);
  });

  it("makes no risk out of a v1-style model that records none of the new facts", () => {
    const m = JSON.parse(
      readFileSync(skillFile("arch-visualize", "evals/fixture-model.json"), "utf8"),
    );
    const got = ids(m).filter((id) => Number(id.slice(-2)) >= 11);
    expect(got).toEqual([]);
  });

  it("works on the v2 fixture without crashing and is deterministic", () => {
    const m = JSON.parse(
      readFileSync(skillFile("arch-visualize", "evals/fixture-model-v2.json"), "utf8"),
    );
    expect(JSON.stringify(mod.findRisks(root, m).risks)).toBe(
      JSON.stringify(mod.findRisks(root, m).risks),
    );
  });

  it("limits fan-out at four calls", () => {
    expect(mod.FAN_OUT_LIMIT).toBe(4);
  });
});

describe("arch-visualize SARIF", () => {
  const model = JSON.parse(
    readFileSync(skillFile("arch-visualize", "evals/fixture-model.json"), "utf8"),
  );
  const risks = model.risks as Risk[];

  const validator = () => {
    const require = createRequire(
      path.join(skillFile("arch-visualize", "../../.."), "packages/audit/package.json"),
    );
    const Ajv = require("ajv");
    const raw = JSON.parse(
      readFileSync(
        path.join(
          skillFile("arch-visualize", "../../.."),
          "packages/audit/test/schemas/sarif-schema-2.1.0.json",
        ),
        "utf8",
      ),
    ) as Loose;
    const schema: Loose = { ...raw, $id: raw.id };
    delete schema.id;
    delete schema.$schema;
    return new (Ajv.default ?? Ajv)({ strict: false, allErrors: true }).compile(schema);
  };

  it("is valid SARIF 2.1.0", () => {
    const validate = validator();
    const sarif = mod.toSarif(risks, "docs/architecture.json");
    expect(validate(sarif), JSON.stringify(validate.errors?.slice(0, 3))).toBe(true);
    expect(sarif.version).toBe("2.1.0");
    const empty = mod.toSarif([], "docs/architecture.json");
    expect(validate(empty)).toBe(true);
  });

  it("has one rule per id, one result per risk, and points at the model and at evidence", () => {
    const sarif = mod.toSarif(risks, "docs/architecture.json");
    const run = sarif.runs[0];
    expect(run.results).toHaveLength(risks.length);
    const ruleIds = run.tool.driver.rules.map((r: Loose) => r.id);
    expect(new Set(ruleIds).size).toBe(ruleIds.length);
    for (const res of run.results) {
      expect(ruleIds).toContain(res.ruleId);
      expect(run.tool.driver.rules[res.ruleIndex].id).toBe(res.ruleId);
      expect(res.locations[0].physicalLocation.artifactLocation.uri).toBe("docs/architecture.json");
      expect(res.locations.length).toBeLessThanOrEqual(6);
      expect(res.message.text).toMatch(/Possible risk to check/);
      for (const loc of res.locations) {
        expect(loc.physicalLocation.artifactLocation.uri).not.toMatch(/^\/|\.\./);
        expect(loc.physicalLocation.region.startLine).toBeGreaterThanOrEqual(1);
      }
    }
    const rule = run.tool.driver.rules.find((r: Loose) => r.id === "AV-R01");
    expect(rule.help.text).toContain("trade-off");
    expect(["warning", "note"]).toContain(rule.defaultConfiguration.level);
  });

  it("is deterministic and carries no date and no secret", () => {
    const a = JSON.stringify(mod.toSarif(risks, "m.json"));
    expect(JSON.stringify(mod.toSarif([...risks].reverse(), "m.json"))).toBe(a);
    expect(a).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(a).not.toContain(CANARY);
  });

  it("also lists an agent's own risk", () => {
    const agent: Risk = {
      id: "agent-1",
      title: "Docker socket mounted",
      severity: "warn",
      nodes: ["a"],
      evidence: [ev("docker-compose.yml", 9, "mounts the socket")],
      why: "w",
      check: "Check it.",
      fixes: [],
      source: "agent",
    } as Risk;
    const sarif = mod.toSarif([agent], "m.json");
    expect(sarif.runs[0].results[0].ruleId).toBe("agent-1");
    expect(validator()(sarif)).toBe(true);
  });

  it("is written by risk-check --format sarif, leaving the model unchanged", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "arch-sarif-"));
    const file = path.join(dir, "docs-model.json");
    writeFileSync(file, JSON.stringify(model));
    const out = path.join(dir, "out", "a.sarif");
    const before = readFileSync(file, "utf8");
    const r = spawnSync(
      process.execPath,
      [
        skillFile("arch-visualize", "scripts/risk-check.mjs"),
        "--model",
        file,
        "--root",
        skillFile("arch-visualize", "evals/fixture-app"),
        "--format",
        "sarif",
        "--out",
        out,
      ],
      { encoding: "utf8" },
    );
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(JSON.parse(readFileSync(out, "utf8")).version).toBe("2.1.0");
    expect(r.stdout.trim().split("\n").length).toBeLessThanOrEqual(40);
    expect(
      spawnSync(
        process.execPath,
        [skillFile("arch-visualize", "scripts/risk-check.mjs"), "--model", file, "--format", "pdf"],
        { encoding: "utf8" },
      ).status,
    ).toBe(2);
  });
});
