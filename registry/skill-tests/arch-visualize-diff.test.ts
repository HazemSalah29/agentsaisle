import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadLib, skillFile } from "./load";

type Ev = { file: string; line?: number };
type Node = Record<string, unknown> & { id: string; evidence?: Ev[] };
type Edge = Record<string, unknown> & { id: string; from: string; to: string };
type Model = { project: string; nodes: Node[]; edges: Edge[]; risks?: { id: string }[] };
type Diff = {
  kind: string;
  empty: boolean;
  counts: Record<string, number>;
  nodes: {
    added: Node[];
    removed: Node[];
    changed: { id: string; changes: { field: string; before: unknown; after: unknown }[] }[];
    renamed: { from: string; to: string }[];
  };
  edges: {
    added: Edge[];
    removed: Edge[];
    changed: { id: string; changes: { field: string }[] }[];
  };
  risks: { added: { id: string }[]; removed: { id: string }[] };
};

const { ArchDiff } = loadLib<{ ArchDiff: { diff: (a: unknown, b: unknown) => Diff } }>(
  "arch-visualize",
  ["assets/lib/diff.js"],
);
const diff = (a: Model, b: Model): Diff => JSON.parse(JSON.stringify(ArchDiff.diff(a, b)));

const ev = (file: string) => [{ file, line: 1 }];
const base = (): Model => ({
  project: "p",
  nodes: [
    { id: "api", label: "API", tech: "express", role: "backend", evidence: ev("api/package.json") },
    { id: "db", label: "DB", tech: "postgresql", role: "database", evidence: ev("compose.yml") },
    { id: "cache", label: "Cache", tech: "redis", role: "cache", evidence: ev("compose.yml") },
  ],
  edges: [
    { id: "api-db", from: "api", to: "db", sync: true, protocol: "SQL" },
    { id: "api-cache", from: "api", to: "cache", sync: true },
  ],
  risks: [{ id: "r1" }],
});
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe("arch-visualize diff: matching and changes", () => {
  it("an identical model gives an empty diff", () => {
    const d = diff(base(), base());
    expect(d.empty).toBe(true);
    expect(d.kind).toBe("arch-diff");
  });

  it("lists added and removed components and connections", () => {
    const head = base();
    head.nodes.push({ id: "mail", label: "Mail", tech: "resend", role: "external" });
    head.edges.push({ id: "api-mail", from: "api", to: "mail", sync: false });
    head.nodes = head.nodes.filter((n) => n.id !== "cache");
    head.edges = head.edges.filter((e) => e.id !== "api-cache");
    const d = diff(base(), head);
    expect(d.nodes.added.map((n) => n.id)).toEqual(["mail"]);
    expect(d.nodes.removed.map((n) => n.id)).toEqual(["cache"]);
    expect(d.edges.added.map((e) => e.id)).toEqual(["api-mail"]);
    expect(d.edges.removed.map((e) => e.id)).toEqual(["api-cache"]);
  });

  it.each([
    ["label", "Primary DB"],
    ["tech", "mysql"],
    ["zone", "private"],
    ["replicas", 2],
    ["owner", "data-team"],
  ])("reports a changed component fact: %s", (field, value) => {
    const head = base();
    head.nodes[1] = { ...head.nodes[1], [field]: value };
    const d = diff(base(), head);
    expect(d.nodes.changed).toHaveLength(1);
    expect(d.nodes.changed[0].changes.map((c) => c.field)).toEqual([field]);
    expect(d.nodes.changed[0].changes[0].after).toBe(value);
  });

  it.each([
    ["protocol", "gRPC"],
    ["sync", false],
    ["auth", "mtls"],
    ["tls", true],
    ["timeoutMs", 3000],
    ["retries", 2],
    ["optional", true],
  ])("reports a changed connection fact: %s", (field, value) => {
    const head = base();
    head.edges[0] = { ...head.edges[0], [field]: value };
    const d = diff(base(), head);
    expect(d.edges.changed.map((c) => c.changes.map((x) => x.field))).toEqual([[field]]);
  });

  it("compares data and carries as sets, so order is not a change", () => {
    const a = base();
    a.nodes[1] = { ...a.nodes[1], data: ["pii", "orders"] };
    a.edges[0] = { ...a.edges[0], carries: ["pii", "orders"] };
    const b = clone(a);
    b.nodes[1].data = ["orders", "pii"];
    b.edges[0].carries = ["orders", "pii"];
    expect(diff(a, b).empty).toBe(true);
    b.edges[0].carries = ["orders"];
    expect(diff(a, b).edges.changed).toHaveLength(1);
  });

  it("does not treat a moved evidence line as a change", () => {
    const head = base();
    head.nodes[0].evidence = [{ file: "api/package.json", line: 99 }];
    expect(diff(base(), head).empty).toBe(true);
  });

  it("detects a rename by technology and a shared evidence file", () => {
    const head = base();
    head.nodes[2] = { ...head.nodes[2], id: "redis" };
    head.edges[1] = { ...head.edges[1], to: "redis" };
    const d = diff(base(), head);
    expect(d.nodes.renamed.map((r) => [r.from, r.to])).toEqual([["cache", "redis"]]);
    expect(d.nodes.added).toHaveLength(0);
    expect(d.nodes.removed).toHaveLength(0);
    // the connection moved with it and is the same connection
    expect(d.edges.added).toHaveLength(0);
    expect(d.edges.removed).toHaveLength(0);
  });

  it("matches a connection whose id changed with its renamed end", () => {
    const head = base();
    head.nodes[2] = { ...head.nodes[2], id: "redis" };
    head.edges[1] = { id: "api-redis", from: "api", to: "redis", sync: true };
    const d = diff(base(), head);
    expect(d.edges.added).toHaveLength(0);
    expect(d.edges.removed).toHaveLength(0);
  });

  it("does not guess when two components could match", () => {
    const a = base();
    a.nodes.push({ id: "cache2", tech: "redis", role: "cache", evidence: ev("compose.yml") });
    const b = clone(a);
    b.nodes[2].id = "r1x";
    b.nodes[3].id = "r2x";
    const d = diff(a, b);
    expect(d.nodes.renamed).toHaveLength(0);
    expect(d.nodes.added).toHaveLength(2);
    expect(d.nodes.removed).toHaveLength(2);
  });

  it("does not call two different technologies a rename", () => {
    const head = base();
    head.nodes[2] = { ...head.nodes[2], id: "memcached", tech: "memcached" };
    const d = diff(base(), head);
    expect(d.nodes.renamed).toHaveLength(0);
  });

  it("lists new and gone risks", () => {
    const head = base();
    head.risks = [{ id: "r2" }];
    const d = diff(base(), head);
    expect(d.risks.added.map((r) => r.id)).toEqual(["r2"]);
    expect(d.risks.removed.map((r) => r.id)).toEqual(["r1"]);
  });

  it("is byte-identical whatever the order of the input lists", () => {
    const head = base();
    head.nodes.push({ id: "mail", tech: "resend", role: "external" });
    head.nodes.push({ id: "auth", tech: "auth0", role: "external" });
    const shuffled = clone(head);
    shuffled.nodes.reverse();
    expect(JSON.stringify(diff(base(), head))).toBe(JSON.stringify(diff(base(), shuffled)));
  });
});

const script = skillFile("arch-visualize", "scripts/diff.mjs");
const run = (args: string[], cwd?: string) =>
  spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd });
const fixture = (name: string) => skillFile("arch-visualize", `evals/${name}`);
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "av-diff-"));

describe("arch-visualize diff.mjs", () => {
  it("diffs the fixture pair and writes a diff file", () => {
    const out = path.join(tmp(), "d.json");
    const r = run([
      "--base",
      fixture("fixture-model-base.json"),
      "--head",
      fixture("fixture-model-v2.json"),
      "--out",
      out,
    ]);
    expect(r.status).toBe(0);
    const d = JSON.parse(readFileSync(out, "utf8")) as Diff;
    expect(d.nodes.added.map((n) => n.id)).toEqual(["vercel"]);
    expect(d.nodes.removed.map((n) => n.id)).toEqual(["legacy-cron"]);
    expect(d.nodes.renamed.map((n) => [n.from, n.to])).toEqual([["redis", "cache"]]);
    expect(d.edges.changed.map((e) => e.id)).toEqual(["api-db", "api-stripe"]);
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(40);
    expect(r.stdout).toContain("renamed: redis to cache");
  });

  it("says so when nothing changed", () => {
    const out = path.join(tmp(), "d.json");
    const m = fixture("fixture-model-v2.json");
    const r = run(["--base", m, "--head", m, "--out", out]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("No architecture changes");
  });

  it("accepts a version 1 model as the base", () => {
    const out = path.join(tmp(), "d.json");
    const r = run([
      "--base",
      fixture("fixture-model.json"),
      "--head",
      fixture("fixture-model-v2.json"),
      "--out",
      out,
    ]);
    expect(r.status).toBe(0);
  });

  it("exits 2 for a missing flag, a missing file and an invalid model", () => {
    const dir = tmp();
    expect(run([]).status).toBe(2);
    expect(
      run(["--base", path.join(dir, "no.json"), "--head", fixture("fixture-model-v2.json")]).status,
    ).toBe(2);
    writeFileSync(path.join(dir, "bad.json"), JSON.stringify({ version: 2, nodes: [] }));
    const r = run([
      "--base",
      path.join(dir, "bad.json"),
      "--head",
      fixture("fixture-model-v2.json"),
      "--out",
      path.join(dir, "o.json"),
    ]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("base model has problems");
  });

  it("will not overwrite a file that is not a diff without --force", () => {
    const dir = tmp();
    const out = path.join(dir, "notes.json");
    writeFileSync(out, '{"mine":true}');
    const m = fixture("fixture-model-v2.json");
    expect(run(["--base", m, "--head", m, "--out", out]).status).toBe(2);
    expect(readFileSync(out, "utf8")).toBe('{"mine":true}');
    expect(run(["--base", m, "--head", m, "--out", out, "--force"]).status).toBe(0);
    // an earlier diff is replaced without asking
    expect(run(["--base", m, "--head", m, "--out", out]).status).toBe(0);
  });

  it("strips control codes from labels in the terminal output", () => {
    const dir = tmp();
    const head = JSON.parse(readFileSync(fixture("fixture-model-v2.json"), "utf8")) as Model;
    head.nodes[0].label = "Hosting\u001b[31m";
    writeFileSync(path.join(dir, "h.json"), JSON.stringify(head));
    const r = run([
      "--base",
      fixture("fixture-model-v2.json"),
      "--head",
      path.join(dir, "h.json"),
      "--out",
      path.join(dir, "o.json"),
    ]);
    expect(r.status).toBe(0);
    // eslint-disable-next-line no-control-regex -- checking that none got through
    expect(r.stdout).not.toMatch(/\u001b/);
  });

  it("works through a symlinked skill folder", () => {
    const dir = tmp();
    const link = path.join(dir, "linked");
    symlinkSync(path.dirname(path.dirname(script)), link);
    mkdirSync(path.join(dir, "docs"));
    const m = fixture("fixture-model-v2.json");
    const r = spawnSync(
      process.execPath,
      [
        path.join(link, "scripts", "diff.mjs"),
        "--base",
        m,
        "--head",
        m,
        "--out",
        path.join(dir, "d.json"),
      ],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("No architecture changes");
  });

  it("stays small, offline and free of dynamic code", () => {
    expect(statSync(script).size).toBeLessThan(40 * 1024);
    const text =
      readFileSync(script, "utf8") +
      readFileSync(skillFile("arch-visualize", "assets/lib/diff.js"), "utf8");
    expect(text).not.toMatch(/\bfetch\(|node:(https?|net|child_process)|\beval\(|new Function/);
  });
});
