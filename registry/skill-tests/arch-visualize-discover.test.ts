import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Ev = { file: string; line: number; note?: string };
type Cand = {
  id: string;
  from: string;
  to: string;
  protocol?: string;
  sync: boolean;
  confidence: "high" | "medium" | "low";
  why: string;
  evidence: Ev[];
  timeoutMs?: number;
  retries?: number;
  optional?: boolean;
  confirms?: string;
};
type Draft = {
  nodes: {
    id: string;
    role: string;
    tech: string;
    replicas?: number;
    ai?: { kind: string; tools?: string[] };
    evidence: Ev[];
  }[];
  edges: { id: string; from: string; to: string }[];
  candidates: Cand[];
};
const mod = await loadScript<{ discover: (root: string) => { model: Draft; report: unknown } }>(
  "arch-visualize",
  "scripts/discover.mjs",
);
const CANARY = "CANARY-SECRET-DO-NOT-READ";
const tmp = () => mkdtempSync(path.join(tmpdir(), "arch-disc-"));
const json = (v: unknown) => JSON.stringify(v, null, 2);
const pkg = (deps: string[], name = "app") =>
  json({ name, dependencies: Object.fromEntries(deps.map((d) => [d, "1.0.0"])) });

/** Write a small project and run discovery on it. */
function draft(files: Record<string, string>) {
  const root = path.join(tmp(), "proj");
  for (const [f, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    writeFileSync(path.join(root, f), text);
  }
  return { root, ...mod.discover(root) };
}
const find = (d: Draft, id: string) => d.candidates.find((c) => c.id === id);
/** An api app next to a Redis, a queue and a payments dependency, with `src` as its only source file. */
const app = (src: string, deps = ["express", "ioredis", "bullmq", "stripe"]) => ({
  "apps/api/package.json": pkg(deps, "api"),
  "apps/api/src/x.ts": src,
});

describe("arch-visualize edge candidates: clients and hosts", () => {
  it("a client import with a constructor is high, an import alone is medium", () => {
    const strong = draft(app('import Redis from "ioredis";\nconst r = new Redis();\n')).model;
    expect(find(strong, "api-redis")).toMatchObject({
      confidence: "high",
      sync: true,
      protocol: "TCP (Redis)",
    });
    expect(find(strong, "api-redis")!.evidence[0]).toMatchObject({
      file: "apps/api/src/x.ts",
      line: 2,
    });
    const weak = draft(app('import Redis from "ioredis";\nexport const t = Redis;\n')).model;
    expect(find(weak, "api-redis")).toMatchObject({ confidence: "medium" });
  });

  it("a file that imports nothing known proposes nothing, and neither does a comment or a test file", () => {
    expect(draft(app("export const x = 1;\n")).model.candidates).toEqual([]);
    expect(draft(app('// import Redis from "ioredis"; new Redis()\n')).model.candidates).toEqual(
      [],
    );
    const inTest = draft({
      "apps/api/package.json": pkg(["express", "ioredis"], "api"),
      "apps/api/src/x.test.ts": 'import Redis from "ioredis";\nnew Redis();\n',
    }).model;
    expect(inTest.candidates).toEqual([]);
  });

  it("reads CommonJS requires too", () => {
    const m = draft(app('const Redis = require("ioredis");\nconst r = new Redis();\n')).model;
    expect(find(m, "api-redis")).toMatchObject({ confidence: "high" });
  });

  it("a literal API host maps to the service; an unknown host and a comment do not", () => {
    const hit = draft(app('await fetch("https://api.stripe.com/v1/charges");\n')).model;
    expect(find(hit, "api-stripe")).toMatchObject({ confidence: "medium", protocol: "HTTPS" });
    expect(draft(app('await fetch("https://example.org/v1");\n')).model.candidates).toEqual([]);
    expect(draft(app('// await fetch("https://api.stripe.com/v1")\n')).model.candidates).toEqual(
      [],
    );
  });

  it("an env name that matches a component gives a medium candidate, and never the value", () => {
    const files = {
      ...app('const url = process.env.INVENTORY_URL;\nawait fetch(url + "/stock");\n'),
      "apps/inventory/package.json": pkg(["express"], "inventory"),
    };
    const m = draft(files).model;
    expect(find(m, "api-inventory")).toMatchObject({
      confidence: "medium",
      why: "reads INVENTORY_URL",
    });
    const none = draft({
      ...app("const url = process.env.ELSEWHERE_URL;\n"),
      "apps/inventory/package.json": pkg(["express"], "inventory"),
    }).model;
    expect(find(none, "api-inventory")).toBeUndefined();
    const redis = draft(app("const url = process.env.REDIS_URL;\n")).model;
    expect(find(redis, "api-redis")).toMatchObject({ confidence: "medium" });
  });

  it("does not connect an app to itself", () => {
    const m = draft(app('const u = process.env.API_URL;\nimport Redis from "ioredis";\n')).model;
    expect(m.candidates.every((c) => c.from !== c.to)).toBe(true);
  });
});

describe("arch-visualize edge candidates: queues", () => {
  const two = (producer: string, consumer: string) => ({
    "apps/api/package.json": pkg(["express", "bullmq"], "api"),
    "apps/api/src/p.ts": `import { Queue } from "bullmq";\nconst q = new Queue("${producer}");\n`,
    "apps/worker/package.json": pkg(["bullmq"], "worker"),
    "apps/worker/src/c.ts": `import { Worker } from "bullmq";\nnew Worker("${consumer}", async () => {});\n`,
  });
  it("the same queue name on both sides is high, with the right directions and asynchronous", () => {
    const m = draft(two("receipts", "receipts")).model;
    expect(find(m, "api-bullmq")).toMatchObject({ confidence: "high", sync: false });
    expect(find(m, "bullmq-worker")).toMatchObject({ confidence: "high", sync: false });
  });
  it("different names stay separate and medium", () => {
    const m = draft(two("receipts", "emails")).model;
    expect(find(m, "api-bullmq")!.confidence).toBe("medium");
    expect(find(m, "bullmq-worker")!.confidence).toBe("medium");
  });
  it("a producer with no consumer is still proposed, at medium", () => {
    const files = two("receipts", "receipts");
    delete (files as Record<string, string>)["apps/worker/src/c.ts"];
    const m = draft(files).model;
    expect(find(m, "api-bullmq")!.confidence).toBe("medium");
    expect(find(m, "bullmq-worker")).toBeUndefined();
  });
});

describe("arch-visualize edge candidates: timeouts, retries and fallbacks", () => {
  const redis = (body: string) => `import Redis from "ioredis";\n${body}\n`;
  it("takes a literal timeout and retry count from the client's own arguments", () => {
    const m = draft(
      app(redis("const r = new Redis({ commandTimeout: 1500, maxRetries: 3 });")),
    ).model;
    expect(find(m, "api-redis")).toMatchObject({ timeoutMs: 1500, retries: 3 });
    expect(find(m, "api-redis")!.evidence.some((e) => /timeout 1500/.test(e.note ?? ""))).toBe(
      true,
    );
  });
  it("reads AbortSignal.timeout on a fetch", () => {
    const m = draft(
      app('await fetch("https://api.stripe.com/v1", { signal: AbortSignal.timeout(7000) });\n'),
    ).model;
    expect(find(m, "api-stripe")!.timeoutMs).toBe(7000);
  });
  it("does not borrow a neighbouring client's settings", () => {
    const src = redis(
      "const other = { timeout: 9000 };\nconst r = new Redis();\nconst more = { retries: 5 };",
    );
    const c = find(draft(app(src)).model, "api-redis")!;
    expect(c.timeoutMs).toBeUndefined();
    expect(c.retries).toBeUndefined();
  });
  it("marks a connection optional only when every use is guarded by a catch that carries on", () => {
    const guarded = redis(
      "const r = new Redis();\ntry {\n  await r.get('a');\n} catch (e) {\n  console.log('skip');\n}",
    );
    expect(find(draft(app(guarded)).model, "api-redis")!.optional).toBe(true);
    const rethrown = redis(
      "const r = new Redis();\ntry {\n  await r.get('a');\n} catch (e) {\n  throw e;\n}",
    );
    expect(find(draft(app(rethrown)).model, "api-redis")!.optional).toBeUndefined();
    const errorAnswer = redis(
      "const r = new Redis();\nasync function f(res) {\n  try {\n    await r.get('a');\n  } catch (e) {\n    res.status(500).end();\n  }\n}",
    );
    expect(find(draft(app(errorAnswer)).model, "api-redis")!.optional).toBeUndefined();
    const oneOutside = redis(
      "const r = new Redis();\nawait r.get('x');\ntry {\n  await r.get('a');\n} catch (e) {\n  console.log('skip');\n}",
    );
    expect(find(draft(app(oneOutside)).model, "api-redis")!.optional).toBeUndefined();
  });
  it("sees a handled failure on the call, and a circuit breaker import", () => {
    const chained = 'await fetch("https://api.stripe.com/v1").catch(() => null);\n';
    expect(find(draft(app(chained)).model, "api-stripe")!.optional).toBe(true);
    const breaker =
      'import CircuitBreaker from "opossum";\nawait fetch("https://api.stripe.com/v1");\n';
    expect(find(draft(app(breaker)).model, "api-stripe")!.optional).toBe(true);
    expect(
      find(draft(app('await fetch("https://api.stripe.com/v1");\n')).model, "api-stripe")!.optional,
    ).toBeUndefined();
  });
});

describe("arch-visualize edge candidates: compose and Kubernetes", () => {
  const compose = (extra: string) =>
    `services:\n  api:\n    build: ./apps/api\n${extra}  cache:\n    image: redis:7\n`;
  it("a compose link is a medium candidate; deploy replicas become a fact with a line", () => {
    const m = draft({
      "apps/api/package.json": pkg(["express"], "api"),
      "docker-compose.yml": compose("    links:\n      - cache\n    deploy:\n      replicas: 3\n"),
    }).model;
    expect(find(m, "api-cache")).toMatchObject({ confidence: "medium", why: "compose links" });
    const node = m.nodes.find((n) => n.id === "api")!;
    expect(node.replicas).toBe(3);
    expect(node.evidence.some((e) => e.note === "replicas: 3")).toBe(true);
  });
  it("a shared network adds to a suspected connection but does not make one", () => {
    const withNet = draft({
      "apps/api/package.json": pkg(["express"], "api"),
      "apps/api/src/x.ts": 'import Redis from "ioredis";\nnew Redis();\n',
      "docker-compose.yml": `services:\n  api:\n    build: ./apps/api\n    networks:\n      - back\n  cache:\n    image: redis:7\n    networks:\n      - back\nnetworks:\n  back:\n`,
    }).model;
    expect(
      find(withNet, "api-cache")!.evidence.some((e) => /network back/.test(e.note ?? "")),
    ).toBe(true);
    const bare = draft({
      "apps/api/package.json": pkg(["express"], "api"),
      "docker-compose.yml": `services:\n  api:\n    build: ./apps/api\n    networks:\n      - back\n  cache:\n    image: redis:7\n    networks:\n      - back\nnetworks:\n  back:\n`,
    }).model;
    expect(bare.candidates).toEqual([]);
  });
  const k8s = (value: string, reps = "  replicas: 2\n") =>
    `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\nspec:\n${reps}  template:\n    spec:\n      containers:\n        - name: api\n          env:\n            - name: TARGET\n              value: ${value}\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: billing-svc\n`;
  it("a Service host in a Deployment's environment gives a candidate, and replicas a fact", () => {
    const m = draft({
      "apps/api/package.json": pkg(["express"], "api"),
      "apps/billing/package.json": pkg(["express"], "billing"),
      "k8s/api.yaml": k8s('"http://billing-svc:8080"'),
    }).model;
    expect(find(m, "api-billing")).toMatchObject({ confidence: "medium", protocol: "HTTP" });
    expect(m.nodes.find((n) => n.id === "api")!.replicas).toBe(2);
  });
  it("keeps only host names from a manifest, never other values, and ignores YAML that is not Kubernetes", () => {
    const m = draft({
      "apps/api/package.json": pkg(["express"], "api"),
      "apps/billing/package.json": pkg(["express"], "billing"),
      "k8s/api.yaml": k8s(`"http://billing-svc:8080/${CANARY}"`),
      "config/settings.yaml": `kind: Deployment\nname: ${CANARY}\n`,
    }).model;
    expect(JSON.stringify(m)).not.toContain(CANARY);
  });
});

describe("arch-visualize AI layer discovery", () => {
  it("LLM SDKs and vector stores are flagged as AI components", () => {
    const m = draft({
      "apps/api/package.json": pkg(["express", "@anthropic-ai/sdk", "chromadb"], "api"),
    }).model;
    expect(m.nodes.find((n) => n.id === "anthropic")!.ai).toEqual({ kind: "llm-provider" });
    const store = m.nodes.find((n) => n.tech === "chroma")!;
    expect(store.ai).toEqual({ kind: "vector-store" });
    expect(store.role).toBe("search");
  });
  it("an MCP config lists servers as components, with the app beside it as the caller, and no values", () => {
    const m = draft({
      "apps/api/package.json": pkg(["express"], "api"),
      "apps/api/.mcp.json": json({
        mcpServers: {
          docs: { command: "npx", args: ["-y", CANARY], env: { TOKEN: CANARY } },
          files: { command: "x" },
        },
      }),
    }).model;
    expect(m.nodes.filter((n) => n.ai?.kind === "mcp-server").map((n) => n.id)).toEqual([
      "mcp-docs",
      "mcp-files",
    ]);
    expect(find(m, "api-mcp-docs")).toMatchObject({ protocol: "MCP", confidence: "medium" });
    expect(JSON.stringify(m)).not.toContain(CANARY);
  });
  it("a broken MCP config is skipped", () => {
    expect(() =>
      draft({ "apps/api/package.json": pkg(["express"], "api"), "apps/api/.mcp.json": "{ nope" }),
    ).not.toThrow();
  });
  it("a SKILL.md becomes a skill component with its tools, keeping a parenthesised argument whole", () => {
    const m = draft({
      "tools/helper/SKILL.md":
        "---\nname: helper\ndescription: x\nallowed-tools: Read Write Bash(node *)\n---\n# helper\n",
    }).model;
    const n = m.nodes.find((x) => x.ai?.kind === "skill")!;
    expect(n.id).toBe("skill-helper");
    expect(n.ai!.tools).toEqual(["Read", "Write", "Bash(node *)"]);
    expect(n.evidence[0]).toMatchObject({ file: "tools/helper/SKILL.md", line: 4 });
  });
  it("a SKILL.md with no frontmatter or no name is ignored", () => {
    expect(draft({ "a/SKILL.md": "# no frontmatter\n" }).model.nodes).toEqual([]);
    expect(draft({ "a/SKILL.md": "---\ndescription: x\n---\n" }).model.nodes).toEqual([]);
  });
});

describe("arch-visualize discovery on the grown fixture", () => {
  const fixture = skillFile("arch-visualize", "evals/fixture-app");
  const expected = JSON.parse(
    readFileSync(skillFile("arch-visualize", "evals/expected.json"), "utf8"),
  ) as {
    truth: { id: string; from: string; to: string; fileBacked: boolean }[];
    candidates: {
      expected: {
        id: string;
        confidence: string;
        timeoutMs?: number;
        retries?: number;
        optional?: boolean;
      }[];
    };
  };
  const { model } = mod.discover(fixture);
  const pairs = new Set([...model.edges, ...model.candidates].map((e) => `${e.from}>${e.to}`));
  const fileBacked = expected.truth.filter((t) => t.fileBacked);

  it("finds at least 80% of the connections a file shows, from edges and candidates together", () => {
    const found = fileBacked.filter((t) => pairs.has(`${t.from}>${t.to}`));
    expect(found.length / fileBacked.length).toBeGreaterThanOrEqual(0.8);
  });
  it("edges alone find under half of them: that is the weakness candidates fix", () => {
    const edgesOnly = new Set(model.edges.map((e) => `${e.from}>${e.to}`));
    expect(
      fileBacked.filter((t) => edgesOnly.has(`${t.from}>${t.to}`)).length / fileBacked.length,
    ).toBeLessThan(0.5);
  });
  it("proposes nothing that is not a real connection of the fixture (precision)", () => {
    const truth = new Set(expected.truth.map((t) => `${t.from}>${t.to}`));
    expect(model.candidates.filter((c) => !truth.has(`${c.from}>${c.to}`))).toEqual([]);
  });
  it("gives the expected confidence, timeouts, retries and fallback", () => {
    for (const want of expected.candidates.expected) {
      const got = find(model, want.id);
      expect(got, want.id).toBeDefined();
      expect(got!.confidence, want.id).toBe(want.confidence);
      if (want.timeoutMs) expect(got!.timeoutMs, want.id).toBe(want.timeoutMs);
      if (want.retries) expect(got!.retries, want.id).toBe(want.retries);
      if (want.optional) expect(got!.optional, want.id).toBe(true);
    }
  });
  it("points every candidate at a real file and line, and every note is free of values", () => {
    for (const c of model.candidates)
      for (const e of c.evidence) {
        const file = path.join(fixture, e.file);
        expect(existsSync(file), `${c.id} ${e.file}`).toBe(true);
        expect(readFileSync(file, "utf8").split("\n").length).toBeGreaterThanOrEqual(e.line);
        expect(path.isAbsolute(e.file)).toBe(false);
      }
    expect(JSON.stringify(model)).not.toContain(CANARY);
  });
  it("is deterministic", () => {
    expect(JSON.stringify(mod.discover(fixture).model)).toBe(JSON.stringify(model));
  });
  it("passes model-check as a draft and fails as a final model until candidates are resolved", () => {
    const file = path.join(tmp(), "d.json");
    writeFileSync(file, json(model));
    const run = (...a: string[]) =>
      spawnSync(
        process.execPath,
        [skillFile("arch-visualize", "scripts/model-check.mjs"), "--model", file, ...a],
        { encoding: "utf8" },
      );
    expect(run("--draft").status).toBe(0);
    const final = run();
    expect(final.status).toBe(1);
    expect(final.stdout).toContain("edge candidate(s) left");
  });
  it("prints at most 40 lines and names the candidate counts", () => {
    const out = path.join(tmp(), "d.json");
    const r = spawnSync(
      process.execPath,
      [skillFile("arch-visualize", "scripts/discover.mjs"), "--root", fixture, "--out", out],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(
      /\d+ edge candidate\(s\) to confirm or drop \(\d+ high, \d+ medium, \d+ low\)/,
    );
    expect(r.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(40);
  });
  it("keeps every script under 40 KB", () => {
    for (const f of ["discover.mjs", "edges.mjs", "ai-layer.mjs", "k8s.mjs"])
      expect(statSync(skillFile("arch-visualize", `scripts/${f}`)).size, f).toBeLessThan(40_000);
  });
});

describe("arch-visualize discovery never reads secrets", () => {
  it("does not open .env files or echo example values, in the draft or on screen", () => {
    const root = path.join(tmp(), "proj");
    mkdirSync(path.join(root, "apps/api/src"), { recursive: true });
    writeFileSync(path.join(root, "apps/api/package.json"), pkg(["express", "ioredis"], "api"));
    writeFileSync(
      path.join(root, "apps/api/src/x.ts"),
      'import Redis from "ioredis";\nnew Redis(process.env.REDIS_URL);\n',
    );
    writeFileSync(path.join(root, ".env"), `REDIS_URL=${CANARY}\n`);
    writeFileSync(path.join(root, "apps/api/.env.local"), `REDIS_URL=${CANARY}\n`);
    writeFileSync(path.join(root, ".env.example"), `REDIS_URL=redis://user:${CANARY}@cache:6379\n`);
    const out = path.join(root, "draft.json");
    const r = spawnSync(
      process.execPath,
      [skillFile("arch-visualize", "scripts/discover.mjs"), "--root", root, "--out", out],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    expect(readFileSync(out, "utf8")).not.toContain(CANARY);
    expect(r.stdout + r.stderr).not.toContain(CANARY);
  });
});
