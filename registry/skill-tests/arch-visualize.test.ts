import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Evidence = { file: string; line: number; note?: string };
type Node = { id: string; role: string; tech: string; tier: string; evidence: Evidence[] };
type Model = {
  version: 1;
  project: string;
  nodes: Node[];
  edges: { id: string; from: string; to: string; evidence?: Evidence[] }[];
  flows: unknown[];
  risks: unknown[];
  inferred?: string[];
};
type Check = {
  checkModel: (m: unknown, o?: { draft?: boolean }) => string[];
  loadSchema: () => { $defs: { role: { enum: string[] }; tier: { enum: string[] } } };
};
type Discover = { TIER_OF_ROLE: Record<string, string> };

const FIXTURE = skillFile("arch-visualize", "evals/fixture-app");
const expected = JSON.parse(
  readFileSync(skillFile("arch-visualize", "evals/expected.json"), "utf8"),
);
const script = (n: string) => skillFile("arch-visualize", `scripts/${n}`);
const CANARY = "CANARY-SECRET-DO-NOT-READ";

const tmp = () => mkdtempSync(path.join(tmpdir(), "arch-viz-"));
const run = (file: string, args: string[], cwd?: string) =>
  spawnSync(process.execPath, [script(file), ...args], { encoding: "utf8", cwd });

/** A copy of the fixture with real-looking secret files that discovery must never open. */
function fixtureWithSecrets() {
  const root = path.join(tmp(), "app");
  cpSync(FIXTURE, root, { recursive: true });
  for (const f of [".env", ".env.local", ".env.production.local", "apps/api/.env", "server.pem"])
    writeFileSync(path.join(root, f), `DATABASE_URL=${CANARY}\nSTRIPE_SECRET_KEY=${CANARY}\n`);
  return root;
}

const discover = (root: string, out: string) => {
  const r = run("discover.mjs", ["--root", root, "--out", out]);
  return { ...r, model: existsSync(out) ? (JSON.parse(readFileSync(out, "utf8")) as Model) : null };
};

describe("arch-visualize discovery", () => {
  const out = path.join(tmp(), "draft.json");
  const result = discover(FIXTURE, out);
  const model = result.model!;

  it("exits 0 and writes a draft model", () => {
    expect(result.status).toBe(0);
    expect(model.version).toBe(1);
    expect(model.project).toBe("shop");
    expect(model.flows).toEqual([]);
  });

  it("finds every expected node with its role, tech and evidence lines", () => {
    expect(model.nodes.map((n) => n.id).sort()).toEqual(
      expected.nodes.map((n: { id: string }) => n.id).sort(),
    );
    for (const want of expected.nodes) {
      const got = model.nodes.find((n) => n.id === want.id)!;
      expect(got.role, want.id).toBe(want.role);
      expect(got.tech, want.id).toBe(want.tech);
      for (const ev of want.evidence)
        expect(
          got.evidence.some((e) => e.file === ev.file && e.line === ev.line),
          `${want.id} evidence ${ev.file}:${ev.line}`,
        ).toBe(true);
    }
  });

  it("drafts edges from depends_on", () => {
    expect(model.edges.map((e) => e.id).sort()).toEqual([...expected.edges].sort());
    expect(model.edges.every((e) => e.evidence?.[0]?.file === "docker-compose.yml")).toBe(true);
  });

  it("passes model-check as a draft", () => {
    const r = run("model-check.mjs", ["--model", out, "--draft"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/model ok: 9 nodes, 5 edges/);
  });

  it("is deterministic", () => {
    const again = path.join(tmp(), "draft.json");
    discover(FIXTURE, again);
    expect(readFileSync(again, "utf8")).toBe(readFileSync(out, "utf8"));
  });

  it("keeps stdout within 40 lines", () => {
    expect(result.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(40);
  });

  it("never opens secret files: the canary appears nowhere", () => {
    const root = fixtureWithSecrets();
    const o = path.join(tmp(), "draft.json");
    const r = discover(root, o);
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).not.toContain(CANARY);
    expect(readFileSync(o, "utf8")).not.toContain(CANARY);
    expect(r.stdout).toMatch(/5 secret-named file\(s\) never opened/);
    // Same model as the clean fixture: the secret files change nothing.
    expect(readFileSync(o, "utf8")).toBe(readFileSync(out, "utf8"));
  });

  it("reads env example key names only", () => {
    const root = path.join(tmp(), "app");
    mkdirSync(root);
    writeFileSync(path.join(root, ".env.example"), `REDIS_URL=${CANARY}\n`);
    const o = path.join(tmp(), "d.json");
    const r = discover(root, o);
    expect(r.model!.nodes.map((n) => n.tech)).toEqual(["redis"]);
    expect(readFileSync(o, "utf8")).not.toContain(CANARY);
  });

  it("works when started through a symlinked skill folder", () => {
    const link = path.join(tmp(), "skill-link");
    symlinkSync(skillFile("arch-visualize", "."), link);
    const o = path.join(tmp(), "d.json");
    const r = spawnSync(
      process.execPath,
      [path.join(link, "scripts/discover.mjs"), "--root", FIXTURE, "--out", o],
      {
        encoding: "utf8",
      },
    );
    expect(r.status).toBe(0);
    expect(readFileSync(o, "utf8")).toBe(readFileSync(out, "utf8"));
  });

  it("caps the files it visits", () => {
    const root = path.join(tmp(), "big");
    mkdirSync(root);
    for (let i = 0; i < 2100; i++) writeFileSync(path.join(root, `f${i}.txt`), "x");
    const r = discover(root, path.join(tmp(), "d.json"));
    expect(r.stdout).toMatch(/stopped at 2,000 files/);
  });
});

describe("arch-visualize model-check", () => {
  const valid = (): Model => ({
    version: 1,
    project: "shop",
    nodes: [
      {
        id: "api",
        label: "API",
        role: "backend",
        tech: "express",
        tier: "backend",
        evidence: [{ file: "a.json", line: 1 }],
      },
      {
        id: "db",
        label: "DB",
        role: "database",
        tech: "postgresql",
        tier: "data",
        evidence: [{ file: "b.yml", line: 2 }],
      },
    ],
    edges: [{ id: "api-db", from: "api", to: "db", evidence: [{ file: "src/db.ts", line: 3 }] }],
    flows: [
      {
        id: "f",
        name: "Load",
        steps: [
          { edge: "api-db", label: "SELECT" },
          { edge: "api-db", reverse: true },
        ],
      },
    ],
    risks: [],
  });
  let check: Check;
  const problems = async (mutate: (m: Model) => void, o?: { draft?: boolean }) => {
    check ??= await loadScript<Check>("arch-visualize", "scripts/model-check.mjs");
    const m = valid();
    mutate(m);
    return check.checkModel(m, o);
  };

  it("accepts a valid model", async () => expect(await problems(() => {})).toEqual([]));

  it("catches a dangling edge", async () =>
    expect((await problems((m) => (m.edges[0].to = "cache"))).join("\n")).toMatch(
      /to "cache" is not a node/,
    ));

  it("catches a flow step that points at a missing edge", async () =>
    expect(
      (
        await problems(
          (m) => ((m.flows as { steps: { edge: string }[] }[])[0].steps[0].edge = "nope"),
        )
      ).join("\n"),
    ).toMatch(/edge "nope" does not exist/));

  it("catches missing evidence unless the item is inferred", async () => {
    expect((await problems((m) => (m.nodes[0].evidence = []))).join("\n")).toMatch(
      /needs evidence/,
    );
    expect(
      await problems((m) => {
        m.nodes[0].evidence = [];
        m.inferred = ["node:api"];
      }),
    ).toEqual([]);
  });

  it("catches an inferred entry that points at nothing", async () =>
    expect((await problems((m) => (m.inferred = ["edge:ghost"]))).join("\n")).toMatch(
      /does not exist/,
    ));

  it("catches an unknown role and an unknown tech", async () => {
    expect((await problems((m) => (m.nodes[0].role = "gateway"))).join("\n")).toMatch(/not one of/);
    expect((await problems((m) => (m.nodes[0].tech = "cobol-db"))).join("\n")).toMatch(
      /unknown tech/,
    );
  });

  it("catches credential-looking strings without echoing them", async () => {
    const secret = "sk_live_" + "a1b2c3d4e5f6g7h8i9j0";
    const out = (await problems((m) => (m.nodes[0].label = `Key ${secret}`))).join("\n");
    expect(out).toMatch(/looks like a credential/);
    expect(out).not.toContain(secret);
    expect(
      (await problems((m) => (m.edges[0].protocol = "postgres://admin:hunter22@db/x"))).join("\n"),
    ).toMatch(/credential/);
  });

  it("rejects absolute or parent-relative evidence paths", async () => {
    expect(
      (await problems((m) => (m.nodes[0].evidence[0].file = "/etc/passwd"))).join("\n"),
    ).toMatch(/relative/);
    expect((await problems((m) => (m.nodes[0].evidence[0].file = "../x"))).join("\n")).toMatch(
      /relative/,
    );
  });

  it("needs a flow unless the model is a draft", async () => {
    expect((await problems((m) => (m.flows = []))).join("\n")).toMatch(/at least one request flow/);
    expect(await problems((m) => (m.flows = []), { draft: true })).toEqual([]);
  });

  it("allows hostile label text (it is escaped by the viewer, not rejected here)", async () =>
    expect(
      await problems((m) => (m.nodes[0].label = "</script><img src=x onerror=alert(1)>")),
    ).toEqual([]));

  it("keeps the schema enums in step with discover's tier map", async () => {
    const c = await loadScript<Check>("arch-visualize", "scripts/model-check.mjs");
    const d = await loadScript<Discover>("arch-visualize", "scripts/discover.mjs");
    const s = c.loadSchema();
    expect(Object.keys(d.TIER_OF_ROLE).sort()).toEqual([...s.$defs.role.enum].sort());
    expect(
      [...new Set(Object.values(d.TIER_OF_ROLE))].every((t) => s.$defs.tier.enum.includes(t)),
    ).toBe(true);
  });

  it("exits 1 with a capped list on a bad model and 2 on a missing file", () => {
    const bad = path.join(tmp(), "m.json");
    const m = valid();
    m.edges = Array.from({ length: 80 }, (_, i) => ({ id: `e${i}`, from: "x", to: "y" }));
    writeFileSync(bad, JSON.stringify(m));
    const r = run("model-check.mjs", ["--model", bad]);
    expect(r.status).toBe(1);
    expect(r.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(40);
    expect(run("model-check.mjs", ["--model", path.join(tmp(), "none.json")]).status).toBe(2);
  });
});

describe("arch-visualize files", () => {
  it("keeps every script small enough to read and prints nothing outside the cap", () => {
    const dir = skillFile("arch-visualize", "scripts");
    for (const f of readdirSync(dir)) expect(statSync(path.join(dir, f)).size).toBeLessThan(40_000);
  });

  it("has no network or process APIs in the scripts", () => {
    const dir = skillFile("arch-visualize", "scripts");
    for (const f of readdirSync(dir)) {
      const src = readFileSync(path.join(dir, f), "utf8");
      expect(src, f).not.toMatch(
        /node:(http|https|net|child_process|dns|worker_threads)|\bfetch\(|\beval\(|require\(/,
      );
    }
  });
});
