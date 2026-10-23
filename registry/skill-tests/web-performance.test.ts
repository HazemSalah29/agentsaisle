import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

interface Row {
  route: string;
  kb: number;
  limitKb: number;
  over: boolean;
}
interface Evaluation {
  rows: Row[];
  failing: Row[];
  budgetKb: number;
}
interface Io {
  exists(p: string): boolean;
  read(p: string): Buffer;
}
interface Script {
  parseClientReferenceManifest(text: string): Record<string, unknown> | null;
  routeEntryFiles(manifest: unknown): string[];
  firstLoadFiles(buildManifest: unknown, entryFiles: string[]): string[];
  gzipBytes(b: Buffer): number;
  pageRouteOf(key: string): string | null;
  measureRoutes(
    nextDir: string,
    io?: Io,
  ): { error?: string; routes?: Array<{ route: string; files: number; bytes: number }> };
  evaluate(routes: Array<{ route: string; bytes: number }>, config?: unknown): Evaluation;
  report(result: Evaluation, opts?: { all?: boolean; maxLines?: number }): string;
  loadConfig(cwd: string): Record<string, unknown>;
  DEFAULT_BUDGET_KB: number;
}

let s: Script;
beforeAll(async () => {
  s = await loadScript<Script>("web-performance", "scripts/perf-budget.mjs");
});

// A pseudo-random string that does not compress, so gzip size is close to its length.
const noise = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    String.fromCharCode(33 + ((i * 7919 + (i >> 3) * 104729) % 90)),
  ).join("");
const rscManifest = (key: string, entries: Record<string, string[]>) =>
  `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["${key}"] = ${JSON.stringify({ clientModules: {}, entryJSFiles: entries })};\n`;

/** An in-memory .next folder. */
function fakeBuild(files: Record<string, string>) {
  const abs = (p: string) => path.join("/b", p);
  const map = new Map(Object.entries(files).map(([k, v]) => [abs(k), Buffer.from(v)]));
  const io: Io = { exists: (p) => map.has(p), read: (p) => map.get(p) ?? Buffer.alloc(0) };
  return { io, dir: "/b" };
}

const shared = noise(30_000);
const pageChunk = noise(12_000);
const layoutChunk = noise(6_000);
const manifests = (extra: Record<string, string> = {}) => ({
  "build-manifest.json": JSON.stringify({
    rootMainFiles: ["static/chunks/main.js", "static/chunks/runtime.js"],
    polyfillFiles: ["static/chunks/poly.js"],
  }),
  "app-path-routes-manifest.json": JSON.stringify({
    "/page": "/",
    "/docs/page": "/docs",
    "/skills/[name]/page": "/skills/[name]",
    "/robots.txt/route": "/robots.txt",
  }),
  "static/chunks/main.js": shared,
  "static/chunks/runtime.js": "x".repeat(2000),
  "static/chunks/poly.js": noise(50_000),
  "static/chunks/layout.js": layoutChunk,
  "static/chunks/home.js": pageChunk,
  "static/chunks/docs.js": noise(3_000),
  "server/app/page_client-reference-manifest.js": rscManifest("/page", {
    "[project]/app/layout": ["static/chunks/layout.js"],
    "[project]/app/page": ["static/chunks/layout.js", "static/chunks/home.js"],
    "[project]/node_modules/next/dist/client/components/builtin/global-error": [
      "static/chunks/layout.js",
    ],
  }),
  "server/app/docs/page_client-reference-manifest.js": rscManifest("/docs/page", {
    "[project]/app/layout": ["static/chunks/layout.js"],
    "[project]/app/docs/page": ["static/chunks/docs.js"],
  }),
  "server/app/skills/[name]/page_client-reference-manifest.js": rscManifest("/skills/[name]/page", {
    "[project]/app/layout": ["static/chunks/layout.js"],
  }),
  ...extra,
});

describe("parseClientReferenceManifest", () => {
  it("reads the JSON object from the assignment", () => {
    const m = s.parseClientReferenceManifest(rscManifest("/page", { a: ["x.js"] }));
    expect(m?.entryJSFiles).toEqual({ a: ["x.js"] });
  });
  it("returns null for anything that is not that shape, without running it", () => {
    expect(s.parseClientReferenceManifest("")).toBeNull();
    expect(s.parseClientReferenceManifest("console.log(1)")).toBeNull();
    expect(s.parseClientReferenceManifest('globalThis.x = {"a": 1,};')).toBeNull();
    // Executable code in place of JSON must not run; it is only parsed.
    expect(s.parseClientReferenceManifest("globalThis.x = (process.exit(7), {});")).toBeNull();
  });
});

describe("routeEntryFiles / firstLoadFiles / pageRouteOf", () => {
  it("collects layout and page chunks and skips framework built-ins", () => {
    const files = s.routeEntryFiles({
      entryJSFiles: {
        "[project]/app/layout": ["a.js"],
        "[project]/app/page": ["a.js", "b.js"],
        "[project]/node_modules/next/dist/client/components/builtin/global-error": ["c.js"],
      },
    });
    expect(files).toEqual(["a.js", "a.js", "b.js"]);
    expect(s.routeEntryFiles(null)).toEqual([]);
    expect(s.routeEntryFiles({ entryJSFiles: { k: "not-an-array" } })).toEqual([]);
  });
  it("adds the shared runtime, removes duplicates and keeps only JavaScript", () => {
    const files = s.firstLoadFiles({ rootMainFiles: ["m.js", "r.js", "style.css"] }, [
      "m.js",
      "p.js",
      "p.css",
    ]);
    expect(files).toEqual(["m.js", "r.js", "p.js"]);
    expect(s.firstLoadFiles({}, ["p.js"])).toEqual(["p.js"]);
  });
  it("maps manifest keys to URL paths and ignores route handlers", () => {
    expect(s.pageRouteOf("/page")).toBe("/");
    expect(s.pageRouteOf("/skills/[name]/page")).toBe("/skills/[name]");
    expect(s.pageRouteOf("/robots.txt/route")).toBeNull();
  });
});

describe("gzipBytes", () => {
  it("measures compressed size", () => {
    const b = Buffer.from("a".repeat(10_000));
    expect(s.gzipBytes(b)).toBe(gzipSync(b, { level: 9 }).length);
    expect(s.gzipBytes(b)).toBeLessThan(200);
  });
});

describe("measureRoutes", () => {
  it("measures each page route: shared runtime once, plus the route's own chunks, polyfills excluded", () => {
    const { io, dir } = fakeBuild(manifests());
    const { routes, error } = s.measureRoutes(dir, io);
    expect(error).toBeUndefined();
    const home = routes!.find((r) => r.route === "/")!;
    const docs = routes!.find((r) => r.route === "/docs")!;
    const dyn = routes!.find((r) => r.route === "/skills/[name]")!;
    expect(routes!.find((r) => r.route === "/robots.txt")).toBeUndefined();
    // home = main + runtime + layout + home; layout listed twice counts once
    expect(home.files).toBe(4);
    const expectHome =
      s.gzipBytes(Buffer.from(shared)) +
      s.gzipBytes(Buffer.from("x".repeat(2000))) +
      s.gzipBytes(Buffer.from(layoutChunk)) +
      s.gzipBytes(Buffer.from(pageChunk));
    expect(home.bytes).toBe(expectHome);
    expect(docs.bytes).toBeLessThan(home.bytes);
    expect(dyn.files).toBe(3);
  });
  it("sorts the biggest route first", () => {
    const { io, dir } = fakeBuild(manifests());
    const sizes = s.measureRoutes(dir, io).routes!.map((r) => r.bytes);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
  });
  it("counts a missing chunk file as 0 instead of crashing", () => {
    const files = manifests();
    delete (files as Record<string, string>)["static/chunks/home.js"];
    const { io, dir } = fakeBuild(files);
    expect(s.measureRoutes(dir, io).routes!.find((r) => r.route === "/")!.files).toBe(4);
  });
  it("skips routes whose manifest is missing or unreadable", () => {
    const { io, dir } = fakeBuild(
      manifests({ "server/app/docs/page_client-reference-manifest.js": "garbage" }),
    );
    expect(s.measureRoutes(dir, io).routes!.map((r) => r.route)).not.toContain("/docs");
  });
  it("explains what to do when there is no build output", () => {
    const { io, dir } = fakeBuild({});
    expect(s.measureRoutes(dir, io).error).toMatch(/Run the production build first/);
  });
});

describe("evaluate and report", () => {
  const kb = (n: number) => n * 1024;
  const routes = [
    { route: "/big", bytes: kb(200) },
    { route: "/ok", bytes: kb(120) },
    { route: "/design", bytes: kb(400) },
  ];
  it("uses 180 kB by default", () => {
    expect(s.DEFAULT_BUDGET_KB).toBe(180);
    const r = s.evaluate(routes);
    expect(r.failing.map((x) => x.route)).toEqual(["/big", "/design"]);
  });
  it("applies a global budget, per-route limits and an ignore list", () => {
    const r = s.evaluate(routes, { budgetKb: 250, routes: { "/ok": 100 }, ignore: ["/design"] });
    expect(r.rows.map((x) => x.route)).toEqual(["/big", "/ok"]);
    expect(r.failing.map((x) => x.route)).toEqual(["/ok"]);
  });
  it("ignores config values of the wrong type", () => {
    const r = s.evaluate(routes, { budgetKb: "huge", routes: 5, ignore: "nope" });
    expect(r.budgetKb).toBe(180);
  });
  it("prints one line when everything fits", () => {
    const text = s.report(s.evaluate([{ route: "/", bytes: kb(100) }]));
    expect(text).toBe("perf-budget: 1 routes within budget (180 kB gzip); largest / 100.0 kB");
  });
  it("prints only the routes over budget, with how far over", () => {
    const text = s.report(s.evaluate(routes, { ignore: ["/design"] }));
    expect(text).toContain("perf-budget: 1 of 2 routes over budget");
    expect(text).toContain("/big  200.0 kB > 180.0 kB  (+20.0 kB)");
    expect(text).not.toContain("/ok");
  });
  it("lists every route with --all", () => {
    expect(s.report(s.evaluate(routes), { all: true })).toContain("ok   /ok");
  });
  it("never exceeds the line limit", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ route: `/r${i}`, bytes: kb(500) }));
    const lines = s.report(s.evaluate(many), { maxLines: 40 }).split("\n");
    expect(lines).toHaveLength(40);
    expect(lines.at(-1)).toMatch(/more$/);
  });
});

describe("as a command", () => {
  let dir: string;
  const run = (args: string[]) => {
    try {
      return {
        code: 0,
        out: execFileSync(
          process.execPath,
          [skillFile("web-performance", "scripts/perf-budget.mjs"), ...args],
          { encoding: "utf8", stdio: "pipe" },
        ),
      };
    } catch (e) {
      const err = e as { status: number; stdout: string };
      return { code: err.status, out: err.stdout };
    }
  };
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "aisle-perf-"));
    for (const [rel, content] of Object.entries(manifests())) {
      await mkdir(path.dirname(path.join(dir, ".next", rel)), { recursive: true });
      await writeFile(path.join(dir, ".next", rel), content);
    }
  });
  it("exits 0 when within budget and 1 when over, reading .next from disk", async () => {
    expect(run(["--cwd", dir]).code).toBe(0);
    await writeFile(path.join(dir, "perf.config.json"), JSON.stringify({ budgetKb: 0.1 }));
    const over = run(["--cwd", dir]);
    expect(over.code).toBe(1);
    expect(over.out).toContain("routes over budget");
    await writeFile(path.join(dir, "perf.config.json"), "{broken");
    expect(run(["--cwd", dir])).toMatchObject({ code: 1 });
    expect(run(["--cwd", dir]).out).toContain("perf.config.json is not valid JSON");
  });
  it("fails clearly when there is no build", async () => {
    const empty = await mkdtemp(path.join(os.tmpdir(), "aisle-perf-empty-"));
    const r = run(["--cwd", empty]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("Run the production build first");
  });
});
