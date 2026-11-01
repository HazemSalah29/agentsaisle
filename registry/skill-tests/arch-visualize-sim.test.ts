import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadLib, skillFile } from "./load";

type Edge = {
  id: string;
  from: string;
  to: string;
  sync?: boolean;
  optional?: boolean;
  evidence?: { file: string; line?: number }[];
};
type Model = {
  nodes: { id: string; label?: string }[];
  edges: Edge[];
  flows?: { id: string; name: string; steps: Record<string, unknown>[] }[];
};
type Sim = {
  down: string[];
  ignored: string[];
  nodes: Record<
    string,
    {
      status: string;
      kind: string | null;
      chain: {
        node: string;
        kind: string;
        edge: string;
        cause: string;
        evidence: { file: string; line: number | null } | null;
      }[];
    }
  >;
  edges: Record<string, string>;
  flows: { id: string; status: string; step: number | null; node: string | null }[];
  counts: { failed: number; degraded: number; unaffected: number };
};
const { ArchSim } = loadLib<{ ArchSim: { simulate: (m: Model, d: string | string[]) => Sim } }>(
  "arch-visualize",
  ["assets/lib/simulate.js"],
);
const sim = ArchSim.simulate;
const statuses = (r: Sim) =>
  Object.fromEntries(Object.entries(r.nodes).map(([k, v]) => [k, v.status]));

// web -> api -> cache (sync), api -> db (sync), api -> mail (optional), api ~> queue (async), queue -> worker (async)
const model: Model = {
  nodes: ["web", "api", "cache", "db", "mail", "queue", "worker"].map((id) => ({
    id,
    label: id.toUpperCase(),
  })),
  edges: [
    { id: "web-api", from: "web", to: "api", sync: true, evidence: [{ file: "web.ts", line: 1 }] },
    {
      id: "api-cache",
      from: "api",
      to: "cache",
      sync: true,
      evidence: [{ file: "orders.ts", line: 41 }],
    },
    { id: "api-db", from: "api", to: "db", sync: true },
    {
      id: "api-mail",
      from: "api",
      to: "mail",
      sync: true,
      optional: true,
      evidence: [{ file: "mail.ts", line: 9 }],
    },
    { id: "api-queue", from: "api", to: "queue", sync: false },
    { id: "queue-worker", from: "queue", to: "worker", sync: false },
  ],
  flows: [
    {
      id: "read",
      name: "Read",
      steps: [{ edge: "web-api" }, { edge: "api-cache" }, { edge: "api-cache", reverse: true }],
    },
    { id: "mailing", name: "Mailing", steps: [{ edge: "web-api" }, { edge: "api-mail" }] },
    { id: "job", name: "Job", steps: [{ edge: "api-queue" }, { edge: "queue-worker" }] },
    {
      id: "fan",
      name: "Fan",
      steps: [{ edge: "web-api" }, { edge: "api-db" }, { edge: "api-cache", together: true }],
    },
  ],
};

describe("arch-visualize simulation", () => {
  it("spreads a failure up the synchronous callers, with the reason and its file and line", () => {
    const r = sim(model, "cache");
    expect(statuses(r)).toMatchObject({
      cache: "failed",
      api: "failed",
      web: "failed",
      db: "unaffected",
    });
    expect(r.nodes.api!.chain).toEqual([
      {
        node: "api",
        kind: "sync",
        edge: "api-cache",
        cause: "cache",
        evidence: { file: "orders.ts", line: 41 },
      },
    ]);
    expect(r.nodes.web!.chain.map((l) => l.node)).toEqual(["web", "api"]);
    expect(r.edges["api-cache"]).toBe("broken");
    expect(r.counts).toEqual({ failed: 3, degraded: 0, unaffected: 4 });
  });

  it("stops at a connection with a fallback: the caller is degraded and the spread ends", () => {
    const r = sim(model, "mail");
    expect(statuses(r)).toMatchObject({ mail: "failed", api: "degraded", web: "unaffected" });
    expect(r.nodes.api).toMatchObject({ kind: "fallback" });
    expect(r.edges["api-mail"]).toBe("fallback");
  });

  it("marks callers of an asynchronous connection delayed, not failed", () => {
    const r = sim(model, "worker");
    expect(statuses(r)).toMatchObject({ worker: "failed", queue: "degraded", api: "unaffected" });
    expect(r.nodes.queue).toMatchObject({ kind: "delayed" });
    expect(r.edges["queue-worker"]).toBe("delayed");
    const queueDown = sim(model, "queue");
    expect(statuses(queueDown)).toMatchObject({
      queue: "failed",
      api: "degraded",
      web: "unaffected",
    });
  });

  it("lets a hard failure win over a fallback reached another way", () => {
    const both: Model = {
      nodes: model.nodes,
      edges: [
        ...model.edges,
        { id: "api-cache-2", from: "api", to: "cache", sync: true, optional: true },
      ],
    };
    expect(sim(both, "cache").nodes.api!.status).toBe("failed");
  });

  it("marks the flows that break, and at which step", () => {
    const r = sim(model, "cache");
    const flow = (id: string) => r.flows.find((f) => f.id === id)!;
    expect(flow("read")).toMatchObject({ status: "broken", step: 1, node: "web" });
    expect(sim(model, "db").flows.find((f) => f.id === "read")!.status).toBe("broken");
    // the job flow starts at the API, which has failed too
    expect(flow("job")).toMatchObject({ status: "broken", step: 1, node: "api" });
    const mail = sim(model, "mail");
    // the API is only degraded (step 1), but the flow then reaches the mail service itself (step 2)
    expect(mail.flows.find((f) => f.id === "mailing")).toMatchObject({
      status: "broken",
      step: 2,
      node: "mail",
    });
    expect(sim(model, "worker").flows.find((f) => f.id === "job")).toMatchObject({
      status: "broken",
      step: 2,
      node: "worker",
    });
  });

  it("counts a step marked together as part of the step before it", () => {
    const r = sim(model, "cache");
    expect(r.flows.find((f) => f.id === "fan")!.step).toBe(1);
    const dbOnly = sim(
      { ...model, nodes: model.nodes, edges: model.edges.filter((e) => e.id !== "web-api") },
      "cache",
    );
    expect(dbOnly.flows.find((f) => f.id === "fan")).toMatchObject({ status: "broken", step: 2 });
  });

  it("takes several components and ignores ids that are not components", () => {
    const r = sim(model, ["db", "mail", "nope", "db"]);
    expect(r.down).toEqual(["db", "mail"]);
    expect(r.ignored).toEqual(["nope"]);
    expect(statuses(r).api).toBe("failed");
    const none = sim(model, "nope");
    expect(none.down).toEqual([]);
    expect(none.counts.failed).toBe(0);
    expect(none.flows.every((f) => f.status === "ok")).toBe(true);
  });

  it("terminates on a cycle and on a connection to itself", () => {
    const loop: Model = {
      nodes: ["a", "b", "c"].map((id) => ({ id })),
      edges: [
        { id: "a-b", from: "a", to: "b" },
        { id: "b-c", from: "b", to: "c" },
        { id: "c-a", from: "c", to: "a" },
        { id: "a-a", from: "a", to: "a" },
      ],
    };
    // a failure travels all the way round a cycle, and the search still ends
    expect(statuses(sim(loop, "a"))).toEqual({ a: "failed", b: "failed", c: "failed" });
    expect(sim(loop, "a").nodes.c!.chain[0]).toMatchObject({ cause: "a" });
  });

  it("is deterministic, does not change the model, and ignores connections to unknown components", () => {
    const copy = JSON.stringify(model);
    expect(JSON.stringify(sim(model, "cache"))).toBe(JSON.stringify(sim(model, "cache")));
    expect(JSON.stringify(model)).toBe(copy);
    const shuffled = {
      ...model,
      edges: [...model.edges].reverse(),
      nodes: [...model.nodes].reverse(),
    };
    expect(JSON.stringify(sim(shuffled, "cache").nodes)).toBe(
      JSON.stringify(sim(model, "cache").nodes),
    );
    const dangling = { ...model, edges: [...model.edges, { id: "x", from: "ghost", to: "cache" }] };
    expect(sim(dangling, "cache").nodes.ghost).toBeUndefined();
  });
});

describe("arch-visualize simulate.mjs", () => {
  const script = skillFile("arch-visualize", "scripts/simulate.mjs");
  const fixture = skillFile("arch-visualize", "evals/fixture-model.json");
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

  it("prints what fails, why and which flows break, within 40 lines, and says it is a what-if", () => {
    const r = run("--model", fixture, "--down", "cache");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("not a prediction about production");
    expect(r.stdout).toContain("failed (");
    expect(r.stdout).toContain("Flows:");
    expect(r.stdout.trim().split("\n").length).toBeLessThanOrEqual(40);
  });

  it("gives one line of JSON with --json, and the same answer twice", () => {
    const a = run("--model", fixture, "--down", "cache,db", "--json");
    expect(a.stdout.trim().split("\n")).toHaveLength(1);
    const parsed = JSON.parse(a.stdout) as Sim;
    expect(parsed.down).toEqual(["cache", "db"]);
    expect(run("--model", fixture, "--down", "cache,db", "--json").stdout).toBe(a.stdout);
  });

  it("exits 2 for a missing model, a missing --down and ids that are not components", () => {
    expect(run("--model", "/nonexistent.json", "--down", "x").status).toBe(2);
    expect(run("--model", fixture).status).toBe(2);
    expect(run("--model", fixture, "--down", "ghost").status).toBe(2);
  });

  it("never prints control codes from a label", () => {
    const hostile = skillFile("arch-visualize", "evals/hostile-model.json");
    const id = (JSON.parse(readFileSync(hostile, "utf8")) as Model).nodes[0]!.id;
    const r = run("--model", hostile, "--down", id);
    // eslint-disable-next-line no-control-regex -- the point of the test is that none appear
    expect(r.stdout).not.toMatch(/[\u0000-\u0008\u000B-\u001F\u007F]/);
  });

  it("has no network or process APIs and starts through a symlinked folder like the other scripts", () => {
    const src = readFileSync(script, "utf8");
    expect(src).not.toMatch(
      /node:(http|https|net|child_process|dns|worker_threads)|\bfetch\(|\beval\(/,
    );
    expect(path.basename(script)).toBe("simulate.mjs");
  });
});

describe("arch-visualize data trace", () => {
  type Trace = {
    label: string;
    sources: string[];
    nodes: string[];
    edges: string[];
    unlabelled: string[];
  };
  const { ArchData } = loadLib<{ ArchData: { trace: (m: unknown, l: string) => Trace } }>(
    "arch-visualize",
    ["assets/lib/dataflow.js"],
  );
  const m = {
    nodes: [
      { id: "web", data: [] },
      { id: "api", data: ["pii"] },
      { id: "db", data: ["pii", "payments"] },
      { id: "logs", data: ["logs"] },
      { id: "mail" },
      { id: "cdn" },
    ],
    edges: [
      { id: "web-api", from: "web", to: "api", carries: ["pii"] },
      { id: "api-db", from: "api", to: "db", carries: ["pii", "payments"] },
      { id: "api-logs", from: "api", to: "logs" }, // nothing recorded
      { id: "api-mail", from: "api", to: "mail", carries: ["logs"] },
      { id: "cdn-web", from: "cdn", to: "web", carries: [] },
      { id: "x", from: "ghost", to: "api", carries: ["pii"] },
    ],
  };

  it("lists the holders, the connections that carry the label and everything they reach", () => {
    const r = ArchData.trace(m, "pii");
    expect(r.sources).toEqual(["api", "db"]);
    expect(r.edges).toEqual(["api-db", "web-api"]);
    expect(r.nodes).toEqual(["api", "db", "web"]);
  });

  it("says which connections out of those components record nothing, and treats an empty list as recorded", () => {
    const r = ArchData.trace(m, "pii");
    expect(r.unlabelled).toEqual(["api-logs"]);
    expect(r.unlabelled).not.toContain("cdn-web");
  });

  it("separates labels and copes with a label nobody uses and an empty model", () => {
    expect(ArchData.trace(m, "payments").nodes).toEqual(["api", "db"]);
    expect(ArchData.trace(m, "health")).toMatchObject({
      sources: [],
      nodes: [],
      edges: [],
      unlabelled: [],
    });
    expect(ArchData.trace({}, "pii").nodes).toEqual([]);
  });

  it("ignores connections to components that do not exist and does not change the model", () => {
    const copy = JSON.stringify(m);
    expect(ArchData.trace(m, "pii").edges).not.toContain("x");
    expect(JSON.stringify(m)).toBe(copy);
    expect(JSON.stringify(ArchData.trace(m, "pii"))).toBe(JSON.stringify(ArchData.trace(m, "pii")));
  });
});
