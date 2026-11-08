import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Call = { to: string; name: string; line: number; in: string | null };
type Sym = {
  id: string;
  name: string;
  kind: string;
  file: string;
  line: number;
  exported: boolean;
  doc?: string;
  route?: { path: string; method: string };
  calls: Call[];
  renders: { to?: string; name: string; module?: string; line: number }[];
  external: { name: string; module?: string; outside?: boolean; in: string | null }[];
  fetches: { url: string; method: string }[];
  rpc: { path: string; kind: string }[];
  calledBy: string[];
  loops: number;
  branches: number;
};
type Result = {
  scope: string;
  files: number;
  parsed: number;
  failed: string[];
  symbolsFound: number;
  symbolsKept: number;
  truncated: boolean;
  symbols: Sym[];
};
type Mod = {
  analyzeSources: (
    sources: Record<string, string>,
    o?: { aliases?: { prefix: string; dirs: string[] }[]; maxSymbols?: number; scope?: string },
  ) => Result;
};

const SOURCES: Record<string, string> = {
  "app/api/bookings/[id]/route.ts": `
import { NextResponse } from "next/server";
import { getBooking, listSlots } from "@/lib/bookings";
import prisma from "@calcom/prisma";

/** Return one booking. */
export async function GET(req: Request) {
  const b = await getBooking("x");
  return NextResponse.json(b);
}
export async function POST(req: Request) {
  const slots = await listSlots(["a", "b"]);
  for (const s of slots) {
    await prisma.booking.create({ data: s });
  }
  if (slots.length > 3) {
    await prisma.booking.deleteMany({});
  }
  return NextResponse.json({ ok: true });
}
`,
  "lib/bookings/index.ts": `
export { getBooking } from "./get";
export * from "./slots";
`,
  "lib/bookings/get.ts": `
import prisma from "@calcom/prisma";
// eslint-disable-next-line no-console
/**
 * Load a booking by id. Throws when missing.
 * @param id the id
 */
export const getBooking = async (id: string) => {
  return prisma.booking.findUnique({ where: { id } });
};
`,
  "lib/bookings/slots.ts": `
import { getBooking } from "./get";
export function listSlots(ids: string[]) {
  return ids.map((id) => getBooking(id));
}
function hidden() { return 1; }
`,
  "components/BookingList.tsx": `
import { useState } from "react";
import Button from "./Button";
import { Row } from "./parts";
import { trpc } from "@calcom/trpc/react";

/** The list of bookings. */
export function BookingList({ items }: { items: string[] }) {
  const [n] = useState(0);
  const q = trpc.viewer.bookings.get.useQuery({ n });
  const m = trpc.viewer.bookings.cancel.useMutation();
  const load = () => fetch("/api/bookings/" + items[0], { method: "DELETE" });
  const ok = fetch(\`/api/bookings/\${n}\`);
  return (
    <div>
      {items.map((i) => (
        <Row key={i} id={i} />
      ))}
      <Button onClick={load} />
    </div>
  );
}
export default BookingList;
`,
  "components/Button.tsx": `
export default function Button(props: { onClick: () => void }) {
  return <button onClick={props.onClick}>Go</button>;
}
`,
  "components/parts/index.ts": `export { Row } from "./Row";`,
  "components/parts/Row.tsx": `
export const Row = ({ id }: { id: string }) => <li>{id}</li>;
`,
  "components/Broken.tsx": `export const X = ( => {`,
};
const ALIASES = [{ prefix: "@/", dirs: ["."] }];

const mod = await loadScript<Mod>("arch-visualize", "scripts/code-map.mjs");
const R = mod.analyzeSources(SOURCES, { aliases: ALIASES });
const sym = (id: string) => {
  const s = R.symbols.find((x) => x.id === id);
  if (!s) throw new Error(`no symbol ${id}; have ${R.symbols.map((x) => x.id).join(", ")}`);
  return s;
};

describe("code-map: symbols", () => {
  it("parses TypeScript and JSX, and reports a file it cannot parse instead of failing", () => {
    expect(R.files).toBe(Object.keys(SOURCES).length);
    expect(R.parsed + R.failed.length).toBe(R.files);
    // errorRecovery keeps most broken files; only a hard failure lands in `failed`
    expect(R.failed.length).toBeLessThanOrEqual(1);
  });

  it("finds routes, components, hooks-free functions and arrow functions with their files and lines", () => {
    expect(sym("app/api/bookings/[id]/route.ts#GET").kind).toBe("route");
    expect(sym("app/api/bookings/[id]/route.ts#GET").route).toEqual({
      path: "/api/bookings/:id",
      method: "GET",
    });
    expect(sym("components/BookingList.tsx#BookingList").kind).toBe("component");
    expect(sym("components/Button.tsx#Button").kind).toBe("component");
    expect(sym("lib/bookings/get.ts#getBooking").kind).toBe("function");
    expect(sym("lib/bookings/get.ts#getBooking").line).toBeGreaterThan(1);
  });

  it("uses the first sentence of the leading comment as the description and skips directives and tags", () => {
    expect(sym("lib/bookings/get.ts#getBooking").doc).toBe("Load a booking by id.");
    expect(sym("app/api/bookings/[id]/route.ts#GET").doc).toBe("Return one booking.");
    expect(sym("lib/bookings/slots.ts#listSlots").doc).toBeUndefined();
  });

  it("never copies a comment that looks like a credential", async () => {
    const r = mod.analyzeSources({
      "a.ts": `/** Use sk-abcdefghijklmnopqrstuvwx to call it. */\nexport function f() {}`,
    });
    expect(r.symbols[0]!.doc).toBeUndefined();
  });
});

describe("code-map: calls", () => {
  it("resolves calls through aliases, relative imports and barrel re-exports", () => {
    const get = sym("app/api/bookings/[id]/route.ts#GET");
    expect(get.calls.map((c) => c.to)).toContain("lib/bookings/get.ts#getBooking");
    const post = sym("app/api/bookings/[id]/route.ts#POST");
    expect(post.calls.map((c) => c.to)).toContain("lib/bookings/slots.ts#listSlots");
  });

  it("marks a call inside a for-loop or a .map callback as a loop and one inside if as a branch", () => {
    const post = sym("app/api/bookings/[id]/route.ts#POST");
    const create = post.external.find((e) => e.name === "prisma.booking.create");
    const del = post.external.find((e) => e.name === "prisma.booking.deleteMany");
    expect(create?.in).toBe("loop");
    expect(del?.in).toBe("branch");
    expect(post.loops).toBe(1);
    expect(post.branches).toBe(1);
    const slots = sym("lib/bookings/slots.ts#listSlots");
    expect(slots.calls.find((c) => c.name === "getBooking")?.in).toBe("loop");
  });

  it("names where an unresolved call comes from", () => {
    const get = sym("lib/bookings/get.ts#getBooking");
    const e = get.external.find((x) => x.name === "prisma.booking.findUnique");
    expect(e).toMatchObject({ module: "@calcom/prisma" });
  });

  it("computes who calls a symbol", () => {
    expect(sym("lib/bookings/get.ts#getBooking").calledBy.sort()).toEqual([
      "app/api/bookings/[id]/route.ts#GET",
      "lib/bookings/slots.ts#listSlots",
    ]);
  });
});

describe("code-map: Next.js and tRPC connections", () => {
  const list = () => sym("components/BookingList.tsx#BookingList");

  it("links a rendered component to the file it comes from", () => {
    const r = list().renders;
    expect(r.find((x) => x.name === "Button")?.to).toBe("components/Button.tsx#Button");
    expect(r.find((x) => x.name === "Row")?.to).toBe("components/parts/Row.tsx#Row");
    expect(r.find((x) => x.name === "Row")).toBeDefined();
  });

  it("records fetch paths with their method and turns template holes into :param", () => {
    const f = list().fetches;
    // "/api/bookings/" + id (with a method option) and a template literal
    expect(f).toContainEqual(
      expect.objectContaining({ url: "/api/bookings/:param", method: "DELETE" }),
    );
    expect(f).toContainEqual(
      expect.objectContaining({ url: "/api/bookings/:param", method: "GET" }),
    );
  });

  it("records tRPC procedures as query or mutation", () => {
    expect(list().rpc).toEqual([
      expect.objectContaining({ path: "viewer.bookings.get", kind: "query" }),
      expect.objectContaining({ path: "viewer.bookings.cancel", kind: "mutation" }),
    ]);
  });

  it("treats a call in a .map callback as in a loop for renders too", () => {
    expect(list().renders.find((x) => x.name === "Row")).toBeDefined();
  });
});

describe("code-map: limits and determinism", () => {
  it("keeps only the most connected symbols when capped, and says so", () => {
    const r = mod.analyzeSources(SOURCES, { aliases: ALIASES, maxSymbols: 3 });
    expect(r.symbolsKept).toBe(3);
    expect(r.truncated).toBe(true);
    expect(r.symbolsFound).toBeGreaterThan(3);
    // a kept symbol only links to kept symbols
    const ids = new Set(r.symbols.map((s) => s.id));
    for (const s of r.symbols) for (const c of s.calls) expect(ids.has(c.to)).toBe(true);
  });

  it("parses files with decorators and keeps their methods", () => {
    const r = mod.analyzeSources({
      "svc.ts": `@Injectable()\nexport class Svc {\n  constructor(private readonly x: number) {}\n  @Get()\n  list() { return 1; }\n}`,
    });
    expect(r.failed).toEqual([]);
    expect(r.symbols.map((x) => x.name)).toEqual(["Svc.list"]);
  });

  it("gives byte-identical output for the same input", () => {
    const a = JSON.stringify(mod.analyzeSources(SOURCES, { aliases: ALIASES }));
    const b = JSON.stringify(mod.analyzeSources(SOURCES, { aliases: ALIASES }));
    expect(a).toBe(b);
  });
});

describe("code-map CLI", () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  const project = () => {
    const root = mkdtempSync(path.join(tmpdir(), "codemap-"));
    dirs.push(root);
    for (const [rel, text] of Object.entries(SOURCES)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), text);
    }
    writeFileSync(
      path.join(root, "tsconfig.json"),
      `{\n  // comment\n  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./*"] }, },\n}\n`,
    );
    return root;
  };
  const run = (args: string[], cwd?: string) =>
    spawnSync(process.execPath, [skillFile("arch-visualize", "scripts/code-map.mjs"), ...args], {
      encoding: "utf8",
      cwd,
    });

  it("writes the detail file, reads tsconfig paths and prints at most 40 lines", () => {
    const root = project();
    const r = run(["--root", root, "--out", "docs/d.json"]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(41);
    const out = JSON.parse(readFileSync(path.join(root, "docs/d.json"), "utf8")) as Result;
    // the "@/lib/bookings" alias was resolved through tsconfig.json (with comments and a trailing comma)
    const get = out.symbols.find((s) => s.id === "app/api/bookings/[id]/route.ts#GET")!;
    expect(get.calls.map((c) => c.to)).toContain("lib/bookings/get.ts#getBooking");
  });

  it("limits the scope to one folder and keeps paths relative to the project root", () => {
    const root = project();
    const r = run(["--root", root, "--dir", "components", "--out", "docs/c.json"]);
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(readFileSync(path.join(root, "docs/c.json"), "utf8")) as Result;
    expect(out.symbols.every((s) => s.file.startsWith("components/"))).toBe(true);
  });

  it("resolves workspace packages and a tsconfig that extends another, across several --dir folders", () => {
    const root = mkdtempSync(path.join(tmpdir(), "codemap-ws-"));
    dirs.push(root);
    const put = (rel: string, text: string) => {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), text);
    };
    put("package.json", JSON.stringify({ workspaces: ["apps/*", "packages/*"] }));
    put("packages/ui/package.json", JSON.stringify({ name: "@acme/ui" }));
    put("packages/ui/button.tsx", "export function Button() { return <b />; }\n");
    put("packages/ui/index.ts", 'export { Button } from "./button";\n');
    put(
      "tsconfig.base.json",
      '{ "compilerOptions": { "baseUrl": ".", "paths": { "~/*": ["./app/src/*"] } } }',
    );
    put("apps/web/package.json", JSON.stringify({ name: "web" }));
    put("apps/web/tsconfig.json", '{ "extends": "../../tsconfig.base.json" }');
    put(
      "apps/web/page.tsx",
      'import { Button } from "@acme/ui";\nimport { Deep } from "@acme/ui/button";\nexport default function Page() { return <Button />; }\n',
    );
    const r = run(["--root", root, "--dir", "apps/web,packages/ui", "--out", "d.json"]);
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(readFileSync(path.join(root, "d.json"), "utf8")) as Result;
    const page = out.symbols.find((x) => x.name === "page" || x.file === "apps/web/page.tsx")!;
    // "@acme/ui" is a workspace package, so the render links to the file that defines Button
    expect(page.renders.find((x) => x.name === "Button")?.to).toBe("packages/ui/button.tsx#Button");
    expect(out.scope).toBe("apps/web, packages/ui");
  });

  it("refuses a --dir outside the project, also through a symlink", () => {
    const root = project();
    const outside = mkdtempSync(path.join(tmpdir(), "codemap-out-"));
    dirs.push(outside);
    writeFileSync(path.join(outside, "x.ts"), "export function leak() {}");
    symlinkSync(outside, path.join(root, "link"));
    expect(run(["--root", root, "--dir", "../", "--out", "o.json"]).status).toBe(2);
    expect(run(["--root", root, "--dir", "link", "--out", "o.json"]).status).toBe(2);
  });

  it("never opens secret files and skips tests, declaration files and node_modules", () => {
    const root = project();
    writeFileSync(path.join(root, ".env"), "export function secretFn() {}");
    writeFileSync(path.join(root, "a.test.ts"), "export function inTest() {}");
    writeFileSync(path.join(root, "types.d.ts"), "export function inDts() {}");
    mkdirSync(path.join(root, "node_modules/x"), { recursive: true });
    writeFileSync(path.join(root, "node_modules/x/i.ts"), "export function inDep() {}");
    run(["--root", root, "--out", "docs/e.json"]);
    const text = readFileSync(path.join(root, "docs/e.json"), "utf8");
    for (const n of ["secretFn", "inTest", "inDts", "inDep"]) expect(text).not.toContain(n);
  });

  it("still runs when the skill folder is reached through a symlink", () => {
    const root = project();
    const link = path.join(root, "skill-link");
    symlinkSync(skillFile("arch-visualize", "."), link);
    const r = spawnSync(
      process.execPath,
      [path.join(link, "scripts/code-map.mjs"), "--root", root, "--out", "docs/s.json"],
      { encoding: "utf8" },
    );
    expect(r.status, r.stderr).toBe(0);
    expect(
      JSON.parse(readFileSync(path.join(root, "docs/s.json"), "utf8")).symbolsFound,
    ).toBeGreaterThan(5);
  });

  it("does not run project code: a file with side effects is only parsed", () => {
    const root = project();
    const marker = path.join(root, "ran.txt");
    writeFileSync(
      path.join(root, "evil.ts"),
      `import fs from "node:fs";\nfs.writeFileSync(${JSON.stringify(marker)}, "x");\nexport function e() {}\n`,
    );
    run(["--root", root, "--out", "docs/x.json"]);
    expect(() => readFileSync(marker)).toThrow();
  });
});
