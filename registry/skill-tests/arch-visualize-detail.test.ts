import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Sym = {
  id: string;
  name: string;
  kind: string;
  file: string;
  procedure?: { kind: string; path?: string };
  doc?: string;
  calls: { to: string; name: string }[];
  fetches: { url: string; method: string; to?: string }[];
  rpc: { path: string; kind: string; to?: string; inferred?: boolean }[];
  loops: number;
};
type Result = {
  symbolsKept: number;
  symbolsFound: number;
  truncated: boolean;
  focus?: { entries: string[]; depth: number; reached: number };
  symbols: Sym[];
};
type Mod = {
  analyzeSources: (
    s: Record<string, string>,
    o?: {
      maxSymbols?: number;
      focus?: { entries: string[]; depth?: number } | null;
      only?: string[] | null;
    },
  ) => Result;
};
type Model = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Check = { checkModel: (m: Model, o?: Record<string, unknown>) => string[] };

const SOURCES: Record<string, string> = {
  "packages/trpc/server/routers/viewer/bookings/_router.tsx": `
import authedProcedure from "../../../procedures/authedProcedure";
import publicProcedure from "../../../procedures/publicProcedure";
import { router } from "../../../trpc";
import { cancelHandler } from "./cancel.handler";

export const bookingsRouter = router({
  /** Load the bookings of the signed-in user. */
  get: authedProcedure.input(Z).query(async ({ input, ctx }) => {
    const { getHandler } = await import("./get.handler");
    return getHandler({ ctx, input });
  }),
  cancel: authedProcedure.input(Z).mutation(cancelHandler),
  nested: router({
    deep: publicProcedure.query(async () => 1),
  }),
});
const notAProcedure = { data: client.query("select 1") };
`,
  "packages/trpc/server/routers/viewer/bookings/get.handler.ts": `
import { loadOne } from "../../../lib/load";
export const getHandler = async (o: { list: string[] }) => {
  for (const b of o.list) {
    await loadOne(b);
  }
};
`,
  "packages/trpc/server/lib/load.ts": `export function loadOne(id: string) { return id; }`,
  "packages/trpc/server/routers/viewer/bookings/cancel.handler.ts": `
export const cancelHandler = async () => { return 1; };
`,
  "apps/web/Bookings.tsx": `
import { trpc } from "@calcom/trpc/react";
export function Bookings() {
  const q = trpc.viewer.bookings.get.useQuery({});
  const m = trpc.viewer.bookings.cancel.useMutation();
  fetch("/api/csrf");
  return <div />;
}
`,
  "apps/web/app/api/csrf/route.ts": `export async function GET() { return new Response("x"); }`,
  "apps/web/Unrelated.tsx": `export function Unrelated() { return <p />; }`,
};

const mod = await loadScript<Mod>("arch-visualize", "scripts/code-map.mjs");
const check = await loadScript<Check>("arch-visualize", "scripts/model-check.mjs");
const R = mod.analyzeSources(SOURCES);
const sym = (id: string) => {
  const s = R.symbols.find((x) => x.id === id);
  if (!s) throw new Error(`no symbol ${id}; have ${R.symbols.map((x) => x.id).join(", ")}`);
  return s;
};
const ROUTER = "packages/trpc/server/routers/viewer/bookings/_router.tsx";

describe("code-map: tRPC procedures", () => {
  it("finds procedures with their kind and a path taken from the router file layout", () => {
    expect(sym(`${ROUTER}#get`).kind).toBe("procedure");
    expect(sym(`${ROUTER}#get`).procedure).toEqual({ kind: "query", path: "viewer.bookings.get" });
    expect(sym(`${ROUTER}#cancel`).procedure).toEqual({
      kind: "mutation",
      path: "viewer.bookings.cancel",
    });
    expect(sym(`${ROUTER}#nested.deep`).procedure?.path).toBe("viewer.bookings.nested.deep");
  });

  it("does not take any object with a query method for a procedure", () => {
    expect(R.symbols.find((x) => x.name === "data")).toBeUndefined();
    expect(R.symbols.filter((x) => x.kind === "procedure")).toHaveLength(3);
  });

  it("follows `const { x } = await import(...)` and a handler passed by name", () => {
    expect(sym(`${ROUTER}#get`).calls.map((c) => c.to)).toEqual([
      "packages/trpc/server/routers/viewer/bookings/get.handler.ts#getHandler",
    ]);
    expect(sym(`${ROUTER}#cancel`).calls.map((c) => c.to)).toEqual([
      "packages/trpc/server/routers/viewer/bookings/cancel.handler.ts#cancelHandler",
    ]);
    expect(
      sym("packages/trpc/server/routers/viewer/bookings/get.handler.ts#getHandler").loops,
    ).toBe(1);
  });

  it("uses the comment above a procedure as its description", () => {
    expect(sym(`${ROUTER}#get`).doc).toBe("Load the bookings of the signed-in user.");
  });
});

describe("code-map: links across layers", () => {
  const page = () => sym("apps/web/Bookings.tsx#Bookings");

  it("links a tRPC call to the procedure with that path and marks the link as inferred", () => {
    expect(page().rpc).toEqual([
      expect.objectContaining({ path: "viewer.bookings.get", to: `${ROUTER}#get`, inferred: true }),
      expect.objectContaining({
        path: "viewer.bookings.cancel",
        to: `${ROUTER}#cancel`,
        inferred: true,
      }),
    ]);
  });

  it("links a fetch to the route handler that serves that path", () => {
    expect(page().fetches[0]).toMatchObject({
      url: "/api/csrf",
      to: "apps/web/app/api/csrf/route.ts#GET",
    });
  });

  it("counts those links as callers", () => {
    const get = R.symbols.find((x) => x.id === `${ROUTER}#get`) as Sym & { calledBy: string[] };
    expect(get.calledBy).toEqual(["apps/web/Bookings.tsx#Bookings"]);
  });
});

describe("code-map: --focus and scope", () => {
  it("keeps what an entry file reaches, nearest first, and drops the rest", () => {
    const r = mod.analyzeSources(SOURCES, {
      focus: { entries: ["apps/web/Bookings.tsx"], depth: 4 },
    });
    const ids = r.symbols.map((x) => x.id);
    expect(ids).toContain("packages/trpc/server/lib/load.ts#loadOne");
    expect(ids).not.toContain("apps/web/Unrelated.tsx#Unrelated");
    expect(r.focus?.reached).toBe(r.symbolsKept);
  });

  it("stops at the depth it was given", () => {
    const r = mod.analyzeSources(SOURCES, {
      focus: { entries: ["apps/web/Bookings.tsx"], depth: 1 },
    });
    const ids = r.symbols.map((x) => x.id);
    expect(ids).toContain(`${ROUTER}#get`);
    expect(ids).not.toContain("packages/trpc/server/lib/load.ts#loadOne");
  });

  it("accepts file#name and reports nothing when the entry matches nothing", () => {
    const one = mod.analyzeSources(SOURCES, { focus: { entries: [`${ROUTER}#cancel`] } });
    expect(one.symbols.map((x) => x.name)).toContain("cancelHandler");
    expect(mod.analyzeSources(SOURCES, { focus: { entries: ["nope.ts"] } }).symbolsKept).toBe(0);
  });

  it("limits the result to some folders with `only`", () => {
    const r = mod.analyzeSources(SOURCES, { only: ["apps/web"] });
    expect(r.symbols.every((x) => x.file.startsWith("apps/web/"))).toBe(true);
    expect(r.symbolsKept).toBeGreaterThan(0);
  });
});

describe("code-map --attach and model-check", () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  const baseModel = (): Model => ({
    version: 2,
    project: "Fixture",
    nodes: [
      {
        id: "web",
        label: "Web app",
        role: "frontend",
        tier: "frontend",
        tech: "generic-frontend",
        evidence: [{ file: "apps/web/Bookings.tsx", line: 1 }],
      },
      {
        id: "api",
        label: "tRPC API",
        role: "backend",
        tier: "backend",
        tech: "generic-backend",
        evidence: [{ file: ROUTER, line: 1 }],
      },
    ],
    edges: [
      {
        id: "web-api",
        from: "web",
        to: "api",
        evidence: [{ file: "apps/web/Bookings.tsx", line: 3 }],
      },
    ],
    flows: [],
    risks: [],
    inferred: [],
  });
  const project = () => {
    const root = mkdtempSync(path.join(tmpdir(), "detail-"));
    dirs.push(root);
    for (const [rel, text] of Object.entries(SOURCES)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), text);
    }
    writeFileSync(path.join(root, "model.json"), JSON.stringify(baseModel()));
    return root;
  };
  const attach = (root: string, extra: string[] = []) =>
    spawnSync(
      process.execPath,
      [
        skillFile("arch-visualize", "scripts/code-map.mjs"),
        "--root",
        root,
        "--model",
        path.join(root, "model.json"),
        "--attach",
        "web=apps/web,api=packages/trpc",
        ...extra,
      ],
      { encoding: "utf8" },
    );
  const attached = () => {
    const root = project();
    const r = attach(root);
    expect(r.status, r.stderr).toBe(0);
    return {
      root,
      model: JSON.parse(readFileSync(path.join(root, "model.json"), "utf8")) as Model,
    };
  };
  const problems = (m: Model, root?: string) =>
    check.checkModel(m, { draft: true, root: root ?? null, verifyFiles: Boolean(root) });

  it("puts each symbol on the node whose folder holds it, sets version 3 and lists the calls behind a connection", () => {
    const { model } = attached();
    expect(model.version).toBe(3);
    const web = model.nodes[0].detail.symbols.map((s: Sym) => s.name);
    const api = model.nodes[1].detail.symbols.map((s: Sym) => s.name);
    expect(web).toContain("Bookings");
    expect(api).toContain("get");
    expect(web).not.toContain("get");
    const via = model.edges[0].via as { kind: string; label: string; from: string; to: string }[];
    expect(via.map((v) => v.kind)).toEqual(["rpc", "rpc"]);
    expect(via[0]!.from).toBe("apps/web/Bookings.tsx#Bookings");
    expect(via[0]!.to).toBe(`${ROUTER}#get`);
  });

  it("produces a model that model-check accepts, with every file and line verified on disk", () => {
    const { root, model } = attached();
    expect(problems(model, root)).toEqual([]);
    const r = spawnSync(
      process.execPath,
      [
        skillFile("arch-visualize", "scripts/model-check.mjs"),
        "--model",
        path.join(root, "model.json"),
        "--root",
        root,
        "--draft",
      ],
      { encoding: "utf8" },
    );
    expect(r.status, r.stdout).toBe(0);
  });

  it("never leaves a reference to a symbol that is on no node", () => {
    const root = project();
    // only the web folder is attached, so the procedures are on no node and links to them are dropped
    const r = spawnSync(
      process.execPath,
      [
        skillFile("arch-visualize", "scripts/code-map.mjs"),
        "--root",
        root,
        "--model",
        path.join(root, "model.json"),
        "--attach",
        "web=apps/web",
        "--dir",
        "packages/trpc",
      ],
      { encoding: "utf8" },
    );
    expect(r.status, r.stderr).toBe(0);
    const model = JSON.parse(readFileSync(path.join(root, "model.json"), "utf8")) as Model;
    expect(problems(model, root)).toEqual([]);
    expect(
      model.nodes[0].detail.symbols[0].rpc.every((x: { to?: string }) => x.to === undefined),
    ).toBe(true);
    expect(model.edges[0].via).toBeUndefined();
  });

  it("refuses an unknown node", () => {
    const root = project();
    const r = spawnSync(
      process.execPath,
      [
        skillFile("arch-visualize", "scripts/code-map.mjs"),
        "--root",
        root,
        "--model",
        path.join(root, "model.json"),
        "--attach",
        "ghost=apps/web",
      ],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("ghost");
  });

  it("rejects detail on a model that is not version 3", () => {
    const { model } = attached();
    model.version = 2;
    expect(problems(model).join("\n")).toContain("version 3");
  });

  it("rejects duplicate ids, unknown targets and a via that does not match its connection", () => {
    const dup = attached().model;
    dup.nodes[1].detail.symbols.push({ ...dup.nodes[1].detail.symbols[0] });
    expect(problems(dup).join("\n")).toContain("duplicate symbol id");

    const dangling = attached().model;
    dangling.nodes[0].detail.symbols.find((s: Sym) => s.name === "Bookings").rpc[0].to =
      "x.ts#nope";
    expect(problems(dangling).join("\n")).toContain("is not a symbol in the model");

    const wrong = attached().model;
    wrong.edges[0].via[0] = { ...wrong.edges[0].via[0], from: `${ROUTER}#get` };
    expect(problems(wrong).join("\n")).toContain(
      "belongs to node api, but the connection starts at web",
    );
  });

  it("checks the file and line on disk only when a root is given", () => {
    const { root, model } = attached();
    model.nodes[0].detail.symbols[0].line = 9999;
    expect(problems(model).join("\n")).not.toContain("past the end");
    expect(problems(model, root).join("\n")).toContain("past the end");
    model.nodes[0].detail.symbols[0].line = 1;
    model.nodes[0].detail.symbols[0].file = "apps/web/gone.tsx";
    model.nodes[0].detail.symbols[0].id = "apps/web/gone.tsx#X";
    expect(problems(model, root).join("\n")).toContain("not found under the project root");
  });

  it("limits the size: 600 symbols in a model and 30 agent-written descriptions on a node", () => {
    const { model } = attached();
    const proto = model.nodes[0].detail.symbols[0] as Sym;
    const many = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => ({
        ...proto,
        id: `a/${prefix}${i}.ts#f`,
        file: `a/${prefix}${i}.ts`,
        calls: [],
        renders: [],
        fetches: [],
        rpc: [],
        calledBy: [],
        doc: "x",
        docBy: "agent",
      }));
    model.nodes[0].detail.symbols = many(31, "n");
    model.edges[0].via = [];
    expect(problems(model).join("\n")).toContain("31 descriptions written by the agent");
    const big = attached().model;
    big.nodes[0].detail.symbols = many(200, "p").map((s) => ({
      ...s,
      docBy: undefined,
      doc: undefined,
    }));
    big.nodes[1].detail.symbols = many(200, "q").map((s) => ({
      ...s,
      docBy: undefined,
      doc: undefined,
    }));
    big.nodes.push({
      ...big.nodes[0],
      id: "third",
      detail: {
        scope: "x",
        symbols: many(201, "r").map((s) => ({ ...s, docBy: undefined, doc: undefined })),
      },
    });
    big.edges[0].via = [];
    expect(problems(big).join("\n")).toMatch(/at most 200|601 symbols|at most 600/);
  });

  it("does not let a credential through in a description", () => {
    const { model } = attached();
    model.nodes[0].detail.symbols[0].doc = "Uses sk-abcdefghijklmnopqrstuvwxyz0123 to call it.";
    expect(problems(model).join("\n")).toContain("looks like a credential");
  });

  it("keeps models without detail valid and unchanged", () => {
    expect(problems(baseModel())).toEqual([]);
  });
});
